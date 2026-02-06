-- When owner accepts a reserved slot (reserved -> taken), we store accepted_at
-- for trust criteria: "Accept in < 12 hours" and "Share for 30+ days".
alter table public.offer_slots
  add column if not exists accepted_at timestamptz;

comment on column public.offer_slots.accepted_at is 'When the owner accepted the slot (reserved -> taken). Used for trust criteria.';
