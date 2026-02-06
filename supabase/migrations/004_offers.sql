-- Offers: one per owner per shared subscription (service + plan + price + max_slots)
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  service text not null,
  service_name text not null,
  plan text not null default 'premium',
  price numeric(10,2) not null,
  max_slots int not null check (max_slots >= 1),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  instant boolean not null default false,
  verified boolean not null default false,
  trust_score int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_offers_owner on public.offers(owner_id);
create index if not exists idx_offers_service_visibility on public.offers(service, visibility) where visibility = 'public';

-- Slots: one row per seat (1 .. max_slots). status: available | reserved | taken
create table if not exists public.offer_slots (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  slot_index int not null check (slot_index >= 1),
  status text not null default 'available' check (status in ('available', 'reserved', 'taken')),
  user_id uuid references public.profiles(id) on delete set null,
  reserved_at timestamptz,
  removal_requested_at timestamptz,
  removal_effective_at timestamptz,
  unique(offer_id, slot_index)
);

create index if not exists idx_offer_slots_offer on public.offer_slots(offer_id);

alter table public.offers enable row level security;
alter table public.offer_slots enable row level security;

-- Offers: owner can do all; anyone can read public offers (for join list)
create policy "Users can read own offers"
  on public.offers for select using (auth.uid() = owner_id);

create policy "Users can insert own offers"
  on public.offers for insert with check (auth.uid() = owner_id);

create policy "Users can update own offers"
  on public.offers for update using (auth.uid() = owner_id);

create policy "Users can delete own offers"
  on public.offers for delete using (auth.uid() = owner_id);

-- Service role can read all (for API that lists public offers by service)
create policy "Service role full access offers"
  on public.offers for all using (auth.jwt() ->> 'role' = 'service_role');

-- Slots: offer owner and slot user can read; owner can update; service_role full
create policy "Users can read slots of own offers or slots they occupy"
  on public.offer_slots for select
  using (
    exists (select 1 from public.offers o where o.id = offer_slots.offer_id and o.owner_id = auth.uid())
    or offer_slots.user_id = auth.uid()
  );

create policy "Service role full access offer_slots"
  on public.offer_slots for all using (auth.jwt() ->> 'role' = 'service_role');
