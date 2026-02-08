-- Enforce unique nickname (alias), email, and phone across profiles.
-- NULL/empty values are allowed (multiple users can have no alias/email/phone).
-- Comparisons are case-insensitive for alias and email.

create unique index if not exists idx_profiles_alias_unique
  on public.profiles (lower(trim(alias)))
  where alias is not null and trim(alias) != '';

create unique index if not exists idx_profiles_email_unique
  on public.profiles (lower(trim(email)))
  where email is not null and trim(email) != '';

create unique index if not exists idx_profiles_phone_unique
  on public.profiles (trim(phone))
  where phone is not null and trim(phone) != '';
