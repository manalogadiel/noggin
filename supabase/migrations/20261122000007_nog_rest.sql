-- Add optional rest_until timestamp to public.nogs so owners can rest and wake a Nog.
-- Reversible by:
--   revoke update (rest_until) on public.nogs from authenticated;
--   alter table public.nogs drop column if exists rest_until;

alter table public.nogs
  add column rest_until timestamptz;

grant update (rest_until) on public.nogs to authenticated;
