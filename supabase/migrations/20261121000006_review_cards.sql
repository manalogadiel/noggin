-- Spaced-repetition thought-card review RPC with explicit owner check and
-- service_role-only execution.
-- Reversible by dropping public.review_thought_card(uuid, uuid, text).

create or replace function public.review_thought_card(
  p_owner_id uuid,
  p_card_id uuid,
  p_outcome text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card public.thought_cards%rowtype;
  v_updated public.thought_cards%rowtype;
  v_next_interval int;
begin
  if p_owner_id is null or p_card_id is null then
    raise exception 'owner_id and card_id are required' using errcode = '22023';
  end if;

  if p_outcome is null or p_outcome not in ('remembered', 'forgot') then
    raise exception 'invalid review outcome' using errcode = '22023';
  end if;

  select tc.*
  into v_card
  from public.thought_cards tc
  join public.nogs n on n.id = tc.nog_id
  where tc.id = p_card_id
    and n.owner_id = p_owner_id
  for update of tc;

  if not found then
    raise exception 'thought card % not found for owner', p_card_id
      using errcode = '42501';
  end if;

  if p_outcome = 'remembered' then
    v_next_interval := case
      when v_card.interval_days < 1 then 1
      when v_card.interval_days < 3 then 3
      when v_card.interval_days < 7 then 7
      when v_card.interval_days < 14 then 14
      else 30
    end;

    update public.thought_cards
    set
      strength = v_card.strength + 1,
      interval_days = v_next_interval,
      next_review_at = now() + make_interval(days => v_next_interval),
      updated_at = now()
    where id = v_card.id
    returning * into v_updated;
  else
    update public.thought_cards
    set
      status = 'shaky',
      interval_days = 1,
      next_review_at = now() + interval '1 day',
      updated_at = now()
    where id = v_card.id
    returning * into v_updated;
  end if;

  return jsonb_build_object(
    'id', v_updated.id,
    'nog_id', v_updated.nog_id,
    'topic_id', v_updated.topic_id,
    'label', v_updated.label,
    'paraphrase', v_updated.paraphrase,
    'status', v_updated.status,
    'strength', v_updated.strength,
    'interval_days', v_updated.interval_days,
    'next_review_at', v_updated.next_review_at,
    'source_lesson_id', v_updated.source_lesson_id,
    'quote', v_updated.quote
  );
end;
$$;

revoke execute on function public.review_thought_card(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.review_thought_card(uuid, uuid, text) to service_role;
