-- 삼성흉부외과 대전 — 상담·약도 요청 처리
-- Supabase SQL Editor 에 그대로 붙여넣어 실행

-- 0001 에서 inquiries 는 '익명 insert 만' 열려 있고 select 정책이 없었다.
-- 즉 접수는 되는데 직원이 열어볼 수가 없었다. 처리 상태도 없어 누가 처리했는지 남지 않는다.
alter table public.inquiries
  add column if not exists kind       text not null default 'consult',  -- consult / map_sms
  add column if not exists handled_at timestamptz,
  add column if not exists handled_by uuid references public.profiles(id);

create index if not exists inq_created_idx on public.inquiries(created_at desc);
create index if not exists inq_open_idx    on public.inquiries(handled_at) where handled_at is null;

-- 조회·처리는 직원 이상. 접수(insert)는 기존대로 익명 허용.
drop policy if exists "inquiries staff read" on public.inquiries;
create policy "inquiries staff read" on public.inquiries
  for select using (public.is_staff());

drop policy if exists "inquiries staff update" on public.inquiries;
create policy "inquiries staff update" on public.inquiries
  for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists "inquiries admin delete" on public.inquiries;
create policy "inquiries admin delete" on public.inquiries
  for delete using (public.is_admin());

notify pgrst, 'reload schema';
