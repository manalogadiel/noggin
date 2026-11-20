insert into public.plans (code, name, caps)
values
  (
    'free',
    'Free',
    '{"listener": 10, "answer": 5, "grade": 5, "stt_seconds": 300, "tts_chars": 1000, "pet": 50}'::jsonb
  ),
  (
    'plus',
    'Noggin Plus',
    '{"listener": 60, "answer": 40, "grade": 40, "stt_seconds": 1800, "tts_chars": 15000, "pet": 200}'::jsonb
  )
on conflict (code) do update
set
  name = excluded.name,
  caps = excluded.caps;

insert into public.app_config (key, value)
values
  (
    'features',
    '{"speech_mimicry": true, "toss_physics": false, "faint_ui": false}'::jsonb
  ),
  (
    'economy',
    '{"lesson_word_cap": 120, "followups_per_lesson": 2, "stage_thresholds": {"sprout": 5, "scholar": 15, "genius": 30}, "petting_daily_cap": 5}'::jsonb
  )
on conflict (key) do update
set value = excluded.value;

do $$
declare
  v_subject_id uuid;
  v_topic_id uuid;
  v_source_id uuid;
  v_source_body text := $tcp$Before two hosts exchange application data over TCP, they establish a reliable connection through a three-way handshake that synchronizes sequence numbers in both directions. First, the client sends a SYN segment carrying its chosen initial sequence number, telling the server it wants to open a session and where its byte stream begins. Second, the server replies with a SYN-ACK segment that acknowledges the client's SYN by setting the acknowledgment number to the client's initial sequence number plus one, while also proposing the server's own initial sequence number. Third, the client responds with an ACK segment whose acknowledgment number equals the server's initial sequence number plus one, confirming that the client received the server's sequence number and is ready to transfer data.

