-- Index for fast unread count (navbar badge, system card badge)
create index if not exists idx_user_system_messages_unread
  on public.user_system_messages (user_id)
  where read_at is null;
