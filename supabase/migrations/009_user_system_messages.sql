-- System messages to users (e.g. offer stopped, refund notice). Read-only for the user.
create table if not exists public.user_system_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now(),
  read_at timestamptz
);

create index if not exists idx_user_system_messages_user on public.user_system_messages(user_id);
create index if not exists idx_user_system_messages_created on public.user_system_messages(user_id, created_at);

alter table public.user_system_messages enable row level security;

create policy "Users can read own system messages"
  on public.user_system_messages for select
  using (auth.uid() = user_id);

create policy "Service role full access user_system_messages"
  on public.user_system_messages for all using (auth.jwt() ->> 'role' = 'service_role');

comment on table public.user_system_messages is 'System-to-user messages (e.g. offer stopped). User cannot reply.';
