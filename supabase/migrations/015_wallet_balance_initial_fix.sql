-- Fix: first-time top-up was inserting balance_cents = 0 instead of p_amount_cents into user_balances.
create or replace function public.apply_balance_transaction(
  p_user_id uuid,
  p_amount_cents bigint,
  p_type text,
  p_reference_type text,
  p_reference_id text,
  p_metadata jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx_id uuid;
  v_new_balance bigint;
begin
  if p_reference_type is null or p_reference_id is null then
    raise exception 'reference_type and reference_id required for idempotency';
  end if;

  insert into public.balance_transactions (user_id, amount_cents, type, reference_type, reference_id, metadata)
  values (p_user_id, p_amount_cents, p_type, p_reference_type, p_reference_id, p_metadata)
  on conflict (reference_type, reference_id) do nothing
  returning id into v_tx_id;

  if v_tx_id is null then
    select id into v_tx_id from public.balance_transactions where reference_type = p_reference_type and reference_id = p_reference_id;
    if v_tx_id is not null then
      return v_tx_id;
    end if;
    raise exception 'idempotency: transaction already applied for % %', p_reference_type, p_reference_id;
  end if;

  insert into public.user_balances (user_id, balance_cents, updated_at)
  values (p_user_id, p_amount_cents, now())
  on conflict (user_id) do update
  set
    balance_cents = user_balances.balance_cents + p_amount_cents,
    updated_at = now()
  returning user_balances.balance_cents into v_new_balance;

  if v_new_balance < 0 then
    raise exception 'balance would go negative: user_id=% new_balance_cents=%', p_user_id, v_new_balance;
  end if;

  return v_tx_id;
end;
$$;

-- One-time: recalculate user_balances from the ledger (fixes users who got 0 on first top-up).
update public.user_balances ub
set
  balance_cents = coalesce((
    select sum(bt.amount_cents)
    from public.balance_transactions bt
    where bt.user_id = ub.user_id
  ), 0),
  updated_at = now();
