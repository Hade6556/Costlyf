-- System messages (e.g. join request instructions): nullable sender_id, is_system flag
alter table public.chat_messages
  add column if not exists is_system boolean not null default false;

alter table public.chat_messages
  alter column sender_id drop not null;

comment on column public.chat_messages.is_system is 'When true, message is from system (e.g. join request flow); sender_id may be null';
