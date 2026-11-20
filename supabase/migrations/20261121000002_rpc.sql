create or replace function public.apply_lesson_digest(
  p_nog_id uuid,
  p_idempotency_key text,
  p_ops jsonb,
  p_messages jsonb
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

  select l.id, l.topic_id, l.digest_status
  into v_lesson
  from public.lessons l
  where l.nog_id = p_nog_id
    and l.idempotency_key = p_idempotency_key
  for update;

  if not found then
    raise exception 'lesson not found for nog %', p_nog_id;
  end if;

  if v_lesson.digest_status = 'done' then
    return jsonb_build_object('applied', false, 'card_ids', '[]'::jsonb);
  end if;

  if p_ops is not null and jsonb_typeof(p_ops) <> 'array' then
    raise exception 'p_ops must be a JSON array';
  end if;

  if p_messages is not null and jsonb_typeof(p_messages) <> 'array' then
    raise exception 'p_messages must be a JSON array';
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
        and tc.nog_id = p_nog_id;

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

      if v_paraphrase is not null and (char_length(v_paraphrase) = 0 or char_length(v_paraphrase) > 280) then
        raise exception 'invalid card paraphrase length';
      end if;

      update public.thought_cards tc
      set
        status = 'confused',
        paraphrase = coalesce(v_paraphrase, tc.paraphrase),
        updated_at = now()
      where tc.id = v_card_id
        and tc.nog_id = p_nog_id;

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
  set digest_status = 'done'
  where id = v_lesson.id;

  return jsonb_build_object('applied', true, 'card_ids', to_jsonb(v_card_ids));
end;
$$;

revoke execute on function public.apply_lesson_digest(uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.apply_lesson_digest(uuid, text, jsonb, jsonb) to service_role;

create or replace function public.record_check_attempt(
  p_nog_id uuid,
  p_attempts jsonb,
  p_card_updates jsonb,
  p_stage text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt jsonb;
  v_card jsonb;
  v_card_id uuid;
  v_strength int;
  v_status text;
  v_interval_days int;
  v_next_review_at timestamptz;
begin
  if p_nog_id is null then
    raise exception 'nog_id is required';
  end if;

  perform 1
  from public.nogs n
  where n.id = p_nog_id
  for update;

  if not found then
    raise exception 'nog % not found', p_nog_id;
  end if;

  if p_attempts is not null and jsonb_typeof(p_attempts) <> 'array' then
    raise exception 'p_attempts must be a JSON array';
  end if;

  if p_card_updates is not null and jsonb_typeof(p_card_updates) <> 'array' then
    raise exception 'p_card_updates must be a JSON array';
  end if;

  for v_attempt in select value from jsonb_array_elements(coalesce(p_attempts, '[]'::jsonb))
  loop
    if jsonb_typeof(v_attempt) <> 'object' then
      raise exception 'each attempt must be a JSON object';
    end if;

    insert into public.check_attempts (
      nog_id,
      question_id,
      nog_answer,
      concepts,
      correct,
      notebook_fingerprint,
      model,
      prompt_version
    )
    values (
      p_nog_id,
      (v_attempt ->> 'question_id')::uuid,
      coalesce(v_attempt ->> 'nog_answer', ''),
      coalesce(v_attempt -> 'concepts', '[]'::jsonb),
      coalesce((v_attempt ->> 'correct')::boolean, false),
      coalesce(v_attempt ->> 'notebook_fingerprint', ''),
      v_attempt ->> 'model',
      v_attempt ->> 'prompt_version'
    );
  end loop;

  for v_card in select value from jsonb_array_elements(coalesce(p_card_updates, '[]'::jsonb))
  loop
    if jsonb_typeof(v_card) <> 'object' then
      raise exception 'each card update must be a JSON object';
    end if;

    if nullif(btrim(coalesce(v_card ->> 'card_id', '')), '') is null then
      raise exception 'card_id is required for card update';
    end if;
    v_card_id := (v_card ->> 'card_id')::uuid;
    v_strength := case when v_card ? 'strength' then (v_card ->> 'strength')::int else null end;
    v_status := v_card ->> 'status';
    v_interval_days := case when v_card ? 'interval_days' then (v_card ->> 'interval_days')::int else null end;
    v_next_review_at := case when v_card ? 'next_review_at' then (v_card ->> 'next_review_at')::timestamptz else null end;

    if v_status is not null and v_status not in ('understood', 'shaky', 'confused') then
      raise exception 'invalid card status: %', v_status;
    end if;

    update public.thought_cards tc
    set
      strength = coalesce(v_strength, tc.strength),
      status = coalesce(v_status, tc.status),
      interval_days = coalesce(v_interval_days, tc.interval_days),
      next_review_at = coalesce(
        v_next_review_at,
        case when v_interval_days is not null then now() + make_interval(days => v_interval_days) else tc.next_review_at end
      ),
      updated_at = now()
    where tc.id = v_card_id
      and tc.nog_id = p_nog_id;

    if not found then
      raise exception 'thought card % does not belong to nog %', v_card_id, p_nog_id;
    end if;
  end loop;

  if p_stage is not null then
    if p_stage not in ('hatchling', 'sprout', 'scholar', 'genius') then
      raise exception 'invalid stage: %', p_stage;
    end if;

    update public.nogs
    set
      stage = p_stage,
      last_care_at = now()
    where id = p_nog_id;
  end if;
end;
$$;

revoke execute on function public.record_check_attempt(uuid, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.record_check_attempt(uuid, jsonb, jsonb, text) to service_role;

create or replace function public.consume_usage_quota(
  p_user_id uuid,
  p_kind text,
  p_amount int
)
returns table (
  allowed boolean,
  used int,
  cap int
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_quota_tz constant text := 'Asia/Manila';
  v_cap int;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_used int;
begin
  if p_user_id is null or nullif(btrim(coalesce(p_kind, '')), '') is null then
    raise exception 'user_id and kind are required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text || ':' || p_kind));

  select (pl.caps ->> p_kind)::int
  into v_cap
  from public.profiles p
  join public.plans pl on pl.code = p.plan_code
  where p.id = p_user_id;

  if not found or v_cap is null then
    raise exception 'quota cap not found for user % and kind %', p_user_id, p_kind;
  end if;

  v_day_start := ((now() at time zone c_quota_tz)::date::timestamp) at time zone c_quota_tz;
  v_day_end := (((now() at time zone c_quota_tz)::date + 1)::timestamp) at time zone c_quota_tz;

  select coalesce(sum(ue.amount), 0)::int
  into v_used
  from public.usage_events ue
  where ue.user_id = p_user_id
    and ue.kind = p_kind
    and ue.created_at >= v_day_start
    and ue.created_at < v_day_end;

  if v_used + p_amount > v_cap then
    return query select false, v_used, v_cap;
    return;
  end if;

  insert into public.usage_events (user_id, kind, amount)
  values (p_user_id, p_kind, p_amount);

  return query select true, v_used + p_amount, v_cap;
end;
$$;

revoke execute on function public.consume_usage_quota(uuid, text, int) from public, anon, authenticated;
grant execute on function public.consume_usage_quota(uuid, text, int) to service_role;
