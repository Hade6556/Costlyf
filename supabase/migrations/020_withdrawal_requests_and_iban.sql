-- Withdrawal requests (admin confirms payout to IBAN) and profile IBAN for withdrawals.
-- User sets IBAN on Payment method page; withdraw creates a pending request; admin marks paid (e.g. after sending via Stripe or bank).

alter table public.profiles
  add column if not exists withdrawal_iban text,
  add column if not exists withdrawal_account_holder text;

comment on column public.profiles.withdrawal_iban is 'User IBAN for withdrawals (saved on Payment method page).';
comment on column public.profiles.withdrawal_account_holder is 'Account holder name for withdrawals.';

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  iban_snapshot text not null,
  account_holder_snapshot text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  stripe_payout_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_withdrawal_requests_user on public.withdrawal_requests(user_id);
create index if not exists idx_withdrawal_requests_status on public.withdrawal_requests(status) where status = 'pending';

comment on table public.withdrawal_requests is 'User withdrawal requests; admin confirms payout to IBAN (e.g. via Stripe).';

alter table public.withdrawal_requests enable row level security;

create policy "Users can read own withdrawal_requests"
  on public.withdrawal_requests for select using (auth.uid() = user_id);

create policy "Service role full access withdrawal_requests"
  on public.withdrawal_requests for all using (auth.jwt() ->> 'role' = 'service_role');

-- Balance transactions: allow reference_type 'withdrawal_request' so we link debit to request id
-- (no DB constraint on reference_type; we just use it in app logic)
