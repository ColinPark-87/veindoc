-- 삼성흉부외과 대전 — 관리자/직원 페이지 스키마
-- Supabase SQL Editor 에 그대로 붙여넣어 실행

-- ═══════════════════════════════════════════
-- 1. 권한 (profiles)
-- ═══════════════════════════════════════════
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  name        text,
  role        text not null default 'member'
              check (role in ('admin', 'staff', 'member')),
  branch      text not null default '대전',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 가입 시 프로필 자동 생성
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 권한 조회 헬퍼 (RLS 재귀 방지: security definer)
create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid() and is_active), 'anon');
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.my_role() in ('admin','staff');
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.my_role() = 'admin';
$$;

-- ═══════════════════════════════════════════
-- 2. 예약 관리
-- ═══════════════════════════════════════════
create table if not exists public.appointments (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  phone        text not null,
  branch       text not null default '대전',
  preferred_at timestamptz,
  symptoms     text[] not null default '{}',
  memo         text not null default '',
  status       text not null default 'new'
               check (status in ('new','confirmed','done','cancelled','noshow')),
  assignee     uuid references public.profiles(id),
  source       text not null default 'web',   -- web / phone / talktalk
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists appt_status_idx on public.appointments(status, created_at desc);
create index if not exists appt_pref_idx   on public.appointments(preferred_at);

-- ═══════════════════════════════════════════
-- 3. 문자 발송 이력
-- ═══════════════════════════════════════════
create table if not exists public.sms_logs (
  id         uuid primary key default gen_random_uuid(),
  to_phone   text not null,
  body       text not null,
  template   text,                       -- 약도 / 예약확인 / 안내
  branch     text not null default '대전',
  status     text not null default 'queued'
             check (status in ('queued','sent','failed')),
  error      text,
  sent_by    uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists sms_created_idx on public.sms_logs(created_at desc);

-- ═══════════════════════════════════════════
-- 4. 게시판 (공지 / 병원소식)
-- ═══════════════════════════════════════════
create table if not exists public.posts (
  id           bigint generated always as identity primary key,
  category     text not null default 'notice'
               check (category in ('notice','news','faq')),
  title        text not null,
  body         text not null default '',
  is_published boolean not null default false,
  pinned       boolean not null default false,
  views        integer not null default 0,
  author       uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists posts_pub_idx on public.posts(category, is_published, pinned desc, created_at desc);

-- ═══════════════════════════════════════════
-- 5. 유입 / 클릭 추적 (대시보드용)
-- ═══════════════════════════════════════════
create table if not exists public.page_views (
  id         bigint generated always as identity primary key,
  path       text not null,
  referrer   text,
  device     text,                       -- mobile / desktop
  session_id text,
  created_at timestamptz not null default now()
);
create index if not exists pv_created_idx on public.page_views(created_at desc);
create index if not exists pv_path_idx    on public.page_views(path, created_at desc);

create table if not exists public.click_events (
  id         bigint generated always as identity primary key,
  target     text not null,              -- talktalk / selfcheck / tel / reserve / evidence
  label      text,
  path       text,
  device     text,
  session_id text,
  created_at timestamptz not null default now()
);
create index if not exists ce_created_idx on public.click_events(created_at desc);
create index if not exists ce_target_idx  on public.click_events(target, created_at desc);

-- ═══════════════════════════════════════════
-- 6. 직원 업무 로그 (총괄 대시보드용)
-- ═══════════════════════════════════════════
create table if not exists public.activity_logs (
  id         bigint generated always as identity primary key,
  actor      uuid references public.profiles(id),
  action     text not null,              -- appointment.update / sms.send / post.publish ...
  entity     text,
  entity_id  text,
  detail     jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists al_actor_idx   on public.activity_logs(actor, created_at desc);
create index if not exists al_created_idx on public.activity_logs(created_at desc);

-- ═══════════════════════════════════════════
-- 7. 진료시간 설정 (하드코딩 제거용)
-- ═══════════════════════════════════════════
create table if not exists public.clinic_settings (
  branch      text primary key,
  weekday     jsonb not null default '{"open":"09:00","close":"18:00"}',
  saturday    jsonb not null default '{"open":"09:00","close":"13:00"}',
  lunch       jsonb not null default '{"start":"13:00","end":"14:00"}',
  closed_days text[] not null default '{일요일,공휴일}',
  notice      text not null default '',
  updated_at  timestamptz not null default now()
);
insert into public.clinic_settings(branch) values ('대전'),('평촌'),('천안')
  on conflict (branch) do nothing;

-- ═══════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════
alter table public.profiles        enable row level security;
alter table public.appointments    enable row level security;
alter table public.sms_logs        enable row level security;
alter table public.posts           enable row level security;
alter table public.page_views      enable row level security;
alter table public.click_events    enable row level security;
alter table public.activity_logs   enable row level security;
alter table public.clinic_settings enable row level security;

-- profiles: 본인 조회 / 관리자 전체
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles admin write" on public.profiles;
create policy "profiles admin write" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- appointments: 익명 접수 가능, 조회/수정은 직원 이상
drop policy if exists "appt anon insert" on public.appointments;
create policy "appt anon insert" on public.appointments
  for insert with check (true);
drop policy if exists "appt staff read" on public.appointments;
create policy "appt staff read" on public.appointments
  for select using (public.is_staff());
drop policy if exists "appt staff write" on public.appointments;
create policy "appt staff write" on public.appointments
  for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "appt admin delete" on public.appointments;
create policy "appt admin delete" on public.appointments
  for delete using (public.is_admin());

-- sms / activity: 직원 이상
drop policy if exists "sms staff" on public.sms_logs;
create policy "sms staff" on public.sms_logs
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "al staff insert" on public.activity_logs;
create policy "al staff insert" on public.activity_logs
  for insert with check (public.is_staff());
drop policy if exists "al admin read" on public.activity_logs;
create policy "al admin read" on public.activity_logs
  for select using (public.is_admin() or actor = auth.uid());

-- posts: 공개글은 누구나, 편집은 직원 이상
drop policy if exists "posts public read" on public.posts;
create policy "posts public read" on public.posts
  for select using (is_published or public.is_staff());
drop policy if exists "posts staff write" on public.posts;
create policy "posts staff write" on public.posts
  for all using (public.is_staff()) with check (public.is_staff());

-- 추적: 익명 기록 가능, 조회는 관리자만(개인정보 최소수집)
drop policy if exists "pv anon insert" on public.page_views;
create policy "pv anon insert" on public.page_views for insert with check (true);
drop policy if exists "pv admin read" on public.page_views;
create policy "pv admin read" on public.page_views for select using (public.is_admin());

drop policy if exists "ce anon insert" on public.click_events;
create policy "ce anon insert" on public.click_events for insert with check (true);
drop policy if exists "ce admin read" on public.click_events;
create policy "ce admin read" on public.click_events for select using (public.is_admin());

-- 진료시간: 공개 조회, 관리자 수정
drop policy if exists "cs public read" on public.clinic_settings;
create policy "cs public read" on public.clinic_settings for select using (true);
drop policy if exists "cs admin write" on public.clinic_settings;
create policy "cs admin write" on public.clinic_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- 후기 관리: 직원도 수정 가능하게 추가
drop policy if exists "reviews staff write" on public.reviews;
create policy "reviews staff write" on public.reviews
  for all using (public.is_staff()) with check (public.is_staff());

-- ═══════════════════════════════════════════
-- 8. 대시보드 집계 뷰 (관리자 전용)
-- ═══════════════════════════════════════════
create or replace view public.v_daily_traffic as
  select date_trunc('day', created_at)::date as day,
         count(*) as views,
         count(distinct session_id) as sessions
  from public.page_views
  group by 1 order by 1 desc;

create or replace view public.v_click_summary as
  select target,
         count(*) as clicks,
         count(distinct session_id) as sessions,
         max(created_at) as last_at
  from public.click_events
  group by 1 order by 2 desc;

create or replace view public.v_staff_activity as
  select p.id, p.name, p.email, p.role,
         count(a.id) as actions,
         count(*) filter (where a.created_at > now() - interval '7 days') as actions_7d,
         max(a.created_at) as last_at
  from public.profiles p
  left join public.activity_logs a on a.actor = p.id
  where p.role in ('admin','staff')
  group by p.id, p.name, p.email, p.role
  order by actions desc;
