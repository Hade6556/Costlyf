-- Owner-provided login details for the subscription (shared with joiners after they pay).
-- Stored per offer; joiners can read only when they have a reserved or taken slot.
alter table public.offers
  add column if not exists login_email text,
  add column if not exists login_password text;

comment on column public.offers.login_email is 'Login email for the subscription; shown to joiners after payment.';
comment on column public.offers.login_password is 'Login password for the subscription; shown to joiners after payment.';
