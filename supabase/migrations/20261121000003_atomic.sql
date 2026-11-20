-- Atomic lesson digest persistence, follow-up limit enforcement, and check reservation leases.
-- Reversible by dropping check_reservations, dropping the new RPCs, restoring the 4-arg
-- apply_lesson_digest signature, and dropping lessons.digest / lessons.digest_card_ids.

alter table public.lessons
  add column if not exists digest jsonb,
  add column if not exists digest_card_ids uuid[] not null default array[]::uuid[];

create index if not exists lessons_nog_topic_created_idx
  on public.lessons (nog_id, topic_id, created_at, id);

create index if not exists lessons_nog_parent_followup_idx
  on public.lessons (nog_id, parent_lesson_id)
  where kind = 'follow_up_answer';

create index if not exists nog_messages_nog_lesson_kind_idx
  on public.nog_messages (nog_id, lesson_id, kind);

drop function if exists public.apply_lesson_digest(uuid, text, jsonb, jsonb);

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
    perform 1
    from public.nogs n
    where n.id = p_nog_id
      and n.owner_id = p_owner_id;

    if not found then
      raise exception 'nog % not found for owner', p_nog_id;
    end if;
  else
    perform 1
    from public.nogs n
    where n.id = p_nog_id;

    if not found then
      raise exception 'nog % not found', p_nog_id;
    end if;
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

create table if not exists public.check_reservations (
  nog_id uuid primary key references public.nogs (id) on delete cascade,
  holder uuid not null,
  expires_at timestamptz not null
);

alter table public.check_reservations enable row level security;
revoke all on public.check_reservations from public, anon, authenticated;
grant all on public.check_reservations to service_role;

create or replace function public.acquire_check_reservation(
  p_nog_id uuid,
  p_holder uuid,
  p_ttl_seconds int,
  p_owner_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_nog_id is null or p_holder is null then
    raise exception 'nog_id and holder are required';
  end if;

  if p_ttl_seconds is null or p_ttl_seconds < 1 or p_ttl_seconds > 300 then
    raise exception 'ttl_seconds must be between 1 and 300';
  end if;

  if p_owner_id is not null then
    perform 1
    from public.nogs n
    where n.id = p_nog_id
      and n.owner_id = p_owner_id;

    if not found then
      raise exception 'nog % not found for owner', p_nog_id;
    end if;
  else
    perform 1
    from public.nogs n
    where n.id = p_nog_id;

    if not found then
      raise exception 'nog % not found', p_nog_id;
    end if;
  end if;

  insert into public.check_reservations (nog_id, holder, expires_at)
  values (p_nog_id, p_holder, now() + make_interval(secs => p_ttl_seconds))
  on conflict (nog_id) do update
  set
    holder = excluded.holder,
    expires_at = excluded.expires_at
  where public.check_reservations.expires_at < now();

  return found;
end;
$$;

revoke execute on function public.acquire_check_reservation(uuid, uuid, int, uuid) from public, anon, authenticated;
grant execute on function public.acquire_check_reservation(uuid, uuid, int, uuid) to service_role;

create or replace function public.release_check_reservation(
  p_nog_id uuid,
  p_holder uuid,
  p_owner_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_nog_id is null or p_holder is null then
    raise exception 'nog_id and holder are required';
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

  delete from public.check_reservations cr
  where cr.nog_id = p_nog_id
    and cr.holder = p_holder;
end;
$$;

revoke execute on function public.release_check_reservation(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.release_check_reservation(uuid, uuid, uuid) to service_role;
