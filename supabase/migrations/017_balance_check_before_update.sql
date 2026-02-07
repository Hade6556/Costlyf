-- Check balance before updating user_balances so we never violate balance_cents >= 0.
-- Previously the UPDATE could write a negative value and the CHECK constraint fired before our RAISE.
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
  v_current_balance bigint;
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

  -- Check balance before writing so we never violate user_balances_balance_cents_check.
  -- For new users (no row) we were inserting p_amount_cents, which is negative for debits → CHECK violation.
  select balance_cents into v_current_balance from public.user_balances where user_id = p_user_id;
  v_new_balance := coalesce(v_current_balance, 0) + p_amount_cents;
  if v_new_balance < 0 then
    raise exception 'balance would go negative: user_id=% new_balance_cents=%', p_user_id, v_new_balance;
  end if;

  -- Write the new balance (never negative) for both INSERT and UPDATE.
  insert into public.user_balances (user_id, balance_cents, updated_at)
  values (p_user_id, v_new_balance, now())
  on conflict (user_id) do update
  set
    balance_cents = v_new_balance,
    updated_at = now();

  return v_tx_id;
end;
$$;
