-- =============================================================================
-- Wallet & Stripe: balances, transactions, saved cards, payouts
-- - Each user has a balance (non-negative).
-- - All balance changes go through balance_transactions (append-only ledger).
-- - Idempotency via (reference_type, reference_id) prevents double charge/payout.
-- - Amounts stored in cents (integer).
-- =============================================================================

-- Stripe customer id on profile (one Stripe Customer per user)
alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists default_payment_method_id text;

create unique index if not exists idx_profiles_stripe_customer_id
  on public.profiles(stripe_customer_id) where stripe_customer_id is not null;

comment on column public.profiles.stripe_customer_id is 'Stripe Customer id (cus_xxx) for charges and saved payment methods';
comment on column public.profiles.default_payment_method_id is 'Stripe PaymentMethod id (pm_xxx) used for renewals and when balance insufficient';

-- User balances: one row per user, balance_cents >= 0
create table if not exists public.user_balances (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance_cents bigint not null default 0 check (balance_cents >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.user_balances is 'Current balance per user (cents). Updated only via apply_balance_transaction.';

-- Ledger: append-only. Idempotency via (reference_type, reference_id).
create table if not exists public.balance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_cents bigint not null,  -- positive = credit, negative = debit
  type text not null check (type in (
    'top_up',           -- Stripe top-up
    'debit_join',       -- Pay for joining a slot (first period)
    'debit_renewal',    -- Pay for subscription renewal
    'refund',           -- Refund (e.g. owner stopped share)
    'payout_owner',     -- Owner receives share after 30 days
    'adjustment'        -- Manual/support adjustment
  )),
  reference_type text,  -- e.g. 'stripe_payment_intent', 'subscription_debit', 'payout_30d'
  reference_id text,    -- e.g. pi_xxx, subscription.id, payout.id
  metadata jsonb,       -- optional: offer_id, slot_index, period_start, etc.
  created_at timestamptz not null default now(),
  unique (reference_type, reference_id)
);

create index if not exists idx_balance_transactions_user on public.balance_transactions(user_id);
create index if not exists idx_balance_transactions_created on public.balance_transactions(created_at);
create index if not exists idx_balance_transactions_type_ref on public.balance_transactions(reference_type, reference_id);

comment on table public.balance_transactions is 'Append-only ledger. reference_type + reference_id must be unique to prevent double charge/payout.';

-- Apply a balance change: insert ledger row and update user_balances. Fails if balance would go negative or idempotency key already used.
create or replace function public.apply_balance_transaction(
  p_user_id uuid,
  p_amount_cents bigint,
  p_type text,
  p_reference_type text,
  p_reference_id text,
  p_metadata jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx_id uuid;
  v_new_balance bigint;
begin
  if p_reference_type is null or p_reference_id is null then
    raise exception 'reference_type and reference_id required for idempotency';
  end if;

  insert into public.balance_transactions (user_id, amount_cents, type, reference_type, reference_id, metadata)
  values (p_user_id, p_amount_cents, p_type, p_reference_type, p_reference_id, p_metadata)
  on conflict (reference_type, reference_id) do nothing
  returning id into v_tx_id;

  if v_tx_id is null then
    select id into v_tx_id from public.balance_transactions where reference_type = p_reference_type and reference_id = p_reference_id;
    if v_tx_id is not null then
      return v_tx_id;
    end if;
    raise exception 'idempotency: transaction already applied for % %', p_reference_type, p_reference_id;
  end if;

  insert into public.user_balances (user_id, balance_cents, updated_at)
  values (p_user_id, 0, now())
  on conflict (user_id) do update
  set
    balance_cents = user_balances.balance_cents + p_amount_cents,
    updated_at = now()
  returning user_balances.balance_cents into v_new_balance;

  if v_new_balance < 0 then
    raise exception 'balance would go negative: user_id=% new_balance_cents=%', p_user_id, v_new_balance;
  end if;

  return v_tx_id;
end;
$$;

comment on function public.apply_balance_transaction is 'Idempotent balance change. Use unique (reference_type, reference_id) per operation (e.g. pi_xxx for top-up, subscription_id for debit).';

-- Saved payment methods (cards) for charging on join/renewal
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_payment_method_id text not null,
  last4 text,
  brand text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, stripe_payment_method_id)
);

create index if not exists idx_payment_methods_user on public.payment_methods(user_id);
create unique index if not exists idx_payment_methods_stripe_pm on public.payment_methods(stripe_payment_method_id);

comment on table public.payment_methods is 'Stripe PaymentMethods attached to Stripe Customer; used for charges when balance insufficient.';

-- Payouts to owners (after 30 days of sharing). One row per payout; idempotent per (subscription_id, period).
create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  offer_id uuid not null references public.offers(id) on delete cascade,
  slot_index int not null,
  period_start timestamptz not null,
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  balance_transaction_id uuid references public.balance_transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (subscription_id, period_start)
);

create index if not exists idx_payouts_owner on public.payouts(owner_id);
create index if not exists idx_payouts_status on public.payouts(status) where status = 'pending';

comment on table public.payouts is 'Owner payout after 30 days of sharing. Unique (subscription_id, period_start) prevents double payout.';

-- Subscription payment tracking: which period we have charged the co-subscriber for (avoid double charge on renewal)
alter table public.subscriptions
  add column if not exists last_charged_period_start timestamptz,
  add column if not exists last_charged_at timestamptz;

comment on column public.subscriptions.last_charged_period_start is 'Period start we last charged the co-subscriber for (renewal idempotency)';
comment on column public.subscriptions.last_charged_at is 'When we last charged (for renewal logic)';

-- RLS
alter table public.user_balances enable row level security;
alter table public.balance_transactions enable row level security;
alter table public.payment_methods enable row level security;
alter table public.payouts enable row level security;

create policy "Users can read own balance"
  on public.user_balances for select using (auth.uid() = user_id);

create policy "Users can read own balance_transactions"
  on public.balance_transactions for select using (auth.uid() = user_id);

create policy "Users can read own payment_methods"
  on public.payment_methods for select using (auth.uid() = user_id);

create policy "Users can read own payouts"
  on public.payouts for select using (auth.uid() = owner_id);

-- Only backend (service_role) can insert/update balances, transactions, payouts, payment_methods
create policy "Service role full access user_balances"
  on public.user_balances for all using (auth.jwt() ->> 'role' = 'service_role');

create policy "Service role full access balance_transactions"
  on public.balance_transactions for all using (auth.jwt() ->> 'role' = 'service_role');

create policy "Service role full access payment_methods"
  on public.payment_methods for all using (auth.jwt() ->> 'role' = 'service_role');

create policy "Service role full access payouts"
  on public.payouts for all using (auth.jwt() ->> 'role' = 'service_role');

-- Trigger: ensure at most one default payment method per user
create or replace function public.payment_methods_single_default()
returns trigger language plpgsql as $$
begin
  if new.is_default then
    update public.payment_methods set is_default = false where user_id = new.user_id and id <> new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists payment_methods_single_default_trigger on public.payment_methods;
create trigger payment_methods_single_default_trigger
  before insert or update of is_default on public.payment_methods
  for each row execute procedure public.payment_methods_single_default();
