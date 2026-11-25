-- Player economy state, coin ledger audit trail, and atomic coin/preference RPCs.
-- Reversible by dropping the RPCs and dropping public.coin_ledger / public.player_economy.

create table if not exists public.player_economy (
  user_id uuid primary key references auth.users (id) on delete cascade,
  coins int not null default 240 check (coins >= 0),
  level int not null default 1 check (level >= 1),
  xp int not null default 0 check (xp >= 0),
  xp_max int not null default 1000 check (xp_max > 0),
  streak_days int not null default 0 check (streak_days >= 0),
  streak_restores int not null default 1 check (streak_restores between 0 and 2),
  streak_missed_days int not null default 0 check (streak_missed_days >= 0),
  last_study_date date,
  active_room_bg text not null default 'day'
    check (active_room_bg in ('day', 'minimal', 'greenhouse', 'treehouse', 'night')),
  owned_rooms jsonb not null default '{"day":true,"minimal":true,"greenhouse":false,"treehouse":false,"night":false}'::jsonb,
  owned_skin_packs jsonb not null default '{"pastel":true,"neon":false,"dark":false,"sunset":false}'::jsonb,
  active_skin_pack text not null default 'pastel'
    check (active_skin_pack in ('pastel', 'neon', 'dark', 'sunset')),
  owned_accessories jsonb not null default '{"glasses":true,"beanie":true,"bow":false,"gradcap":false}'::jsonb,
  equipped_slots jsonb not null default '["glasses",null,null,null]'::jsonb,
  claimed_tasks jsonb not null default '{}'::jsonb,
  notebook_prefs jsonb not null default '{}'::jsonb,
  audio_prefs jsonb not null default '{"music":70,"sfx":85,"voice":90}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.coin_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  delta int not null check (delta <> 0),
  reason text not null check (char_length(reason) between 1 and 80),
  item_ref text,
  balance_after int not null check (balance_after >= 0),
  created_at timestamptz not null default now()
);

create index if not exists coin_ledger_user_created_idx
  on public.coin_ledger (user_id, created_at desc);

alter table public.player_economy enable row level security;
alter table public.coin_ledger enable row level security;