Three steps are necessary rather than two because both endpoints must prove they can send and receive packets and agree on each direction's starting sequence number; a two-step exchange would leave the server unsure whether the client actually received its SYN-ACK or whether an old delayed SYN triggered a half-open session. Because each side picks an unpredictable initial sequence number, segments from earlier connections are unlikely to be mistaken for current traffic. If the final ACK is lost in transit, the server remains in the SYN-RECEIVED state and retransmits its SYN-ACK after a timeout until an ACK arrives or the attempt expires. Ending a TCP session is a separate process: connection teardown normally uses a four-way FIN and ACK exchange so each endpoint can close its half of the stream independently.$tcp$;
begin
  insert into public.subjects (slug, name, available)
  values ('networking', 'Networking', true)
  on conflict (slug) do update set name = excluded.name, available = excluded.available
  returning id into v_subject_id;

  insert into public.topics (subject_id, slug, title, owner_id, visibility, trust_level, language, status)
  values (v_subject_id, 'tcp-handshake', 'TCP handshake', null, 'public', 'official', 'en', 'active')
  on conflict (subject_id, slug) do update
  set title = excluded.title, visibility = excluded.visibility, trust_level = excluded.trust_level, status = excluded.status
  returning id into v_topic_id;

  select id into v_source_id
  from public.sources
  where topic_id = v_topic_id and kind = 'official'
  limit 1;

  if v_source_id is null then
    insert into public.sources (topic_id, kind, url, title, body, created_by)
    values (v_topic_id, 'official', null, 'TCP Three-Way Handshake Reference', v_source_body, null)
    returning id into v_source_id;
  else
    update public.sources
    set title = 'TCP Three-Way Handshake Reference', body = v_source_body
    where id = v_source_id;
  end if;

  insert into public.questions (topic_id, source_id, position, prompt, reference_answer, key_concepts, source_excerpt, status)
  values
    (
      v_topic_id,
      v_source_id,
      1,
      'What does the client send in the first step of the TCP handshake, and what does it carry?',
      'The client sends a SYN segment containing its initial sequence number to request a new connection and mark where its byte stream starts.',
      array['SYN segment', 'client initial sequence number', 'request to open a connection'],
      'First, the client sends a SYN segment carrying its chosen initial sequence number, telling the server it wants to open a session and where its byte stream begins.',
      'active'
    ),
    (
      v_topic_id,
      v_source_id,
      2,
      'How does the server respond in the second step of the TCP handshake?',
      'The server sends a SYN-ACK segment that acknowledges the client''s initial sequence number plus one and proposes the server''s own initial sequence number.',
      array['SYN-ACK segment', 'acknowledges client sequence number plus one', 'server initial sequence number'],
      'Second, the server replies with a SYN-ACK segment that acknowledges the client''s SYN by setting the acknowledgment number to the client''s initial sequence number plus one, while also proposing the server''s own initial sequence number.',
      'active'
    ),
    (
      v_topic_id,
      v_source_id,
      3,
      'What completes the handshake in the third step?',
      'The client sends an ACK segment acknowledging the server''s initial sequence number plus one, confirming receipt and readiness to exchange data.',
      array['ACK segment', 'acknowledges server sequence number plus one', 'ready to transfer data'],
      'Third, the client responds with an ACK segment whose acknowledgment number equals the server''s initial sequence number plus one, confirming that the client received the server''s sequence number and is ready to transfer data.',
      'active'
    ),
    (
      v_topic_id,
      v_source_id,
      4,
      'What is the overall purpose of the TCP three-way handshake before application data is sent?',
      'It sets up a reliable connection and synchronizes sequence numbers in both directions before hosts exchange application data.',
      array['establish a reliable connection', 'synchronize sequence numbers in both directions'],
      'Before two hosts exchange application data over TCP, they establish a reliable connection through a three-way handshake that synchronizes sequence numbers in both directions.',
      'active'
    ),
    (
      v_topic_id,
      v_source_id,
      5,
      'Why does TCP require three steps instead of two to establish a connection?',
      'Both hosts must confirm two-way reachability and agree on both starting sequence numbers; with only two steps the server would not know if the client received its SYN-ACK or if a delayed SYN created a half-open session.',
      array['confirm bidirectional send and receive', 'agree on both starting sequence numbers', 'avoid server uncertainty or half-open session'],
      'Three steps are necessary rather than two because both endpoints must prove they can send and receive packets and agree on each direction''s starting sequence number; a two-step exchange would leave the server unsure whether the client actually received its SYN-ACK or whether an old delayed SYN triggered a half-open session.',
      'active'
    ),
    (
      v_topic_id,
      v_source_id,
      6,
      'Why do both sides choose unpredictable initial sequence numbers?',
      'Unpredictable initial sequence numbers prevent delayed segments from earlier connections from being confused with packets from the current session.',
      array['unpredictable initial sequence numbers', 'prevent old segments from matching current traffic'],
      'Because each side picks an unpredictable initial sequence number, segments from earlier connections are unlikely to be mistaken for current traffic.',
      'active'
    ),
    (
      v_topic_id,
      v_source_id,
      7,
      'What happens on the server if the client''s final ACK is lost in transit?',
      'The server stays in the SYN-RECEIVED state and retransmits its SYN-ACK after a timeout until an ACK arrives or the connection attempt expires.',
      array['server stays in SYN-RECEIVED state', 'retransmits SYN-ACK after timeout', 'waits until ACK or expiration'],
      'If the final ACK is lost in transit, the server remains in the SYN-RECEIVED state and retransmits its SYN-ACK after a timeout until an ACK arrives or the attempt expires.',
      'active'
    ),
    (
      v_topic_id,
      v_source_id,
      8,
      'How does closing a TCP connection differ from the three-way handshake?',
      'Connection teardown is a separate process that normally uses a four-way FIN and ACK exchange so each endpoint can close its half of the connection independently.',
      array['separate teardown process', 'four-way FIN and ACK exchange', 'independent half-close per endpoint'],
      'Ending a TCP session is a separate process: connection teardown normally uses a four-way FIN and ACK exchange so each endpoint can close its half of the stream independently.',
      'active'
    )
  on conflict (topic_id, position) do update
  set
    source_id = excluded.source_id,
    prompt = excluded.prompt,
    reference_answer = excluded.reference_answer,
    key_concepts = excluded.key_concepts,
    source_excerpt = excluded.source_excerpt,
    status = excluded.status;
end;
$$;
