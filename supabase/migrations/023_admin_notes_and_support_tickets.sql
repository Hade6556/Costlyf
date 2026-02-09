-- Admin notes on withdrawal requests; support ticket system for user issues.

alter table public.withdrawal_requests
  add column if not exists admin_notes text;

comment on column public.withdrawal_requests.admin_notes is 'Admin-only notes (e.g. payout reference, reason for cancel).';

-- Support tickets: user reports issue (e.g. joining subscription), admin can reply and set status
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_user on public.support_tickets(user_id);
create index if not exists idx_support_tickets_status on public.support_tickets(status);

comment on table public.support_tickets is 'User support tickets (e.g. problem joining subscription); admin replies and sets status.';

alter table public.support_tickets enable row level security;

create policy "Users can read own support_tickets"
  on public.support_tickets for select using (auth.uid() = user_id);

create policy "Users can insert own support_tickets"
  on public.support_tickets for insert with check (auth.uid() = user_id);

create policy "Service role full access support_tickets"
  on public.support_tickets for all using (auth.jwt() ->> 'role' = 'service_role');

-- Messages in a ticket (user or admin)
create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  is_admin boolean not null default false,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_support_ticket_messages_ticket on public.support_ticket_messages(ticket_id);

comment on column public.support_ticket_messages.is_admin is 'When true, message is from admin/support (sender_id may be null).';

alter table public.support_ticket_messages enable row level security;

create policy "Users can read messages in own tickets"
  on public.support_ticket_messages for select
  using (
    exists (
      select 1 from public.support_tickets t
      where t.id = support_ticket_messages.ticket_id and t.user_id = auth.uid()
    )
  );

create policy "Users can insert messages in own tickets (non-admin)"
  on public.support_ticket_messages for insert
  with check (
    is_admin = false and sender_id = auth.uid() and
    exists (
      select 1 from public.support_tickets t
      where t.id = support_ticket_messages.ticket_id and t.user_id = auth.uid()
    )
  );

create policy "Service role full access support_ticket_messages"
  on public.support_ticket_messages for all using (auth.jwt() ->> 'role' = 'service_role');
