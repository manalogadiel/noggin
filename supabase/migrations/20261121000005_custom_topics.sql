-- Custom user-owned subjects and topics, owner-scoped RLS, topic access checks,
-- generation quota caps, and service-only catalog RPCs.
-- Reversible by dropping the new RPCs, restoring the prior save_follow_up_page,
-- topic_mastery view, and RLS policies, and removing the added columns/constraints/indexes.

-- 1. Subjects: owner_id (null = official, cascade on user deletion) and owner-scoped uniqueness
alter table public.subjects
  add column if not exists owner_id uuid references auth.users (id) on delete cascade;

alter table public.subjects
  drop constraint if exists subjects_slug_key;

alter table public.subjects
  add constraint subjects_owner_id_slug_key
  unique nulls not distinct (owner_id, slug);

create unique index if not exists subjects_owner_lower_name_idx
  on public.subjects (owner_id, lower(btrim(name)))
  nulls not distinct;

create index if not exists subjects_owner_id_idx
  on public.subjects (owner_id);

-- 2. Topics: owner-scoped uniqueness, cascade ownership, private/community defaults,
--    normalized ready/pending status, and cached question_count
alter table public.topics
  drop constraint if exists topics_subject_id_slug_key;

alter table public.topics
  add constraint topics_subject_id_owner_id_slug_key
  unique nulls not distinct (subject_id, owner_id, slug);

alter table public.topics
  drop constraint if exists topics_owner_id_fkey,
  add constraint topics_owner_id_fkey
    foreign key (owner_id) references auth.users (id) on delete cascade;

alter table public.topics
  alter column visibility set default 'private',
  alter column trust_level set default 'community',
  alter column status set default 'pending';

update public.topics
set status = 'ready'
where status = 'active';

alter table public.topics
  add constraint topics_owner_official_check
    check ((owner_id is null) = (trust_level = 'official' and visibility = 'public')),
  add constraint topics_status_check
    check (status in ('ready', 'pending'));

alter table public.topics
  add column if not exists question_count int not null default 0
    check (question_count >= 0);

update public.topics t
set question_count = coalesce((
  select count(*)::int
  from public.questions q
  where q.topic_id = t.id
    and q.status = 'active'
), 0);

create index if not exists topics_owner_id_idx
  on public.topics (owner_id);

-- 3. Plans: add daily "generate" cap (free: 5, plus: 20)
update public.plans
set caps = caps || jsonb_build_object(
  'generate',
  case code
    when 'free' then 5
    when 'plus' then 20
    else coalesce((caps ->> 'generate')::int, 5)
  end
)
where code in ('free', 'plus')
   or not (caps ? 'generate');

-- 4. Mastery view: join only official topics or topics owned by the Nog's owner
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
join public.topics t
  on t.subject_id = n.subject_id
 and (t.owner_id is null or t.owner_id = n.owner_id)
left join question_totals qt on qt.topic_id = t.id
left join latest_attempts la on la.nog_id = n.id and la.topic_id = t.id
group by n.id, t.id, qt.total;

revoke all on public.topic_mastery from anon, authenticated;
grant all on public.topic_mastery to service_role;

-- 5. RLS policies (SEC-T1 & SEC-T2)
drop policy if exists "subjects_select_available" on public.subjects;
drop policy if exists "topics_select_visible" on public.topics;

create policy "subjects_select_official_or_own"
  on public.subjects for select
  to anon, authenticated
  using (
    (owner_id is null and available = true)
    or owner_id = auth.uid()
  );

create policy "topics_select_official_or_own"
  on public.topics for select
  to anon, authenticated
  using (
    (owner_id is null and trust_level = 'official' and visibility = 'public')
    or owner_id = auth.uid()
  );

drop policy if exists "nogs_insert_own" on public.nogs;
create policy "nogs_insert_own"
  on public.nogs for insert
  to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1
      from public.subjects s
      where s.id = nogs.subject_id
        and (
          (s.owner_id is null and s.available = true)
          or s.owner_id = auth.uid()
        )
    )
  );

drop policy if exists "lessons_insert_own" on public.lessons;
create policy "lessons_insert_own"
  on public.lessons for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.nogs n
      join public.topics t
        on t.id = lessons.topic_id
       and t.subject_id = n.subject_id
      where n.id = lessons.nog_id
        and n.owner_id = auth.uid()
        and (t.owner_id is null or t.owner_id = auth.uid())
    )
  );

