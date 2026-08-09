-- 삼성흉부외과 대전 — 설문
-- Supabase SQL Editor 에 그대로 붙여넣어 실행
--
-- 설계 메모: 응답은 문항별 행으로 쪼개지 않고 한 응답당 jsonb 한 덩어리로 넣는다.
-- 병원 규모(수백~수천 건)에서는 조인·집계 테이블을 두는 비용이 이득보다 크고,
-- 문항이 바뀌어도 과거 응답이 깨지지 않는다(그때의 문항 스냅샷을 같이 저장한다).

create table if not exists public.surveys (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  intro       text not null default '',
  -- draft: 작성 중(공개 안 됨) / open: 응답 받는 중 / closed: 마감(결과만 봄)
  status      text not null default 'draft' check (status in ('draft','open','closed')),
  ask_contact boolean not null default false,  -- 이름·연락처를 받을지
  thanks      text not null default '응답해 주셔서 감사합니다.',
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists surveys_status_idx on public.surveys(status, created_at desc);

create table if not exists public.survey_questions (
  id        uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  ord       int  not null default 0,
  kind      text not null default 'single'
            check (kind in ('single','multi','scale','text')),
  label     text not null,
  options   text[] not null default '{}',   -- single/multi 에서만 쓴다
  required  boolean not null default true
);
create index if not exists sq_survey_idx on public.survey_questions(survey_id, ord);

create table if not exists public.survey_responses (
  id         uuid primary key default gen_random_uuid(),
  survey_id  uuid not null references public.surveys(id) on delete cascade,
  -- { "<question_id>": {"choice":[0,2]} | {"scale":4} | {"text":"..."} }
  answers    jsonb not null default '{}',
  -- 문항이 나중에 바뀌어도 이 응답이 무엇에 대한 답이었는지 남는다
  snapshot   jsonb not null default '[]',
  name       text not null default '',
  phone      text not null default '',
  branch     text not null default '대전',
  session_id text,
  created_at timestamptz not null default now()
);
create index if not exists sr_survey_idx on public.survey_responses(survey_id, created_at desc);

-- ═══════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════
alter table public.surveys          enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_responses enable row level security;

-- 공개된 설문만 익명에게 보인다. 초안은 직원 이상만.
drop policy if exists "surveys public read" on public.surveys;
create policy "surveys public read" on public.surveys
  for select using (status = 'open' or public.is_staff());
drop policy if exists "surveys admin write" on public.surveys;
create policy "surveys admin write" on public.surveys
  for all using (public.is_staff()) with check (public.is_staff());

-- 문항은 부모 설문이 열려 있을 때만 익명에게 보인다
drop policy if exists "sq public read" on public.survey_questions;
create policy "sq public read" on public.survey_questions
  for select using (
    public.is_staff()
    or exists (select 1 from public.surveys s
               where s.id = survey_id and s.status = 'open')
  );
drop policy if exists "sq staff write" on public.survey_questions;
create policy "sq staff write" on public.survey_questions
  for all using (public.is_staff()) with check (public.is_staff());

-- 응답: 열린 설문에만 익명 제출 가능. 열람은 직원 이상(개인정보가 섞일 수 있다).
drop policy if exists "sr anon insert" on public.survey_responses;
create policy "sr anon insert" on public.survey_responses
  for insert with check (
    exists (select 1 from public.surveys s
            where s.id = survey_id and s.status = 'open')
  );
drop policy if exists "sr staff read" on public.survey_responses;
create policy "sr staff read" on public.survey_responses
  for select using (public.is_staff());
drop policy if exists "sr admin delete" on public.survey_responses;
create policy "sr admin delete" on public.survey_responses
  for delete using (public.is_admin());

-- 응답 수는 관리 목록에서 자주 쓴다
create or replace view public.v_survey_counts with (security_invoker = true) as
  select s.id, s.slug, s.title, s.status,
         count(r.id)      as responses,
         max(r.created_at) as last_at
  from public.surveys s
  left join public.survey_responses r on r.survey_id = s.id
  group by s.id, s.slug, s.title, s.status;

notify pgrst, 'reload schema';
