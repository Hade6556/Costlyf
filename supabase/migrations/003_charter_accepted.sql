-- Charter acceptance: required before publishing a share offer
alter table public.profiles
  add column if not exists charter_accepted_at timestamptz;
