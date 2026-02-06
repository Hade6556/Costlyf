-- Subscriptions: one row per user's active/canceled slot (co-subscriber view).
-- Tracks when they subscribed, plan, contribution, period end, and cancel/removal state.
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  offer_id uuid not null references public.offers(id) on delete cascade,
  slot_index int not null check (slot_index >= 1),
  period_start timestamptz not null,
  period_end timestamptz not null,
  plan text not null default 'premium',
  contribution_price numeric(10,2) not null,
  status text not null default 'active' check (status in ('active', 'canceling', 'ended')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(offer_id, slot_index)
);

create index if not exists idx_subscriptions_user on public.subscriptions(user_id);
create index if not exists idx_subscriptions_offer_slot on public.subscriptions(offer_id, slot_index);

alter table public.subscriptions enable row level security;

create policy "Users can read own subscriptions"
  on public.subscriptions for select using (auth.uid() = user_id);

create policy "Service role full access subscriptions"
  on public.subscriptions for all using (auth.jwt() ->> 'role' = 'service_role');

comment on table public.subscriptions is 'Co-subscriber subscription records: period, plan, contribution, cancel/removal state.';
