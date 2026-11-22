-- Private Supabase Storage bucket for cached synthesized voice clips.
-- Reversible by removing objects where bucket_id = 'voice-cache' and deleting
-- the 'voice-cache' row from storage.buckets.
-- No anon or authenticated storage.objects policies are created (default-deny);
-- objects are accessed strictly server-side through service_role.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice-cache',
  'voice-cache',
  false,
  10485760,
  array['audio/wav']
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
