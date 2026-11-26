-- Tiered age rules:
--   Ages 6-12 (under 13): allowed with required parent/guardian email, private profile, restricted social features.
--   Ages 13+: standard account without parent email required.
--   Under 6: rejected.

alter table public.profiles
  add column if not exists guardian_email text;

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
  v_guardian_email text;
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
  if v_age < 6 then
    raise exception 'users must be at least 6 years old' using errcode = '22023';
  end if;

  v_guardian_email := nullif(lower(btrim(coalesce(new.raw_user_meta_data ->> 'guardian_email', ''))), '');
  if v_age < 13 then
    if v_guardian_email is null or v_guardian_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'guardian_email is required for learners under 13' using errcode = '22023';
    end if;
    v_consent_status := 'pending';
  else
    v_consent_status := 'not_required';
    v_guardian_email := null;
  end if;

  v_display_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');

  insert into public.profiles (id, display_name, birth_date, guardian_consent_status, guardian_email)
  values (new.id, v_display_name, v_birth_date, v_consent_status, v_guardian_email);

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
