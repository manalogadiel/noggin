create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create table public.plans (
  code text primary key,
  name text not null,
  caps jsonb not null
);

create table public.app_config (
  key text primary key,
  value jsonb not null
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  birth_date date not null,
  guardian_consent_status text not null default 'not_required'
    check (guardian_consent_status in ('not_required', 'pending', 'granted')),
  guardian_consent_at timestamptz,
  grill_mode text not null default 'roast'
    check (grill_mode in ('roast', 'gentle')),
  settings jsonb not null default '{}'::jsonb,
  plan_code text not null default 'free' references public.plans (code),
  timezone text not null default 'Asia/Manila',
  created_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  available boolean not null default true
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  slug text not null,
  title text not null,
  owner_id uuid references auth.users (id) on delete set null,
  visibility text not null default 'public'
    check (visibility in ('private', 'public')),
  trust_level text not null default 'official'
    check (trust_level in ('official', 'community')),
  language text not null default 'en',
  status text not null default 'active',
  unique (subject_id, slug)
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id) on delete cascade,
  kind text not null check (kind in ('official', 'paste', 'pdf', 'link', 'image')),
  url text,
  title text,
  body text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id) on delete cascade,
  source_id uuid references public.sources (id) on delete set null,
  position int not null,
  prompt text not null,
  reference_answer text not null,
  key_concepts text[] not null check (cardinality(key_concepts) between 2 and 4),
  source_excerpt text not null,
  status text not null default 'active',
  unique (topic_id, position)
);

create table public.nogs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null references public.subjects (id),
  name text not null check (char_length(name) between 1 and 24),
  stage text not null default 'hatchling'
    check (stage in ('hatchling', 'sprout', 'scholar', 'genius')),
  mood text not null default 'happy',
  happiness int not null default 70 check (happiness between 0 and 100),
  happiness_today int not null default 0 check (happiness_today >= 0),
  happiness_day date,
  last_care_at timestamptz not null default now(),
  colors jsonb not null default '{}'::jsonb,
  accessories jsonb not null default '[]'::jsonb,
  speech_style jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (owner_id, subject_id)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  nog_id uuid not null references public.nogs (id) on delete cascade,
  topic_id uuid not null references public.topics (id),
  body text not null check (char_length(body) between 1 and 2000),
  word_count int not null check (word_count between 1 and 120),
  kind text not null default 'lesson'
    check (kind in ('lesson', 'follow_up_answer')),
  parent_lesson_id uuid references public.lessons (id) on delete set null,
  idempotency_key text not null,
  copy_ratio real,
  credited boolean not null default true,
  digest_status text not null default 'pending'
    check (digest_status in ('pending', 'done', 'failed')),
  created_at timestamptz not null default now(),
  unique (nog_id, idempotency_key)
);

create table public.thought_cards (
  id uuid primary key default gen_random_uuid(),
  nog_id uuid not null references public.nogs (id) on delete cascade,
  topic_id uuid not null references public.topics (id),
  label text not null check (char_length(label) <= 80),
  paraphrase text not null check (char_length(paraphrase) <= 280),
  status text not null check (status in ('understood', 'shaky', 'confused')),
  strength int not null default 1 check (strength >= 0),
  interval_days int not null default 1 check (interval_days >= 1),
  next_review_at timestamptz not null default (now() + interval '1 day'),
  source_lesson_id uuid not null references public.lessons (id) on delete cascade,
  quote text not null check (char_length(quote) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index thought_cards_label_trgm_idx
  on public.thought_cards
  using gin (label extensions.gin_trgm_ops);

create index thought_cards_nog_topic_idx
  on public.thought_cards (nog_id, topic_id);

create table public.nog_messages (
  id uuid primary key default gen_random_uuid(),
  nog_id uuid not null references public.nogs (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete set null,
  role text not null check (role in ('nog', 'student')),
  kind text not null check (kind in ('reply', 'question', 'answer', 'reaction')),
  body text not null check (char_length(body) <= 600),
  mood text,
  created_at timestamptz not null default now()
);

create index nog_messages_nog_created_idx
  on public.nog_messages (nog_id, created_at desc);

create table public.check_attempts (
  id uuid primary key default gen_random_uuid(),
  nog_id uuid not null references public.nogs (id) on delete cascade,
  question_id uuid not null references public.questions (id),
  nog_answer text not null,
  concepts jsonb not null,
  correct boolean not null,
  notebook_fingerprint text not null,
  model text,
  prompt_version text,
  created_at timestamptz not null default now()
);

create index check_attempts_nog_question_created_idx
  on public.check_attempts (nog_id, question_id, created_at desc);

create table public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  amount int not null check (amount > 0),
  model text,
  created_at timestamptz not null default now()
);

create index usage_events_user_kind_created_idx
  on public.usage_events (user_id, kind, created_at);

create table public.voice_cache (
  text_hash text primary key,
  storage_path text not null,
  voice_model text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create or replace view public.topic_mastery
with (security_invoker = true) as
with latest_attempts as (
  select distinct on (ca.nog_id, ca.question_id)
    ca.nog_id,
    ca.question_id,
    ca.correct,
    q.topic_id
  from public.check_attempts ca
  join public.questions q on q.id = ca.question_id
  where q.status = 'active'
  order by ca.nog_id, ca.question_id, ca.created_at desc, ca.id desc
),
question_totals as (
  select topic_id, count(*)::int as total
  from public.questions
  where status = 'active'
  group by topic_id
)
select
  n.id as nog_id,
  t.id as topic_id,
  coalesce(count(la.question_id) filter (where la.correct), 0)::int as mastered,
  coalesce(qt.total, 0)::int as total
from public.nogs n
join public.topics t on t.subject_id = n.subject_id
left join question_totals qt on qt.topic_id = t.id
left join latest_attempts la on la.nog_id = n.id and la.topic_id = t.id
group by n.id, t.id, qt.total;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_raw_birth_date text;
  v_birth_date date;
  v_age int;
  v_consent_status text;
  v_display_name text;
begin
  v_raw_birth_date := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'birth_date', '')), '');
  if v_raw_birth_date is null then
    raise exception 'birth_date is required' using errcode = '22023';
  end if;

  v_birth_date := v_raw_birth_date::date;
  if v_birth_date > current_date then
    raise exception 'birth_date cannot be in the future' using errcode = '22023';
  end if;

  v_age := extract(year from age(current_date, v_birth_date))::int;
  if v_age < 16 then
    raise exception 'users must be at least 16 years old' using errcode = '22023';
  end if;

  v_consent_status := case when v_age < 18 then 'pending' else 'not_required' end;
  v_display_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');

  insert into public.profiles (id, display_name, birth_date, guardian_consent_status)
  values (new.id, v_display_name, v_birth_date, v_consent_status);

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Enable row level security on every public table (default deny)
alter table public.plans enable row level security;
alter table public.app_config enable row level security;
alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.sources enable row level security;
alter table public.questions enable row level security;
alter table public.nogs enable row level security;
alter table public.lessons enable row level security;
alter table public.thought_cards enable row level security;
alter table public.nog_messages enable row level security;
alter table public.check_attempts enable row level security;
alter table public.usage_events enable row level security;
alter table public.voice_cache enable row level security;

