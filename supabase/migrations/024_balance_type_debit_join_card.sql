-- Allow balance_transactions type debit_join_card (join paid by card; amount_cents 0, display amount in metadata).
alter table public.balance_transactions
  drop constraint if exists balance_transactions_type_check;

alter table public.balance_transactions
  add constraint balance_transactions_type_check check (type in (
    'top_up',
    'debit_join',
    'debit_join_card',
    'debit_renewal',
    'refund',
    'payout_owner',
    'adjustment',
    'hold_join',
    'refund_hold_join',
    'withdrawal'
  ));
