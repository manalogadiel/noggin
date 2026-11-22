-- Card memory: every lesson that taught a card is kept as evidence, a repeat lesson can
-- strengthen a card, the Nog's cards are searchable, and free-form questions are stored
-- as ask history.

create table public.card_evidence (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.thought_cards (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  quote text not null check (char_length(quote) between 1 and 300),
  kind text not null check (kind in ('taught', 'reinforced', 'merged', 'conflict')),
  created_at timestamptz not null default now(),
  unique (card_id, lesson_id, kind)
);

create index card_evidence_card_idx on public.card_evidence (card_id, created_at);
create index card_evidence_lesson_idx on public.card_evidence (lesson_id);

alter table public.card_evidence enable row level security;
revoke all on public.card_evidence from anon, authenticated;
grant select on public.card_evidence to authenticated;
grant select, insert, update, delete on public.card_evidence to service_role;

create policy "card_evidence_select_own"
  on public.card_evidence for select
  to authenticated
  using (
    exists (
      select 1
      from public.thought_cards tc
      join public.nogs n on n.id = tc.nog_id
      where tc.id = card_evidence.card_id
        and n.owner_id = auth.uid()
    )
  );

insert into public.card_evidence (card_id, lesson_id, quote, kind, created_at)
select tc.id, tc.source_lesson_id, tc.quote, 'taught', tc.created_at
from public.thought_cards tc
on conflict (card_id, lesson_id, kind) do nothing;

create index thought_cards_search_idx
  on public.thought_cards
  using gin (to_tsvector('simple'::regconfig, label || ' ' || paraphrase));

create index thought_cards_paraphrase_trgm_idx
  on public.thought_cards
  using gin (paraphrase extensions.gin_trgm_ops);

alter table public.nog_messages drop constraint if exists nog_messages_kind_check;
alter table public.nog_messages
  add constraint nog_messages_kind_check
  check (kind in ('reply', 'question', 'answer', 'reaction', 'ask', 'ask_answer'));

create or replace function public.apply_lesson_digest(
  p_nog_id uuid,
  p_idempotency_key text,
  p_ops jsonb,
  p_messages jsonb,
  p_digest jsonb default null,
  p_owner_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lesson record;
  v_op jsonb;
  v_msg jsonb;
  v_op_type text;
  v_card_id uuid;
  v_card_ids uuid[] := array[]::uuid[];
  v_label text;
  v_paraphrase text;
  v_status text;
  v_quote text;
  v_role text;
  v_kind text;
  v_body text;
  v_mood text;
  v_evidence_id uuid;
begin
  if p_nog_id is null or nullif(btrim(coalesce(p_idempotency_key, '')), '') is null then
    raise exception 'nog_id and idempotency_key are required';
  end if;

  if p_owner_id is not null then
    perform 1
    from public.nogs n
    where n.id = p_nog_id
      and n.owner_id = p_owner_id;

    if not found then
      raise exception 'nog % not found for owner', p_nog_id;
    end if;
  end if;

  select l.id, l.topic_id, l.digest_status, l.digest, l.digest_card_ids
  into v_lesson
  from public.lessons l
  where l.nog_id = p_nog_id
    and l.idempotency_key = p_idempotency_key
  for update;

  if not found then
    raise exception 'lesson not found for nog %', p_nog_id;
  end if;

  if v_lesson.digest_status = 'done' then
    return jsonb_build_object(
      'applied', false,
      'card_ids', to_jsonb(coalesce(v_lesson.digest_card_ids, array[]::uuid[])),
      'saved_digest', v_lesson.digest
    );
  end if;

  if p_ops is not null and jsonb_typeof(p_ops) <> 'array' then
    raise exception 'p_ops must be a JSON array';
  end if;

  if p_messages is not null and jsonb_typeof(p_messages) <> 'array' then
    raise exception 'p_messages must be a JSON array';
  end if;

  if p_digest is not null then
    if jsonb_typeof(p_digest) <> 'object' then
      raise exception 'p_digest must be a JSON object';
    end if;
    if octet_length(p_digest::text) > 32768 then
      raise exception 'p_digest exceeds maximum allowed size';
    end if;
  end if;

  for v_op in select value from jsonb_array_elements(coalesce(p_ops, '[]'::jsonb))
  loop
    if jsonb_typeof(v_op) <> 'object' then
      raise exception 'each digest operation must be a JSON object';
    end if;

    v_op_type := v_op ->> 'type';

    if v_op_type = 'create' then
      v_label := v_op ->> 'label';
      v_paraphrase := v_op ->> 'paraphrase';
      v_status := coalesce(v_op ->> 'status', 'understood');
      v_quote := v_op ->> 'quote';

      if v_label is null or char_length(v_label) = 0 or char_length(v_label) > 80 then
        raise exception 'invalid card label length';
      end if;
      if v_paraphrase is null or char_length(v_paraphrase) = 0 or char_length(v_paraphrase) > 280 then
        raise exception 'invalid card paraphrase length';
      end if;
      if v_quote is null or char_length(v_quote) = 0 or char_length(v_quote) > 300 then
        raise exception 'invalid card quote length';
      end if;
      if v_status not in ('understood', 'shaky', 'confused') then
        raise exception 'invalid card status: %', v_status;
      end if;

      insert into public.thought_cards (
        nog_id,
        topic_id,
        label,
        paraphrase,
        status,
        source_lesson_id,
        quote
      )
      values (
        p_nog_id,
        v_lesson.topic_id,
        v_label,
        v_paraphrase,
        v_status,
        v_lesson.id,
        v_quote
      )
      returning id into v_card_id;

      insert into public.card_evidence (card_id, lesson_id, quote, kind)
      values (v_card_id, v_lesson.id, v_quote, 'taught')
      on conflict (card_id, lesson_id, kind) do nothing;

      v_card_ids := array_append(v_card_ids, v_card_id);

    elsif v_op_type = 'update' then
      if nullif(btrim(coalesce(v_op ->> 'card_id', '')), '') is null then
        raise exception 'card_id is required for update';
      end if;
      v_card_id := (v_op ->> 'card_id')::uuid;
      v_label := v_op ->> 'label';
      v_paraphrase := v_op ->> 'paraphrase';
      v_status := v_op ->> 'status';
      v_quote := v_op ->> 'quote';

      if v_label is not null and (char_length(v_label) = 0 or char_length(v_label) > 80) then
        raise exception 'invalid card label length';
      end if;
      if v_paraphrase is not null and (char_length(v_paraphrase) = 0 or char_length(v_paraphrase) > 280) then
        raise exception 'invalid card paraphrase length';
      end if;
      if v_quote is not null and (char_length(v_quote) = 0 or char_length(v_quote) > 300) then
        raise exception 'invalid card quote length';
      end if;
      if v_status is not null and v_status not in ('understood', 'shaky', 'confused') then
        raise exception 'invalid card status: %', v_status;
      end if;

      update public.thought_cards tc
      set
        label = coalesce(v_label, tc.label),
        paraphrase = coalesce(v_paraphrase, tc.paraphrase),
        status = coalesce(v_status, tc.status),
        quote = coalesce(v_quote, tc.quote),
        updated_at = now()
      where tc.id = v_card_id
        and tc.nog_id = p_nog_id
        and tc.topic_id = v_lesson.topic_id;

      if not found then
        raise exception 'thought card % does not belong to nog %', v_card_id, p_nog_id;
      end if;

      if v_quote is not null then
        insert into public.card_evidence (card_id, lesson_id, quote, kind)
        values (v_card_id, v_lesson.id, v_quote, 'merged')
        on conflict (card_id, lesson_id, kind) do nothing;
      end if;

      v_card_ids := array_append(v_card_ids, v_card_id);

    elsif v_op_type = 'conflict' then
      if nullif(btrim(coalesce(v_op ->> 'card_id', '')), '') is null then
        raise exception 'card_id is required for conflict';
      end if;
      v_card_id := (v_op ->> 'card_id')::uuid;
      v_paraphrase := v_op ->> 'paraphrase';
      v_quote := v_op ->> 'quote';

      if v_paraphrase is not null and (char_length(v_paraphrase) = 0 or char_length(v_paraphrase) > 280) then
        raise exception 'invalid card paraphrase length';
      end if;
      if v_quote is not null and (char_length(v_quote) = 0 or char_length(v_quote) > 300) then
        raise exception 'invalid card quote length';
      end if;

      update public.thought_cards tc
      set
        status = 'confused',
        paraphrase = coalesce(v_paraphrase, tc.paraphrase),
        quote = coalesce(v_quote, tc.quote),
        updated_at = now()
      where tc.id = v_card_id
        and tc.nog_id = p_nog_id
        and tc.topic_id = v_lesson.topic_id;

      if not found then
        raise exception 'thought card % does not belong to nog %', v_card_id, p_nog_id;
      end if;

      if v_quote is not null then
        insert into public.card_evidence (card_id, lesson_id, quote, kind)
        values (v_card_id, v_lesson.id, v_quote, 'conflict')
        on conflict (card_id, lesson_id, kind) do nothing;
      end if;

      v_card_ids := array_append(v_card_ids, v_card_id);

    elsif v_op_type = 'reinforce' then
      if nullif(btrim(coalesce(v_op ->> 'card_id', '')), '') is null then
        raise exception 'card_id is required for reinforce';
      end if;
      v_card_id := (v_op ->> 'card_id')::uuid;
      v_status := v_op ->> 'status';
      v_quote := v_op ->> 'quote';

      if v_quote is null or char_length(v_quote) = 0 or char_length(v_quote) > 300 then
        raise exception 'invalid card quote length';
      end if;
      if v_status is not null and v_status not in ('understood', 'shaky', 'confused') then
        raise exception 'invalid card status: %', v_status;
      end if;

      perform 1
      from public.thought_cards tc
      where tc.id = v_card_id
        and tc.nog_id = p_nog_id
        and tc.topic_id = v_lesson.topic_id
      for update;

      if not found then
        raise exception 'thought card % does not belong to nog %', v_card_id, p_nog_id;
      end if;

      -- One lesson strengthens a card at most once.
      v_evidence_id := null;
      insert into public.card_evidence (card_id, lesson_id, quote, kind)
      values (v_card_id, v_lesson.id, v_quote, 'reinforced')
      on conflict (card_id, lesson_id, kind) do nothing
      returning id into v_evidence_id;

      update public.thought_cards tc
      set
        strength = tc.strength + case when v_evidence_id is null then 0 else 1 end,
        status = coalesce(v_status, tc.status),
        updated_at = now()
      where tc.id = v_card_id;

      v_card_ids := array_append(v_card_ids, v_card_id);

    else
      raise exception 'unsupported digest operation: %', coalesce(v_op_type, 'null');
    end if;
  end loop;

  for v_msg in select value from jsonb_array_elements(coalesce(p_messages, '[]'::jsonb))
  loop
    if jsonb_typeof(v_msg) <> 'object' then
      raise exception 'each digest message must be a JSON object';
    end if;

    v_role := v_msg ->> 'role';
    v_kind := v_msg ->> 'kind';
    v_body := v_msg ->> 'body';
    v_mood := v_msg ->> 'mood';

    if v_role not in ('nog', 'student') then
      raise exception 'invalid message role: %', coalesce(v_role, 'null');
    end if;
    if v_kind not in ('reply', 'question', 'answer', 'reaction') then
      raise exception 'invalid message kind: %', coalesce(v_kind, 'null');
    end if;
    if v_body is null or char_length(v_body) = 0 or char_length(v_body) > 600 then
      raise exception 'invalid message body length';
    end if;

    insert into public.nog_messages (nog_id, lesson_id, role, kind, body, mood)
    values (p_nog_id, v_lesson.id, v_role, v_kind, v_body, v_mood);
  end loop;

  update public.lessons
  set
    digest_status = 'done',
    digest = p_digest,
    digest_card_ids = v_card_ids
  where id = v_lesson.id;

  return jsonb_build_object(
    'applied', true,
    'card_ids', to_jsonb(v_card_ids),
    'saved_digest', p_digest
  );
end;
$$;

revoke execute on function public.apply_lesson_digest(uuid, text, jsonb, jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.apply_lesson_digest(uuid, text, jsonb, jsonb, jsonb, uuid) to service_role;

create or replace function public.search_thought_cards(
  p_nog_id uuid,
  p_topic_id uuid,
  p_query text,
  p_limit int default 8
)
returns table (
  id uuid,
  nog_id uuid,
  topic_id uuid,
  label text,
  paraphrase text,
  status text,
  strength int,
  interval_days int,
  next_review_at timestamptz,
  source_lesson_id uuid,
  quote text,
  evidence_count int,
  score real
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_query text := btrim(coalesce(p_query, ''));
  v_limit int := least(greatest(coalesce(p_limit, 8), 1), 20);
  v_tsquery tsquery;
begin
  if v_query = '' then
    raise exception 'query is required';
  end if;
  if char_length(p_query) > 500 then
    raise exception 'query is too long';
  end if;

  v_tsquery := websearch_to_tsquery('simple', v_query);

  return query
  with scored as (
    select
      c.id,
      c.nog_id,
      c.topic_id,
      c.label,
      c.paraphrase,
      c.status,
      c.strength,
      c.interval_days,
      c.next_review_at,
      c.source_lesson_id,
      c.quote,
      c.updated_at,
      to_tsvector('simple', c.label || ' ' || c.paraphrase) @@ v_tsquery as matched,
      ts_rank(to_tsvector('simple', c.label || ' ' || c.paraphrase), v_tsquery) as fts,
      greatest(
        extensions.word_similarity(lower(v_query), lower(c.label)),
        extensions.word_similarity(lower(v_query), lower(c.paraphrase))
      ) as trgm
    from public.thought_cards c
    where c.nog_id = p_nog_id
      and (p_topic_id is null or c.topic_id = p_topic_id)
  )
  select
    s.id,
    s.nog_id,
    s.topic_id,
    s.label,
    s.paraphrase,
    s.status,
    s.strength,
    s.interval_days,
    s.next_review_at,
    s.source_lesson_id,
    s.quote,
    (
      select count(*)::int
      from public.card_evidence e
      where e.card_id = s.id
        and e.kind in ('taught', 'reinforced')
    ),
    (0.6 * s.fts + 0.4 * s.trgm)::real
  from scored s
  where s.matched or s.trgm >= 0.3
  order by (0.6 * s.fts + 0.4 * s.trgm) desc, s.updated_at desc, s.id
  limit v_limit;
end;
$$;

revoke execute on function public.search_thought_cards(uuid, uuid, text, int) from public, anon, authenticated, service_role;
grant execute on function public.search_thought_cards(uuid, uuid, text, int) to authenticated;

create or replace function public.save_ask_exchange(
  p_owner_id uuid,
  p_nog_id uuid,
  p_question text,
  p_answer text,
  p_mood text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question_id uuid;
  v_answer_id uuid;
begin
  if p_owner_id is null or p_nog_id is null then
    raise exception 'owner_id and nog_id are required';
  end if;

  perform 1
  from public.nogs n
  where n.id = p_nog_id
    and n.owner_id = p_owner_id;

  if not found then
    raise exception 'nog % not found for owner', p_nog_id;
  end if;

  if p_question is null or char_length(btrim(p_question)) = 0 or char_length(p_question) > 400 then
    raise exception 'invalid question length';
  end if;
  if p_answer is null or char_length(btrim(p_answer)) = 0 or char_length(p_answer) > 600 then
    raise exception 'invalid answer length';
  end if;
  if p_mood is not null and char_length(p_mood) > 20 then
    raise exception 'invalid mood length';
  end if;

  insert into public.nog_messages (nog_id, lesson_id, role, kind, body, mood, created_at)
  values (p_nog_id, null, 'student', 'ask', p_question, null, clock_timestamp())
  returning id into v_question_id;

  insert into public.nog_messages (nog_id, lesson_id, role, kind, body, mood, created_at)
  values (p_nog_id, null, 'nog', 'ask_answer', p_answer, p_mood, clock_timestamp())
  returning id into v_answer_id;

  return jsonb_build_object('question_id', v_question_id, 'answer_id', v_answer_id);
end;
$$;

revoke execute on function public.save_ask_exchange(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.save_ask_exchange(uuid, uuid, text, text, text) to service_role;

update public.plans set caps = caps || '{"ask": 15}'::jsonb where code = 'free';
update public.plans set caps = caps || '{"ask": 100}'::jsonb where code = 'plus';
