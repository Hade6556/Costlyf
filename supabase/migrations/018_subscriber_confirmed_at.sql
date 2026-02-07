-- When the subscriber confirms (credentials received, everything working), we set this.
-- The 30-day payout to the owner runs only after subscriber_confirmed_at is set.
alter table public.subscriptions
  add column if not exists subscriber_confirmed_at timestamptz;

comment on column public.subscriptions.subscriber_confirmed_at is 'Set when subscriber clicks I confirm in chat. Payout to owner is only processed after this.';
