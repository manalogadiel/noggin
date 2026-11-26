-- Trim spaces, tabs, and newlines when checking whether search_thought_cards query is blank.
-- Reversible by restoring btrim(coalesce(p_query, '')) in public.search_thought_cards.

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
  v_query text := btrim(coalesce(p_query, ''), E' \t\r\n');
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
