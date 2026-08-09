-- 삼성흉부외과 대전 — 동시 수정 잠금
-- Supabase SQL Editor 에 그대로 붙여넣어 실행
--
-- 두 사람이 같은 예약을 동시에 고치면 나중에 저장한 쪽이 앞사람 입력을 말없이 덮는다.
-- 잠금으로 애초에 못 들어가게 막고, 잠금이 만료된 틈을 대비해 저장 시점에
-- updated_at 을 한 번 더 대조한다(잠금만으로는 만료 경합을 못 막는다).

create table if not exists public.edit_locks (
  entity     text not null,                 -- 'appointments' 등
  entity_id  text not null,
  actor      uuid not null references public.profiles(id) on delete cascade,
  actor_name text not null default '',
  acquired_at timestamptz not null default now(),
  expires_at  timestamptz not null,
  primary key (entity, entity_id)
);
create index if not exists lock_expires_idx on public.edit_locks(expires_at);

-- 잠금 획득. 비어 있거나 · 내 것이거나 · 만료된 것이면 가져온다.
-- 남의 유효한 잠금이면 그 사람 이름을 돌려줘 화면에 그대로 띄운다.
create or replace function public.acquire_lock(
  p_entity text, p_id text, p_minutes int default 3
) returns table (ok boolean, holder text, until timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_name text;
  v_cur  public.edit_locks%rowtype;
begin
  if not public.is_staff() then raise exception '권한 없음'; end if;

  select coalesce(nullif(name,''), email, '직원') into v_name
  from public.profiles where id = v_uid;

  delete from public.edit_locks where expires_at < now();

  select * into v_cur from public.edit_locks
  where entity = p_entity and entity_id = p_id for update;

  if found and v_cur.actor <> v_uid then
    return query select false, v_cur.actor_name, v_cur.expires_at;
    return;
  end if;

  insert into public.edit_locks (entity, entity_id, actor, actor_name, expires_at)
  values (p_entity, p_id, v_uid, coalesce(v_name,'직원'), now() + make_interval(mins => p_minutes))
  on conflict (entity, entity_id) do update
    set actor = excluded.actor,
        actor_name = excluded.actor_name,
        acquired_at = now(),
        expires_at = excluded.expires_at;

  return query select true, coalesce(v_name,'직원'), now() + make_interval(mins => p_minutes);
end $$;

-- 해제 — 내 잠금만 푼다(남의 것을 임의로 풀면 잠금이 의미가 없다)
create or replace function public.release_lock(p_entity text, p_id text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not public.is_staff() then raise exception '권한 없음'; end if;
  delete from public.edit_locks
   where entity = p_entity and entity_id = p_id and actor = v_uid;
  return true;
end $$;

-- 저장 직전 확인 — 남이 잡고 있으면 거절한다
create or replace function public.lock_is_mine(p_entity text, p_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.edit_locks
    where entity = p_entity and entity_id = p_id
      and actor <> auth.uid() and expires_at > now()
  );
$$;

alter table public.edit_locks enable row level security;

drop policy if exists "locks staff read" on public.edit_locks;
create policy "locks staff read" on public.edit_locks
  for select using (public.is_staff());

-- 쓰기는 RPC(security definer)로만 한다. 직접 insert/delete 는 열지 않는다.
drop policy if exists "locks no direct write" on public.edit_locks;
create policy "locks no direct write" on public.edit_locks
  for all using (false) with check (false);

notify pgrst, 'reload schema';
