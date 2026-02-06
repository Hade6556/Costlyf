-- Chat: one thread per (offer, user1, user2) with user1_id < user2_id for consistency
create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  user1_id uuid not null references public.profiles(id) on delete cascade,
  user2_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint chat_threads_user_order check (user1_id < user2_id),
  unique(offer_id, user1_id, user2_id)
);

create index if not exists idx_chat_threads_user1 on public.chat_threads(user1_id);
create index if not exists idx_chat_threads_user2 on public.chat_threads(user2_id);
create index if not exists idx_chat_threads_offer on public.chat_threads(offer_id);

-- Messages in a thread
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

create index if not exists idx_chat_messages_thread on public.chat_messages(thread_id);
create index if not exists idx_chat_messages_created on public.chat_messages(thread_id, created_at);

alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;

-- Threads: participants can read
create policy "Users can read own threads"
  on public.chat_threads for select
  using (auth.uid() = user1_id or auth.uid() = user2_id);

create policy "Users can insert threads they are part of"
  on public.chat_threads for insert
  with check (auth.uid() = user1_id or auth.uid() = user2_id);

-- Service role for API
create policy "Service role full access chat_threads"
  on public.chat_threads for all using (auth.jwt() ->> 'role' = 'service_role');

-- Messages: thread participants can read/insert
create policy "Users can read messages in own threads"
  on public.chat_messages for select
  using (
    exists (
      select 1 from public.chat_threads t
      where t.id = chat_messages.thread_id and (t.user1_id = auth.uid() or t.user2_id = auth.uid())
    )
  );

create policy "Users can insert messages in own threads"
  on public.chat_messages for insert
  with check (
    exists (
      select 1 from public.chat_threads t
      where t.id = chat_messages.thread_id and (t.user1_id = auth.uid() or t.user2_id = auth.uid())
    )
  );

create policy "Service role full access chat_messages"
  on public.chat_messages for all using (auth.jwt() ->> 'role' = 'service_role');
