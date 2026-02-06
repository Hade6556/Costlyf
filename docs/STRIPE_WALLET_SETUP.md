# Stripe & Wallet Setup (Costlyf)

This document describes what you need from Stripe (API keys, webhooks) and how the wallet and payment flows work so you can implement the backend and avoid double charges / double payouts.

---

## 1. Stripe API keys and config

Create a [Stripe account](https://dashboard.stripe.com) and get:

| Purpose | Where to find | Use |
|--------|----------------|-----|
| **Publishable key** | Dashboard → Developers → API keys → Publishable key | Frontend: Stripe.js / Elements (card input, Payment Intents client secret) |
| **Secret key** | Dashboard → Developers → API keys → Secret key | Backend only: create PaymentIntents, Customers, attach PaymentMethods, charge |
| **Webhook signing secret** | Dashboard → Developers → Webhooks → (your endpoint) → Signing secret | Backend: verify `Stripe-Signature` to ensure events are from Stripe |

**Environment variables (backend):**

```bash
STRIPE_SECRET_KEY=sk_live_xxx          # or sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx     # or pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx        # from webhook endpoint
STRIPE_CURRENCY=eur                    # or usd
```

- Never expose the **secret key** or **webhook secret** to the frontend.
- Use **test keys** (`sk_test_`, `pk_test_`) and test webhooks during development.

---

## 2. Stripe products you’ll use

- **Customers** – One Stripe Customer per user (`profiles.stripe_customer_id`). Used for:
  - Top-up: one-time PaymentIntents (no saved card required).
  - Saved card: attach PaymentMethod to Customer; charge later (join/renewal) with `payment_method` and `customer`.
- **Payment Intents** – For top-up (one-time) and for charging a saved card (e.g. join or renewal). Use `confirm: true` only on the client if you use Stripe.js; otherwise confirm on server.
- **PaymentMethods** – Saved cards attached to a Customer. Store `pm_xxx` in `payment_methods` and optionally set `profiles.default_payment_method_id` for “charge this card when balance is insufficient”.

No Stripe Connect or Subscriptions product is required for this design: you hold balances and pay out to owners as balance credits (or later with Connect/transfers).

---

## 3. Webhooks you must handle

**If payments appear in Stripe but balance never updates in the app or Supabase**, the webhook is not reaching your server or is failing. Do the following:

1. **Add a webhook endpoint in Stripe:** Dashboard → Developers → Webhooks → **Add endpoint**.
2. **URL:** Your server must be reachable over HTTPS, e.g. `https://your-api.com/api/webhooks/stripe`. For local dev, use [Stripe CLI](https://stripe.com/docs/stripe-cli): `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and use the printed signing secret as `STRIPE_WEBHOOK_SECRET`.
3. **Events:** Subscribe to at least **`payment_intent.succeeded`** (required for top-up balance credit).
4. **Secret:** Copy the **Signing secret** (whsec_…) and set `STRIPE_WEBHOOK_SECRET` in your env. The server returns 500 if the balance update fails so Stripe will retry.

**Recommended events (subscribe to these):**

| Event | Why |
|-------|-----|
| `payment_intent.succeeded` | **Top-up:** credit user balance. Idempotency key = `payment_intent.id` (e.g. `pi_xxx`). Call `apply_balance_transaction(..., 'top_up', 'stripe_payment_intent', pi.id, ...)`. |
| `payment_intent.payment_failed` | Log / notify; optional retry or show error in UI. |
| `payment_method.attached` | When user saves a card: persist in `payment_methods` (user_id, stripe_payment_method_id, last4, brand). |
| `customer.updated` / `payment_method.detached` | Optional: sync default payment method or remove from `payment_methods` when detached. |

**Critical: idempotency**

- For **top-up:** in `payment_intent.succeeded`, use `reference_type = 'stripe_payment_intent'` and `reference_id = event.data.object.id`. The unique constraint on `(reference_type, reference_id)` in `balance_transactions` prevents crediting the same PaymentIntent twice even if Stripe retries the webhook.
- For **debits** (join/renewal): use e.g. `reference_type = 'subscription_debit'`, `reference_id = subscription.id + '_' + period_start`, so one period is only charged once.
- For **payouts:** use `reference_type = 'payout_30d'`, `reference_id = subscription.id + '_' + period_start` (or `payouts.id` after insert), and only create one payout row per (subscription_id, period_start).

---

## 4. Flows in short

### 4.1 Top-up (add money to balance)

1. **Backend:** Create Stripe Customer for user if missing (`stripe_customer_id` on profile). Create PaymentIntent: `amount` (cents), `currency`, `customer` (optional but good for receipts), `metadata: { user_id, purpose: 'top_up' }`. Return `client_secret` to frontend.
2. **Frontend:** Stripe Elements or Card Element; confirm the PaymentIntent with `client_secret`.
3. **Webhook:** On `payment_intent.succeeded`, call `apply_balance_transaction(user_id, amount_cents, 'top_up', 'stripe_payment_intent', pi.id, metadata)`. Only this path should credit balance for top-up so you never double-credit.

### 4.2 Pay with balance (join or renewal)

1. On join (owner accepts slot) or on renewal (cron when `period_end` reached):
   - Compute amount (e.g. `contribution_price` for that period).
   - **Try balance first:** call `apply_balance_transaction(user_id, -amount_cents, 'debit_join' or 'debit_renewal', 'subscription_debit', subscription_id + '_' + period_start, metadata)`. If it raises (balance would go negative), roll back and fall back to card.
   - **If balance insufficient:** create and confirm a PaymentIntent using the user’s saved `default_payment_method_id` (or let user choose). On success, same idempotency: apply the debit with the same `reference_type`/`reference_id` so you don’t double-debit. Optionally also credit balance from Stripe and then debit in one flow; the important part is a single ledger row per (subscription, period) keyed by `reference_id`.

### 4.3 Saved card (add / use for subscriptions)

1. **Attach card:** Create SetupIntent (or PaymentIntent with `setup_future_usage: 'off_session'`). After client confirms, attach the PaymentMethod to the Customer. In `payment_method.attached` (or right after attach in API), insert into `payment_methods` and optionally set `profiles.default_payment_method_id`.
2. **Charge saved card:** When charging on join/renewal, use `payment_method: pm_xxx` and `customer: cus_xxx` with PaymentIntent create/confirm (off_session). On success, apply the balance debit with idempotency as above.

### 4.4 Payout to owner (after 30 days of sharing)

1. **Cron or scheduled job:** Find subscriptions where:
   - `status = 'active'` (or equivalent),
   - `period_start` (or `accepted_at` on the slot) is at least 30 days ago,
   - and you have not yet created a payout for this (subscription_id, period_start).
2. For each:
   - Insert into `payouts` with `unique (subscription_id, period_start)` (or use a reference_id in the ledger). If conflict, skip (already paid).
   - Call `apply_balance_transaction(owner_id, amount_cents, 'payout_owner', 'payout_30d', subscription_id + '_' + period_start, metadata)`.
   - Update `payouts` set `status = 'paid'`, `balance_transaction_id = ...`.

This way each (subscription, period) is paid exactly once.

---

## 5. Security and safety checklist

- **No double credit (top-up):** Only credit in `payment_intent.succeeded` with `reference_id = payment_intent.id`.
- **No double debit (join/renewal):** Single `reference_id` per subscription period (e.g. `subscription_id + '_' + period_start`); use `apply_balance_transaction` and catch idempotency “already applied” as success.
- **No double payout:** One row per (subscription_id, period_start) in `payouts` and one ledger row with `reference_type = 'payout_30d'` and same reference.
- **Balance never negative:** Enforced by `apply_balance_transaction` (check in function) and `user_balances.balance_cents >= 0`.
- **Webhook verification:** Always verify `Stripe-Signature` with `STRIPE_WEBHOOK_SECRET` before processing events.
- **Idempotent API:** For any endpoint that creates a charge or payout, accept an optional idempotency key and map it to `(reference_type, reference_id)` so retries don’t create duplicate operations.

---

## 6. Summary: what you need from Stripe

| Item | Used for |
|------|----------|
| **Publishable key** | Frontend Stripe.js / Elements |
| **Secret key** | Backend: Customers, PaymentIntents, PaymentMethods |
| **Webhook signing secret** | Verify webhook requests |
| **Webhook endpoint** | `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_method.attached` (and optionally detached/updated) |

Database schema for balances, transactions, saved cards, and payouts is in `supabase/migrations/014_wallet_stripe.sql`. All balance changes go through `apply_balance_transaction` with unique `(reference_type, reference_id)` to keep everything secure and free of double charges and double payouts.