-- 6. Tighten save_follow_up_page to enforce topic ownership and subject match (SEC-T2)
create or replace function public.save_follow_up_page(
  p_nog_id uuid,
  p_parent_lesson_id uuid,
  p_topic_id uuid,
  p_body text,
  p_word_count int,
  p_idempotency_key text,
  p_max int,
  p_owner_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nog record;
  v_parent record;
  v_existing public.lessons%rowtype;
  v_inserted public.lessons%rowtype;
  v_count int;
begin
  if p_nog_id is null or p_parent_lesson_id is null or p_topic_id is null then
    raise exception 'nog_id, parent_lesson_id and topic_id are required';
  end if;

  if nullif(btrim(coalesce(p_idempotency_key, '')), '') is null
     or char_length(p_idempotency_key) > 255 then
    raise exception 'invalid idempotency_key';
  end if;

  if p_body is null or char_length(p_body) < 1 or char_length(p_body) > 2000 then
    raise exception 'invalid follow-up body length';
  end if;

  if p_word_count is null or p_word_count < 1 or p_word_count > 120 then
    raise exception 'invalid follow-up word count';
  end if;

  if p_max is null or p_max < 0 then
    raise exception 'invalid follow-up limit';
  end if;

  if p_owner_id is not null then
    select n.id, n.owner_id, n.subject_id
    into v_nog
    from public.nogs n
    where n.id = p_nog_id
      and n.owner_id = p_owner_id;

    if not found then
      raise exception 'nog % not found for owner', p_nog_id;
    end if;
  else
    select n.id, n.owner_id, n.subject_id
    into v_nog
    from public.nogs n
    where n.id = p_nog_id;

    if not found then
      raise exception 'nog % not found', p_nog_id;
    end if;
  end if;

  perform 1
  from public.topics t
  where t.id = p_topic_id
    and t.subject_id = v_nog.subject_id
    and (t.owner_id is null or t.owner_id = v_nog.owner_id);

  if not found then
    raise exception 'topic % is not accessible for nog %', p_topic_id, p_nog_id
      using errcode = '42501';
  end if;

  select l.id, l.topic_id, l.kind
  into v_parent
  from public.lessons l
  where l.id = p_parent_lesson_id
    and l.nog_id = p_nog_id
  for update;

  if not found then
    raise exception 'parent lesson % not found for nog %', p_parent_lesson_id, p_nog_id;
  end if;

  if v_parent.kind <> 'lesson' then
    raise exception 'parent lesson must be a root lesson';
  end if;

  if v_parent.topic_id <> p_topic_id then
    raise exception 'topic does not match parent lesson';
  end if;

  select l.*
  into v_existing
  from public.lessons l
  where l.nog_id = p_nog_id
    and l.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.kind = 'follow_up_answer'
       and v_existing.parent_lesson_id = p_parent_lesson_id
       and v_existing.topic_id = p_topic_id
       and v_existing.body = p_body then
      return jsonb_build_object('status', 'existing', 'page', to_jsonb(v_existing));
    end if;
    return jsonb_build_object('status', 'conflict');
  end if;

  select count(*)::int
  into v_count
  from public.lessons l
  where l.nog_id = p_nog_id
    and l.parent_lesson_id = p_parent_lesson_id
    and l.kind = 'follow_up_answer';

  if v_count >= p_max then
    return jsonb_build_object('status', 'limit_reached');
  end if;

  begin
    insert into public.lessons (
      nog_id,
      topic_id,
      body,
      word_count,
      kind,
      parent_lesson_id,
      idempotency_key
    )
    values (
      p_nog_id,
      p_topic_id,
      p_body,
      p_word_count,
      'follow_up_answer',
      p_parent_lesson_id,
      p_idempotency_key
    )
    returning * into v_inserted;
  exception when unique_violation then
    select l.*
    into v_existing
    from public.lessons l
    where l.nog_id = p_nog_id
      and l.idempotency_key = p_idempotency_key;

    if found
       and v_existing.kind = 'follow_up_answer'
       and v_existing.parent_lesson_id = p_parent_lesson_id
       and v_existing.topic_id = p_topic_id
       and v_existing.body = p_body then
      return jsonb_build_object('status', 'existing', 'page', to_jsonb(v_existing));
    end if;
    return jsonb_build_object('status', 'conflict');
  end;

  return jsonb_build_object('status', 'saved', 'page', to_jsonb(v_inserted));
end;
$$;

revoke execute on function public.save_follow_up_page(uuid, uuid, uuid, text, int, text, int, uuid) from public, anon, authenticated;
grant execute on function public.save_follow_up_page(uuid, uuid, uuid, text, int, text, int, uuid) to service_role;

-- 7. Service-only custom catalog RPCs (SEC-T3 & SEC-T5)
create or replace function public.create_user_subject(
  p_owner_id uuid,
  p_name text,
  p_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_slug text;
  v_subject public.subjects%rowtype;
begin
  if p_owner_id is null then
    raise exception 'owner_id is required' using errcode = '22023';
  end if;

  v_name := btrim(coalesce(p_name, ''));
  if char_length(v_name) < 1 or char_length(v_name) > 40 or v_name ~ '[[:cntrl:]]' then
    raise exception 'subject name must be 1 to 40 printable characters' using errcode = '22023';
  end if;

  v_slug := lower(btrim(coalesce(p_slug, '')));
  if char_length(v_slug) < 1 or char_length(v_slug) > 100 or v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'invalid subject slug' using errcode = '22023';
  end if;

  perform 1
  from auth.users u
  where u.id = p_owner_id;

  if not found then
    raise exception 'owner not found' using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.subjects s
    where s.owner_id = p_owner_id
      and lower(btrim(s.name)) = lower(v_name)
  ) then
    raise exception 'subject already exists for owner' using errcode = '23505';
  end if;

  insert into public.subjects (owner_id, slug, name, available)
  values (p_owner_id, v_slug, v_name, true)
  returning * into v_subject;

  return jsonb_build_object(
    'id', v_subject.id,
    'owner_id', v_subject.owner_id,
    'slug', v_subject.slug,
    'name', v_subject.name,
    'available', v_subject.available
  );
end;
$$;

revoke execute on function public.create_user_subject(uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_user_subject(uuid, text, text) to service_role;

create or replace function public.create_user_topic(
  p_owner_id uuid,
  p_subject_id uuid,
  p_title text,
  p_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_slug text;
  v_topic public.topics%rowtype;
begin
  if p_owner_id is null or p_subject_id is null then
    raise exception 'owner_id and subject_id are required' using errcode = '22023';
  end if;

  v_title := btrim(coalesce(p_title, ''));
  if char_length(v_title) < 1 or char_length(v_title) > 60 or v_title ~ '[[:cntrl:]]' then
    raise exception 'topic title must be 1 to 60 printable characters' using errcode = '22023';
  end if;

  v_slug := lower(btrim(coalesce(p_slug, '')));
  if char_length(v_slug) < 1 or char_length(v_slug) > 100 or v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'invalid topic slug' using errcode = '22023';
  end if;

  perform 1
  from auth.users u
  where u.id = p_owner_id;

  if not found then
    raise exception 'owner not found' using errcode = '23503';
  end if;

  perform 1
  from public.subjects s
  where s.id = p_subject_id
    and (
      (s.owner_id is null and s.available = true)
      or s.owner_id = p_owner_id
    );

  if not found then
    raise exception 'subject is not accessible for owner' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.topics t
    where t.subject_id = p_subject_id
      and t.owner_id is null
      and t.slug = v_slug
  ) then
    raise exception 'topic slug collides with an official topic' using errcode = '23505';
  end if;

  select t.*
  into v_topic
  from public.topics t
  where t.subject_id = p_subject_id
    and t.owner_id = p_owner_id
    and t.slug = v_slug
  for update;

  if found then
    if v_topic.status = 'pending' then
      return jsonb_build_object(
        'id', v_topic.id,
        'subject_id', v_topic.subject_id,
        'owner_id', v_topic.owner_id,
        'slug', v_topic.slug,
        'title', v_topic.title,
        'status', v_topic.status,
        'question_count', v_topic.question_count
      );
    end if;
    raise exception 'topic already exists for owner' using errcode = '23505';
  end if;

  begin
    insert into public.topics (
      subject_id,
      owner_id,
      slug,
      title,
      visibility,
      trust_level,
      language,
      status,
      question_count
    )
    values (
      p_subject_id,
      p_owner_id,
      v_slug,
      v_title,
      'private',
      'community',
      'en',
      'pending',
      0
    )
    returning * into v_topic;
  exception when unique_violation then
    select t.*
    into v_topic
    from public.topics t
    where t.subject_id = p_subject_id
      and t.owner_id = p_owner_id
      and t.slug = v_slug;

    if found and v_topic.status = 'pending' then
      return jsonb_build_object(
        'id', v_topic.id,
        'subject_id', v_topic.subject_id,
        'owner_id', v_topic.owner_id,
        'slug', v_topic.slug,
        'title', v_topic.title,
        'status', v_topic.status,
        'question_count', v_topic.question_count
      );
    end if;
    raise exception 'topic already exists for owner' using errcode = '23505';
  end;

  return jsonb_build_object(
    'id', v_topic.id,
    'subject_id', v_topic.subject_id,
    'owner_id', v_topic.owner_id,
    'slug', v_topic.slug,
    'title', v_topic.title,
    'status', v_topic.status,
    'question_count', v_topic.question_count
  );
end;
$$;

revoke execute on function public.create_user_topic(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_user_topic(uuid, uuid, text, text) to service_role;

create or replace function public.save_generated_questions(
  p_owner_id uuid,
  p_topic_id uuid,
  p_questions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_topic public.topics%rowtype;
  v_question jsonb;
  v_idx int := 0;
  v_position int;
  v_prompt text;
  v_reference_answer text;
  v_source_excerpt text;
  v_concepts_json jsonb;
  v_concept_elem jsonb;
  v_concept_text text;
  v_concepts text[];
begin
  if p_owner_id is null or p_topic_id is null then
    raise exception 'owner_id and topic_id are required' using errcode = '22023';
  end if;

  if p_questions is null or jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) <> 8 then
    raise exception 'exactly 8 questions are required' using errcode = '22023';
  end if;

  select t.*
  into v_topic
  from public.topics t
  where t.id = p_topic_id
    and t.owner_id = p_owner_id
  for update;

  if not found then
    raise exception 'topic % not found for owner', p_topic_id using errcode = '42501';
  end if;

  if v_topic.status <> 'pending' then
    raise exception 'topic % is already ready', p_topic_id using errcode = '23505';
  end if;

  for v_question in select value from jsonb_array_elements(p_questions)
  loop
    v_idx := v_idx + 1;

    if jsonb_typeof(v_question) <> 'object' then
      raise exception 'each question must be a JSON object' using errcode = '22023';
    end if;

    if v_question ? 'position' and v_question -> 'position' <> 'null'::jsonb then
      if jsonb_typeof(v_question -> 'position') <> 'number' then
        raise exception 'question position must be an integer' using errcode = '22023';
      end if;
      v_position := (v_question ->> 'position')::int;
    else
      v_position := v_idx;
    end if;

    if v_position < 1 or v_position > 8 then
      raise exception 'question position must be between 1 and 8' using errcode = '22023';
    end if;

    v_prompt := btrim(coalesce(v_question ->> 'prompt', ''));
    v_reference_answer := btrim(coalesce(v_question ->> 'reference_answer', ''));
    v_source_excerpt := btrim(coalesce(v_question ->> 'source_excerpt', ''));

    if char_length(v_prompt) < 1 or char_length(v_prompt) > 240 then
      raise exception 'invalid question prompt length' using errcode = '22023';
    end if;
    if char_length(v_reference_answer) < 1 or char_length(v_reference_answer) > 400 then
      raise exception 'invalid reference_answer length' using errcode = '22023';
    end if;
    if char_length(v_source_excerpt) < 1 or char_length(v_source_excerpt) > 500 then
      raise exception 'invalid source_excerpt length' using errcode = '22023';
    end if;

    v_concepts_json := v_question -> 'key_concepts';
    if v_concepts_json is null or jsonb_typeof(v_concepts_json) <> 'array' then
      raise exception 'key_concepts must be an array' using errcode = '22023';
    end if;

    if jsonb_array_length(v_concepts_json) < 2 or jsonb_array_length(v_concepts_json) > 4 then
      raise exception 'each question must have 2 to 4 key concepts' using errcode = '22023';
    end if;

    v_concepts := array[]::text[];
    for v_concept_elem in select value from jsonb_array_elements(v_concepts_json)
    loop
      if jsonb_typeof(v_concept_elem) <> 'string' then
        raise exception 'each key concept must be a string' using errcode = '22023';
      end if;
      v_concept_text := btrim(v_concept_elem #>> '{}');
      if char_length(v_concept_text) < 1 or char_length(v_concept_text) > 80 then
        raise exception 'invalid key concept length' using errcode = '22023';
      end if;
      v_concepts := array_append(v_concepts, v_concept_text);
    end loop;

    insert into public.questions (
      topic_id,
      position,
      prompt,
      reference_answer,
      key_concepts,
      source_excerpt,
      status
    )
    values (
      p_topic_id,
      v_position,
      v_prompt,
      v_reference_answer,
      v_concepts,
      v_source_excerpt,
      'active'
    );
  end loop;

  update public.topics
  set
    status = 'ready',
    question_count = 8
  where id = p_topic_id
  returning * into v_topic;

  return jsonb_build_object(
    'id', v_topic.id,
    'subject_id', v_topic.subject_id,
    'owner_id', v_topic.owner_id,
    'slug', v_topic.slug,
    'title', v_topic.title,
    'status', v_topic.status,
    'question_count', v_topic.question_count
  );
end;
$$;

revoke execute on function public.save_generated_questions(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_generated_questions(uuid, uuid, jsonb) to service_role;
