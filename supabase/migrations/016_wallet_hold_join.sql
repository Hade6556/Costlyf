-- Allow hold_join (suspend amount on join) and refund_hold_join (refund when owner declines).
-- hold_join: negative amount, reserved until subscriber confirms or owner declines.
-- refund_hold_join: positive amount, when owner declines a join paid by wallet.
alter table public.balance_transactions
  drop constraint if exists balance_transactions_type_check;

alter table public.balance_transactions
  add constraint balance_transactions_type_check check (type in (
    'top_up',
    'debit_join',
    'debit_renewal',
    'refund',
    'payout_owner',
    'adjustment',
    'hold_join',
    'refund_hold_join'
  ));

comment on column public.balance_transactions.type is 'top_up, hold_join (pending), debit_join (confirmed), refund_hold_join (declined), debit_renewal, refund, payout_owner, adjustment';
