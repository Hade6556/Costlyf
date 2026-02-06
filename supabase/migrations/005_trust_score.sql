-- Trust score: stored per user in profiles (0–10). Updated when the user completes tasks
-- (e.g. accept charter, create first offer, complete payments). Use this value when
-- displaying offer owner trust on cards and in the join modal.
alter table public.profiles
  add column if not exists trust_score int not null default 0 check (trust_score >= 0 and trust_score <= 10);

comment on column public.profiles.trust_score is 'User trust score 0–10, updated when user completes tasks (charter, offers, etc.)';
