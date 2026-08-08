-- 삼성흉부외과 대전 — 캘린더(공휴일) · 환자 관리
-- Supabase SQL Editor 에 그대로 붙여넣어 실행

-- ═══════════════════════════════════════════
-- 1. 공휴일 (10년치, 관보 기준 · 리프레시로 갱신)
-- ═══════════════════════════════════════════
create table if not exists public.holidays (
  day        date primary key,
  name       text not null,
  -- 공휴일 = 관공서 휴무, 기념일 = 표시만(휴무 아님)
  is_holiday boolean not null default true,
  source     text not null default 'kasi',   -- kasi / manual
  synced_at  timestamptz not null default now()
);
create index if not exists holidays_year_idx on public.holidays ((extract(year from day)));

-- 동기화 이력 — '언제 무엇을 몇 건 끌어왔나'를 남겨야 리프레시가 신뢰된다
create table if not exists public.holiday_syncs (
  id         bigint generated always as identity primary key,
  years      int[] not null default '{}',
  fetched    int not null default 0,
  upserted   int not null default 0,
  failed     int[] not null default '{}',
  source     text not null default 'kasi',
  actor      uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════
-- 2. 환자 — 누적 기준: 이름, 동명이인은 전화번호로 분리
--    phone 은 숫자만 정규화해서 저장한다(하이픈 표기 차이로 갈라지는 것 방지)
-- ═══════════════════════════════════════════
create table if not exists public.patients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text not null,                  -- 숫자만
  branch      text not null default '대전',
  doctor      text not null default '',       -- 주로 보는 주치의
  memo        text not null default '',       -- 환자 단위 상시 메모(주의사항 등)
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz,
  created_at  timestamptz not null default now(),
  unique (name, phone)
);
create index if not exists patients_name_idx  on public.patients (name);
create index if not exists patients_phone_idx on public.patients (phone);

-- ═══════════════════════════════════════════
-- 3. 예약 = 진료 1회. 기존 appointments 를 확장해서 쓴다(중복 테이블 금지)
-- ═══════════════════════════════════════════
alter table public.appointments
  add column if not exists patient_id uuid references public.patients(id) on delete set null,
  add column if not exists arrived_at timestamptz,          -- 내원 체크 시각(NULL = 미내원)
  add column if not exists next_at    timestamptz,          -- 다음 진료 예정
  add column if not exists day_note   text not null default '',  -- 당일 특이 기록
  add column if not exists doctor     text not null default '';  -- 진료 본 주치의

create index if not exists appt_patient_idx on public.appointments(patient_id, preferred_at desc);
create index if not exists appt_day_idx     on public.appointments((preferred_at::date));

-- 내원 체크는 arrived_at 이 원천. status 는 화면 표시용이라 트리거로 맞춰준다.
create or replace function public.sync_appt_arrival()
returns trigger language plpgsql as $$
begin
  if new.arrived_at is not null and old.arrived_at is null then
    new.status := 'done';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists appt_arrival on public.appointments;
create trigger appt_arrival before update on public.appointments
  for each row execute function public.sync_appt_arrival();

-- ═══════════════════════════════════════════
-- 4. 환자 찾기/만들기 — 이름+전화 한 쌍이 곧 한 사람
-- ═══════════════════════════════════════════
create or replace function public.upsert_patient(
  p_name text, p_phone text, p_branch text default '대전', p_doctor text default ''
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g');
  v_name  text := btrim(coalesce(p_name,''));
  v_id    uuid;
begin
  if not public.is_staff() then raise exception '권한 없음'; end if;
  if v_name = '' or v_phone = '' then raise exception '이름과 전화번호가 필요합니다'; end if;

  insert into public.patients (name, phone, branch, doctor)
  values (v_name, v_phone, coalesce(p_branch,'대전'), coalesce(p_doctor,''))
  on conflict (name, phone) do update
    set last_seen = now(),
        doctor    = case when excluded.doctor <> '' then excluded.doctor else public.patients.doctor end
  returning id into v_id;

  return v_id;
end $$;

-- ═══════════════════════════════════════════
-- 5. 환자 누적 이력 — 진료 기록 + 문자 발송을 한 줄기로
-- ═══════════════════════════════════════════
-- ⚠ 뷰는 기본값이 '소유자 권한 실행'이라 밑단 테이블의 RLS를 통과해 버린다.
--   환자 정보가 걸린 뷰이므로 security_invoker 를 반드시 켠다(호출자 권한으로 실행).
create or replace view public.v_patient_timeline with (security_invoker = true) as
  select a.patient_id,
         'visit'::text                     as kind,
         coalesce(a.preferred_at, a.created_at) as at,
         a.status,
         a.doctor,
         a.day_note                        as note,
         a.next_at,
         a.arrived_at,
         a.id::text                        as ref
  from public.appointments a
  where a.patient_id is not null
  union all
  select p.id,
         'sms',
         s.created_at,
         s.status,
         '',
         s.body,
         null::timestamptz,
         null::timestamptz,
         s.id::text
  from public.sms_logs s
  join public.patients p on p.phone = regexp_replace(s.to_phone, '[^0-9]', '', 'g');

-- 오늘 진료 대상 — 캘린더/당일 알림이 쓰는 한 곳
create or replace view public.v_today_appointments with (security_invoker = true) as
  select a.*, p.name as patient_name, p.phone as patient_phone
  from public.appointments a
  left join public.patients p on p.id = a.patient_id
  where a.preferred_at::date = (now() at time zone 'Asia/Seoul')::date
    and a.status <> 'cancelled'
  order by a.preferred_at;

-- ═══════════════════════════════════════════
-- 6. RLS
-- ═══════════════════════════════════════════
alter table public.holidays      enable row level security;
alter table public.holiday_syncs enable row level security;
alter table public.patients      enable row level security;

-- 공휴일은 공개 정보 — 읽기는 누구나, 쓰기는 관리자
drop policy if exists "holidays public read" on public.holidays;
create policy "holidays public read" on public.holidays for select using (true);
drop policy if exists "holidays admin write" on public.holidays;
create policy "holidays admin write" on public.holidays
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "hsync staff read" on public.holiday_syncs;
create policy "hsync staff read" on public.holiday_syncs for select using (public.is_staff());
drop policy if exists "hsync admin write" on public.holiday_syncs;
create policy "hsync admin write" on public.holiday_syncs
  for insert with check (public.is_admin());

-- 환자는 의료정보 — 직원 이상만. 익명 접근 경로를 만들지 않는다.
drop policy if exists "patients staff read" on public.patients;
create policy "patients staff read" on public.patients for select using (public.is_staff());
drop policy if exists "patients staff write" on public.patients;
create policy "patients staff write" on public.patients
  for all using (public.is_staff()) with check (public.is_staff());

-- ═══════════════════════════════════════════
-- 7. 0002 통계 뷰 보정
--    같은 이유(뷰가 RLS를 우회함)로 page_views/click_events/activity_logs 가
--    v_* 뷰를 통해 익명에게 열려 있었다. 정의는 그대로, 실행 권한만 호출자로 바꾼다.
-- ═══════════════════════════════════════════
alter view public.v_daily_traffic  set (security_invoker = true);
alter view public.v_click_summary  set (security_invoker = true);
alter view public.v_staff_activity set (security_invoker = true);
