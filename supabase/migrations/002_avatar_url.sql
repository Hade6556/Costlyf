-- Add optional profile picture URL (when null, UI shows default circle + random hero-profiles icon)
alter table public.profiles
  add column if not exists avatar_url text;
