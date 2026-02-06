-- Shareable link: token allows anyone with the link to view a private offer (for joining).
alter table public.offers
  add column if not exists share_token text;

-- Backfill: generate a token for existing offers (no unique constraint until backfilled).
update public.offers
  set share_token = gen_random_uuid()::text
  where share_token is null;

create unique index if not exists idx_offers_share_token on public.offers(share_token) where share_token is not null;

comment on column public.offers.share_token is 'Secret token for share link; required to view/join private offers via link.';
