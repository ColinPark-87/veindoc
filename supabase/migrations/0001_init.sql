-- 삼성흉부외과 대전 — 초기 스키마
-- Supabase SQL Editor 에 그대로 붙여넣어 실행

-- ─────────────────────────────────────────────
-- 치료후기 (원본 사이트 nvein/0604 — 942건 이관 대상)
-- ─────────────────────────────────────────────
create table if not exists public.reviews (
  id           bigint primary key,          -- 원본 idx 유지 (URL 리다이렉트용)
  title        text        not null,
  body         text        not null default '',
  views        integer     not null default 0,
  is_secret    boolean     not null default false,
  branch       text        not null default '대전',
  created_at   timestamptz,
  imported_at  timestamptz not null default now()
);
create index if not exists reviews_views_idx on public.reviews (views desc);
create index if not exists reviews_created_idx on public.reviews (created_at desc nulls last);
-- 한국어 검색은 simple 사전 + trigram 조합이 실용적
create extension if not exists pg_trgm;
create index if not exists reviews_title_trgm on public.reviews using gin (title gin_trgm_ops);
create index if not exists reviews_body_trgm  on public.reviews using gin (body  gin_trgm_ops);

-- ─────────────────────────────────────────────
-- 진료 상담 (비밀글은 본문 미저장 — 환자 사생활)
-- ─────────────────────────────────────────────
create table if not exists public.counsels (
  id          bigint primary key,
  title       text        not null,
  is_secret   boolean     not null default true,
  status      text,                          -- 처리완료 등
  branch      text        not null default '대전',
  created_at  timestamptz,
  imported_at timestamptz not null default now()
);
create index if not exists counsels_created_idx on public.counsels (created_at desc nulls last);

-- ─────────────────────────────────────────────
-- 온라인 상담 접수 (신규 유입)
-- ─────────────────────────────────────────────
create table if not exists public.inquiries (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  phone       text        not null,
  message     text        not null default '',
  symptoms    text[]      not null default '{}',   -- 자가체크 결과
  branch      text        not null default '대전',
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- RLS — 공개 읽기 / 쓰기 제한
-- ─────────────────────────────────────────────
alter table public.reviews   enable row level security;
alter table public.counsels  enable row level security;
alter table public.inquiries enable row level security;

drop policy if exists "reviews public read" on public.reviews;
create policy "reviews public read" on public.reviews
  for select using (is_secret = false);

drop policy if exists "counsels public read titles" on public.counsels;
create policy "counsels public read titles" on public.counsels
  for select using (true);

-- 상담 접수는 익명 insert만 허용, 조회는 금지(개인정보)
drop policy if exists "inquiries anon insert" on public.inquiries;
create policy "inquiries anon insert" on public.inquiries
  for insert with check (true);