drop policy if exists player_economy_select_own on public.player_economy;
create policy player_economy_select_own
  on public.player_economy
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists coin_ledger_select_own on public.coin_ledger;
create policy coin_ledger_select_own
  on public.coin_ledger
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.get_or_init_player_economy()
returns public.player_economy
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.player_economy;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.player_economy (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select *
  into v_row
  from public.player_economy
  where user_id = v_user_id;

  return v_row;
end;
$$;

create or replace function public.apply_coin_transaction(
  p_delta int,
  p_reason text,
  p_item_ref text default null,
  p_patch jsonb default '{}'::jsonb
)
returns public.player_economy
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.player_economy;
  v_next_coins int;
  v_patch jsonb := coalesce(p_patch, '{}'::jsonb);
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_delta is null or p_delta = 0 then
    raise exception 'p_delta must be non-zero';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'p_reason is required';
  end if;

  if jsonb_typeof(v_patch) <> 'object' then
    raise exception 'p_patch must be a JSON object';
  end if;

  insert into public.player_economy (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select *
  into v_row
  from public.player_economy
  where user_id = v_user_id
  for update;

  v_next_coins := v_row.coins + p_delta;
  if v_next_coins < 0 then
    raise exception 'Insufficient coins';
  end if;

  update public.player_economy
  set
    coins = v_next_coins,
    level = coalesce((v_patch ->> 'level')::int, v_row.level),
    xp = coalesce((v_patch ->> 'xp')::int, v_row.xp),
    xp_max = coalesce((v_patch ->> 'xp_max')::int, v_row.xp_max),
    streak_days = coalesce((v_patch ->> 'streak_days')::int, v_row.streak_days),
    streak_restores = coalesce((v_patch ->> 'streak_restores')::int, v_row.streak_restores),
    streak_missed_days = coalesce((v_patch ->> 'streak_missed_days')::int, v_row.streak_missed_days),
    last_study_date = coalesce((v_patch ->> 'last_study_date')::date, v_row.last_study_date),
    active_room_bg = coalesce(v_patch ->> 'active_room_bg', v_row.active_room_bg),
    owned_rooms = case when v_patch ? 'owned_rooms' then v_patch -> 'owned_rooms' else v_row.owned_rooms end,
    owned_skin_packs = case when v_patch ? 'owned_skin_packs' then v_patch -> 'owned_skin_packs' else v_row.owned_skin_packs end,
    active_skin_pack = coalesce(v_patch ->> 'active_skin_pack', v_row.active_skin_pack),
    owned_accessories = case when v_patch ? 'owned_accessories' then v_patch -> 'owned_accessories' else v_row.owned_accessories end,
    equipped_slots = case when v_patch ? 'equipped_slots' then v_patch -> 'equipped_slots' else v_row.equipped_slots end,
    claimed_tasks = case when v_patch ? 'claimed_tasks' then v_patch -> 'claimed_tasks' else v_row.claimed_tasks end,
    notebook_prefs = case when v_patch ? 'notebook_prefs' then v_patch -> 'notebook_prefs' else v_row.notebook_prefs end,
    audio_prefs = case when v_patch ? 'audio_prefs' then v_patch -> 'audio_prefs' else v_row.audio_prefs end,
    updated_at = now()
  where user_id = v_user_id
  returning * into v_row;

  insert into public.coin_ledger (user_id, delta, reason, item_ref, balance_after)
  values (v_user_id, p_delta, left(btrim(p_reason), 80), p_item_ref, v_next_coins);

  return v_row;
end;
$$;

create or replace function public.save_player_economy_prefs(
  p_patch jsonb
)
returns public.player_economy
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.player_economy;
  v_patch jsonb := coalesce(p_patch, '{}'::jsonb);
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if jsonb_typeof(v_patch) <> 'object' then
    raise exception 'p_patch must be a JSON object';
  end if;

  insert into public.player_economy (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select *
  into v_row
  from public.player_economy
  where user_id = v_user_id
  for update;

  update public.player_economy
  set
    active_room_bg = coalesce(v_patch ->> 'active_room_bg', v_row.active_room_bg),
    active_skin_pack = coalesce(v_patch ->> 'active_skin_pack', v_row.active_skin_pack),
    equipped_slots = case when v_patch ? 'equipped_slots' then v_patch -> 'equipped_slots' else v_row.equipped_slots end,
    notebook_prefs = case when v_patch ? 'notebook_prefs' then v_patch -> 'notebook_prefs' else v_row.notebook_prefs end,
    audio_prefs = case when v_patch ? 'audio_prefs' then v_patch -> 'audio_prefs' else v_row.audio_prefs end,
    streak_restores = coalesce((v_patch ->> 'streak_restores')::int, v_row.streak_restores),
    streak_missed_days = coalesce((v_patch ->> 'streak_missed_days')::int, v_row.streak_missed_days),
    streak_days = coalesce((v_patch ->> 'streak_days')::int, v_row.streak_days),
    last_study_date = coalesce((v_patch ->> 'last_study_date')::date, v_row.last_study_date),
    updated_at = now()
  where user_id = v_user_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.get_or_init_player_economy() from public;
grant execute on function public.get_or_init_player_economy() to authenticated;

revoke all on function public.apply_coin_transaction(int, text, text, jsonb) from public;
grant execute on function public.apply_coin_transaction(int, text, text, jsonb) to authenticated;

revoke all on function public.save_player_economy_prefs(jsonb) from public;
grant execute on function public.save_player_economy_prefs(jsonb) to authenticated;

grant select on public.player_economy to authenticated;
grant select on public.coin_ledger to authenticated;
