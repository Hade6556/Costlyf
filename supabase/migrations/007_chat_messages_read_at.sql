-- Track when a message was seen by the recipient (for delivered vs seen checkmarks)
alter table public.chat_messages
  add column if not exists read_at timestamptz;

comment on column public.chat_messages.read_at is 'When the recipient viewed the thread and saw this message; null = delivered only';