-- Lock down client table and column privileges
revoke all on public.plans from anon, authenticated;
revoke all on public.app_config from anon, authenticated;
revoke all on public.profiles from anon, authenticated;
revoke all on public.subjects from anon, authenticated;
revoke all on public.topics from anon, authenticated;
revoke all on public.sources from anon, authenticated;
revoke all on public.questions from anon, authenticated;
revoke all on public.nogs from anon, authenticated;
revoke all on public.lessons from anon, authenticated;
revoke all on public.thought_cards from anon, authenticated;
revoke all on public.nog_messages from anon, authenticated;
revoke all on public.check_attempts from anon, authenticated;
revoke all on public.usage_events from anon, authenticated;
revoke all on public.voice_cache from anon, authenticated;
revoke all on public.topic_mastery from anon, authenticated;

grant select on public.plans to authenticated;
grant select on public.app_config to authenticated;
grant select on public.subjects to anon, authenticated;
grant select on public.topics to anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, grill_mode, settings, timezone) on public.profiles to authenticated;

grant select on public.nogs to authenticated;
grant insert (subject_id, name, colors, accessories) on public.nogs to authenticated;
grant update (name, colors, accessories) on public.nogs to authenticated;

grant select on public.lessons to authenticated;
grant insert (nog_id, topic_id, body, word_count, kind, parent_lesson_id, idempotency_key)
  on public.lessons to authenticated;

grant select on public.thought_cards to authenticated;
grant select on public.nog_messages to authenticated;
grant select on public.check_attempts to authenticated;

grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Client RLS policies
create policy "plans_select_authenticated"
  on public.plans for select
  to authenticated
  using (true);

create policy "app_config_select_authenticated"
  on public.app_config for select
  to authenticated
  using (true);

create policy "subjects_select_available"
  on public.subjects for select
  to anon, authenticated
  using (available = true);

create policy "topics_select_visible"
  on public.topics for select
  to anon, authenticated
  using (visibility = 'public' or owner_id = auth.uid());

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "nogs_select_own"
  on public.nogs for select
  to authenticated
  using (owner_id = auth.uid());

create policy "nogs_insert_own"
  on public.nogs for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "nogs_update_own"
  on public.nogs for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "lessons_select_own"
  on public.lessons for select
  to authenticated
  using (
    exists (
      select 1
      from public.nogs n
      where n.id = lessons.nog_id
        and n.owner_id = auth.uid()
    )
  );

create policy "lessons_insert_own"
  on public.lessons for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.nogs n
      where n.id = lessons.nog_id
        and n.owner_id = auth.uid()
    )
  );

create policy "thought_cards_select_own"
  on public.thought_cards for select
  to authenticated
  using (
    exists (
      select 1
      from public.nogs n
      where n.id = thought_cards.nog_id
        and n.owner_id = auth.uid()
    )
  );

create policy "nog_messages_select_own"
  on public.nog_messages for select
  to authenticated
  using (
    exists (
      select 1
      from public.nogs n
      where n.id = nog_messages.nog_id
        and n.owner_id = auth.uid()
    )
  );

create policy "check_attempts_select_own"
  on public.check_attempts for select
  to authenticated
  using (
    exists (
      select 1
      from public.nogs n
      where n.id = check_attempts.nog_id
        and n.owner_id = auth.uid()
    )
  );
