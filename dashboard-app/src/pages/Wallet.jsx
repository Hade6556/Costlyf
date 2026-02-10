import { Link } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useI18n } from '../contexts/I18nContext'
import { useAuth } from '../contexts/AuthContext'
import './Wallet.css'

function formatEuros(cents) {
  if (cents == null) return '0'
  return (cents / 100).toFixed(2).replace('.', ',')
}

function formatTransactionDate(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    return `${day}/${month} ${h}:${m}`
  } catch (e) {
    return iso
  }
}

const TOPUP_MIN_CENTS = 1000   // 10€
const TOPUP_MAX_CENTS = 15000  // 150€
const TOPUP_PRESETS = [
  { cents: 2000, label: '20€' },
  { cents: 3000, label: '30€' },
  { cents: 5000, label: '50€' },
  { cents: 8000, label: '80€' },
]

function loadStripeScript() {
  if (window.Stripe) return Promise.resolve(window.Stripe)
  return new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = 'https://js.stripe.com/v3/'
    s.async = true
    s.onload = () => resolve(window.Stripe)
    document.head.appendChild(s)
  })
}

export default function Wallet() {
  const { t, locale } = useI18n()
  const { fetchWithAuth } = useAuth()
  const [balanceCents, setBalanceCents] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [monthDate, setMonthDate] = useState(() => new Date())
  const [topupOpen, setTopupOpen] = useState(false)
  const [topupStep, setTopupStep] = useState(1)
  const [selectedCents, setSelectedCents] = useState(5000)
  const [topupError, setTopupError] = useState('')
  const [topupSuccess, setTopupSuccess] = useState('')
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawCents, setWithdrawCents] = useState(0)
  const [withdrawError, setWithdrawError] = useState('')
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [withdrawalDetails, setWithdrawalDetails] = useState(null)
  const [payLoading, setPayLoading] = useState(false)
  const [nextLoading, setNextLoading] = useState(false)
  const stripeRef = useRef(null)
  const cardNumberRef = useRef(null)
  const cardExpiryRef = useRef(null)
  const cardCvcRef = useRef(null)
  const cardElementRef = useRef(null)
  const elementsRef = useRef(null)
  const clientSecretRef = useRef(null)
  const publishableKeyRef = useRef(null)

  const monthLabel = monthDate.toLocaleString(locale || 'en', { month: 'long', year: 'numeric' })
  const prevMonth = () => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextMonth = () => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))

  const loadBalance = useCallback(() => {
    fetchWithAuth('/api/wallet/balance', {})
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setBalanceCents(data && data.balance_cents != null ? data.balance_cents : 0))
      .catch(() => setBalanceCents(0))
  }, [fetchWithAuth])

  const loadTransactions = useCallback(() => {
    fetchWithAuth('/api/wallet/transactions', {})
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setTransactions((data && data.transactions) ? data.transactions : []))
      .catch(() => setTransactions([]))
  }, [fetchWithAuth])

  useEffect(() => {
    loadBalance()
    loadTransactions()
  }, [loadBalance, loadTransactions])

  const loadWithdrawalDetails = useCallback(() => {
    fetchWithAuth('/api/wallet/withdrawal-details', {})
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setWithdrawalDetails(d || {}))
      .catch(() => setWithdrawalDetails({ has_iban: false }))
  }, [fetchWithAuth])

  useEffect(() => {
    if (withdrawOpen) loadWithdrawalDetails()
  }, [withdrawOpen, loadWithdrawalDetails])

  const transactionsInMonth = transactions.filter((tx) => {
    const d = new Date(tx.created_at)
    return d.getFullYear() === monthDate.getFullYear() && d.getMonth() === monthDate.getMonth()
  })

  const openTopup = () => {
    setTopupOpen(true)
    setTopupStep(1)
    setSelectedCents(1000)
    setTopupError('')
    setTopupSuccess('')
    clientSecretRef.current = null
    publishableKeyRef.current = null
    stripeRef.current = null
    elementsRef.current = null
    cardElementRef.current = null
  }

  const closeTopup = () => {
    setTopupOpen(false)
    setTopupStep(1)
    setTopupError('')
    setTopupSuccess('')
    setPayLoading(false)
    setNextLoading(false)
    if (cardNumberRef.current) cardNumberRef.current.innerHTML = ''
    if (cardExpiryRef.current) cardExpiryRef.current.innerHTML = ''
    if (cardCvcRef.current) cardCvcRef.current.innerHTML = ''
  }

  const goNext = () => {
    setTopupError('')
    setNextLoading(true)
    fetchWithAuth('/api/wallet/topup-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_cents: selectedCents }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        if (!data.client_secret || !data.publishableKey) throw new Error('Missing Stripe keys')
        clientSecretRef.current = data.client_secret
        publishableKeyRef.current = data.publishableKey
        setTopupStep(2)
      })
      .catch((e) => setTopupError(e.message || 'Something went wrong'))
      .finally(() => setNextLoading(false))
  }

  // Mount Stripe card elements when step 2 is shown (refs exist only after step 2 is rendered)
  useEffect(() => {
    if (topupStep !== 2 || !clientSecretRef.current || !publishableKeyRef.current || !cardNumberRef.current) return
    const key = publishableKeyRef.current
    loadStripeScript().then((Stripe) => {
      if (!cardNumberRef.current || !cardExpiryRef.current || !cardCvcRef.current) return
      cardNumberRef.current.innerHTML = ''
      cardExpiryRef.current.innerHTML = ''
      cardCvcRef.current.innerHTML = ''
      const stripe = Stripe(key)
      stripeRef.current = stripe
      const elements = stripe.elements()
      elementsRef.current = elements
      const style = { base: { fontSize: '16px', paddingLeft: '12px', paddingRight: '12px' } }
      const cardNumber = elements.create('cardNumber', { style, disableLink: true })
      const cardExpiry = elements.create('cardExpiry', { style })
      const cardCvc = elements.create('cardCvc', { style })
      cardElementRef.current = cardNumber
      cardNumber.mount(cardNumberRef.current)
      cardExpiry.mount(cardExpiryRef.current)
      cardCvc.mount(cardCvcRef.current)
    }).catch((e) => setTopupError(e.message || 'Failed to load payment form'))
  }, [topupStep])

  const goBack = () => {
    setTopupError('')
    setTopupSuccess('')
    if (cardNumberRef.current) cardNumberRef.current.innerHTML = ''
    if (cardExpiryRef.current) cardExpiryRef.current.innerHTML = ''
    if (cardCvcRef.current) cardCvcRef.current.innerHTML = ''
    stripeRef.current = null
    elementsRef.current = null
    clientSecretRef.current = null
    publishableKeyRef.current = null
    cardElementRef.current = null
    setTopupStep(1)
  }

  const doPay = () => {
    const stripe = stripeRef.current
    const secret = clientSecretRef.current
    const cardElement = cardElementRef.current
    if (!stripe || !secret || !cardElement) return
    setTopupError('')
    setPayLoading(true)
    stripe
      .confirmCardPayment(secret, { payment_method: { card: cardElement } })
      .then((result) => {
        if (result.error) throw new Error(result.error.message || 'Payment failed')
        setTopupSuccess('Payment successful. Updating balance…')
        // Poll for updated balance/history (Stripe webhook updates backend asynchronously)
        let pollCount = 0
        const maxPolls = 8
        const pollMs = 500
        const poll = () => {
          loadBalance()
          loadTransactions()
          pollCount += 1
          if (pollCount < maxPolls) {
            setTimeout(poll, pollMs)
          } else {
            closeTopup()
            loadBalance()
            loadTransactions()
          }
        }
        setTimeout(poll, pollMs)
      })
      .catch((e) => setTopupError(e.message || 'Something went wrong'))
      .finally(() => setPayLoading(false))
  }

  return (
    <main className="dashboard-main dashboard-main--wallet">
      <section className="wallet-screen">
        <h1 className="wallet-title">{t('dashboard.walletTitle')}</h1>
        {balanceCents === null ? (
          <div className="wallet-balance-loading" aria-hidden="true">
            <span className="wallet-loading-shimmer wallet-loading-shimmer--balance" />
          </div>
        ) : (
          <p className="wallet-balance-amount">{formatEuros(balanceCents)}€</p>
        )}

        <div className="wallet-actions">
          <button type="button" className="wallet-action-btn" onClick={openTopup}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
            <span>{t('dashboard.topUp')}</span>
          </button>
          <button type="button" className="wallet-action-btn" disabled={(balanceCents || 0) < 500} onClick={() => { setWithdrawOpen(true); setWithdrawCents(Math.min(5000, Math.max(500, balanceCents || 0))); setWithdrawError(''); loadWithdrawalDetails(); }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17 17 7M7 7h10v10" /></svg>
            <span>Withdraw to bank</span>
          </button>
        </div>

        {withdrawOpen && (
          <div className="wallet-modal" aria-modal="true" aria-labelledby="wallet-withdraw-title">
            <div className="wallet-modal-backdrop" onClick={() => setWithdrawOpen(false)} aria-hidden="true" />
            <div className="wallet-modal-box">
              <h2 id="wallet-withdraw-title" className="wallet-modal-title">Withdraw to bank</h2>
              {withdrawalDetails && !withdrawalDetails.has_iban ? (
                <p className="wallet-modal-desc">
                  Add your bank IBAN on the <Link to="/profile/payment-method" onClick={() => setWithdrawOpen(false)}>Payment method</Link> page in Profile first. Withdrawals are then sent to that account in about 24 hours.
                </p>
              ) : (
                <p className="wallet-modal-desc">
                  Available: {formatEuros(balanceCents)}€. Enter amount (min 5€). Withdrawal will be sent to your registered bank account (****{withdrawalDetails?.iban_last4 || '····'}) after admin confirmation.
                </p>
              )}
              {withdrawalDetails?.has_iban && (
                <>
                  <div className="wallet-topup-stepper">
                    <button
                      type="button"
                      className="wallet-topup-stepper-btn wallet-topup-stepper-btn--minus"
                      aria-label="Decrease amount"
                      disabled={withdrawCents <= 500}
                      onClick={() => setWithdrawCents((c) => Math.max(500, c - 100))}
                    >
                      −
                    </button>
                    <span className="wallet-topup-stepper-value">{withdrawCents / 100}€</span>
                    <button
                      type="button"
                      className="wallet-topup-stepper-btn wallet-topup-stepper-btn--plus"
                      aria-label="Increase amount"
                      disabled={withdrawCents >= (balanceCents || 0)}
                      onClick={() => setWithdrawCents((c) => Math.min(balanceCents || 0, c + 100))}
                    >
                      +
                    </button>
                  </div>
                  <p className="wallet-topup-hint">
                    Enter an amount between €5 and €{formatEuros(balanceCents)}
                  </p>
                  <div className="wallet-topup-presets">
                    {TOPUP_PRESETS.filter((a) => a.cents <= (balanceCents || 0)).map(({ cents, label }) => (
                      <button
                        key={cents}
                        type="button"
                        className={`wallet-topup-preset-btn ${withdrawCents === cents ? 'wallet-topup-preset-btn--active' : ''}`}
                        onClick={() => setWithdrawCents(cents)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {withdrawError && <p className="wallet-modal-error" role="alert">{withdrawError}</p>}
                  <div className="wallet-modal-actions wallet-modal-actions--step1">
                    <button type="button" className="wallet-modal-cancel" onClick={() => setWithdrawOpen(false)}>Cancel</button>
                    <button
                      type="button"
                      className="wallet-modal-next wallet-modal-next--full"
                      disabled={withdrawLoading || withdrawCents < 500 || withdrawCents > (balanceCents || 0)}
                      onClick={() => {
                        setWithdrawError('')
                        setWithdrawLoading(true)
                        fetchWithAuth('/api/wallet/withdraw', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ amount_cents: withdrawCents }),
                        })
                          .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
                          .then(({ ok, data }) => {
                            if (ok) {
                              setWithdrawOpen(false)
                              loadBalance()
                              loadTransactions()
                            } else throw new Error(data?.error || 'Withdrawal failed')
                          })
                          .catch((e) => setWithdrawError(e.message || 'Withdrawal failed'))
                          .finally(() => setWithdrawLoading(false))
                      }}
                    >
                      {withdrawLoading ? '…' : `Withdraw ${(withdrawCents / 100).toFixed(2)}€`}
                    </button>
                  </div>
                </>
              )}
              {!withdrawalDetails?.has_iban && (
                <div className="wallet-modal-actions wallet-modal-actions--step1">
                  <button type="button" className="wallet-modal-cancel" onClick={() => setWithdrawOpen(false)}>Close</button>
                </div>
              )}
            </div>
          </div>
        )}

        {topupOpen && (
          <div className="wallet-modal" aria-modal="true" aria-labelledby="wallet-topup-title">
            <div className="wallet-modal-backdrop" onClick={closeTopup} aria-hidden="true" />
            <div className="wallet-modal-box">
              {topupStep === 1 && (
                <div className="wallet-topup-step">
                  <h2 id="wallet-topup-title" className="wallet-modal-title">Top up my balance</h2>
                  <p className="wallet-modal-desc">Enter the amount to credit to your wallet.</p>
                  <div className="wallet-topup-stepper">
                    <button
                      type="button"
                      className="wallet-topup-stepper-btn wallet-topup-stepper-btn--minus"
                      aria-label="Decrease amount"
                      disabled={selectedCents <= TOPUP_MIN_CENTS}
                      onClick={() => setSelectedCents((c) => Math.max(TOPUP_MIN_CENTS, c - 100))}
                    >
                      −
                    </button>
                    <span className="wallet-topup-stepper-value">{selectedCents / 100}€</span>
                    <button
                      type="button"
                      className="wallet-topup-stepper-btn wallet-topup-stepper-btn--plus"
                      aria-label="Increase amount"
                      disabled={selectedCents >= TOPUP_MAX_CENTS}
                      onClick={() => setSelectedCents((c) => Math.min(TOPUP_MAX_CENTS, c + 100))}
                    >
                      +
                    </button>
                  </div>
                  <p className="wallet-topup-hint">Enter an amount between €10 and €150</p>
                  <div className="wallet-topup-presets">
                    {TOPUP_PRESETS.map(({ cents, label }) => (
                      <button
                        key={cents}
                        type="button"
                        className={`wallet-topup-preset-btn ${selectedCents === cents ? 'wallet-topup-preset-btn--active' : ''}`}
                        onClick={() => setSelectedCents(cents)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="wallet-modal-actions wallet-modal-actions--step1">
                    <button type="button" className="wallet-modal-cancel" onClick={closeTopup}>Cancel</button>
                    <button type="button" className="wallet-modal-next wallet-modal-next--full" onClick={goNext} disabled={nextLoading}>{nextLoading ? '…' : 'Next'}</button>
                  </div>
                </div>
              )}
              {topupStep === 2 && (
                <div className="wallet-topup-step">
                  <h2 className="wallet-modal-title">Card details</h2>
                  <p className="wallet-modal-desc">Pay <span>{selectedCents / 100}</span> € — enter your card details below.</p>
                  <div className="wallet-card-fields">
                    <div className="wallet-card-field">
                      <label className="wallet-card-label">Card number</label>
                      <div ref={cardNumberRef} className="wallet-stripe-input" />
                    </div>
                    <div className="wallet-card-field-row">
                      <div className="wallet-card-field">
                        <label className="wallet-card-label">Expiry</label>
                        <div ref={cardExpiryRef} className="wallet-stripe-input" />
                      </div>
                      <div className="wallet-card-field">
                        <label className="wallet-card-label">CVC</label>
                        <div ref={cardCvcRef} className="wallet-stripe-input" />
                      </div>
                    </div>
                  </div>
                  <p className="wallet-modal-hint">Test card: 4242 4242 4242 4242, expiry 12/34, CVC 123</p>
                  {topupError && <p className="wallet-modal-error" role="alert">{topupError}</p>}
                  {topupSuccess && <p className="wallet-modal-error wallet-modal-success" role="status">{topupSuccess}</p>}
                  <div className="wallet-modal-actions wallet-modal-actions--step2">
                    <button type="button" className="wallet-modal-back" onClick={goBack}>Back</button>
                    <button type="button" className="wallet-modal-pay" onClick={doPay} disabled={payLoading}>Pay {selectedCents / 100} €</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="wallet-card wallet-card--upcoming">
          <div className="wallet-card-main">
            <span className="wallet-card-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            </span>
            <div className="wallet-card-text">
              <span className="wallet-card-title">{t('dashboard.upcomingBalance')}</span>
              <span className="wallet-card-sub">{t('dashboard.inNext30Days')}</span>
            </div>
          </div>
          <div className="wallet-card-right">
            <span className="wallet-card-value">+ 0€</span>
          </div>
        </div>

        <div className="wallet-card wallet-card--history">
          <div className="wallet-history-head">
            <h2 className="wallet-history-title">{t('dashboard.history')}</h2>
            <div className="wallet-month-nav">
              <button type="button" className="wallet-month-btn" aria-label={t('dashboard.previous')} onClick={prevMonth}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
              </button>
              <span className="wallet-month-label">{monthLabel}</span>
              <button type="button" className="wallet-month-btn" aria-label={t('dashboard.nextLabel')} onClick={nextMonth}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
              </button>
            </div>
          </div>
          <div className={`wallet-receipt ${transactionsInMonth.length === 0 && balanceCents !== null ? 'wallet-receipt--empty' : ''}`}>
            {balanceCents === null ? (
              <div className="wallet-history-loading" aria-hidden="true">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="wallet-history-loading-row">
                    <span className="wallet-loading-shimmer wallet-loading-shimmer--date" />
                    <span className="wallet-loading-shimmer wallet-loading-shimmer--label" />
                    <span className="wallet-loading-shimmer wallet-loading-shimmer--amount" />
                  </div>
                ))}
              </div>
            ) : transactionsInMonth.length > 0 ? (
              <div className="wallet-history-list wallet-history-list--has-items">
                {transactionsInMonth.map((tx) => (
                  <div key={tx.id} className="wallet-history-item">
                    <span className="wallet-history-item-date">{formatTransactionDate(tx.created_at)}</span>
                    <span className="wallet-history-item-label">
                      {tx.type === 'top_up'
                        ? 'Top-up'
                        : tx.type === 'debit_join'
                          ? (tx.metadata?.service_name && tx.metadata?.owner_alias
                              ? `${tx.metadata.service_name} – ${tx.metadata.owner_alias}`
                              : tx.metadata?.service_name
                                ? tx.metadata.service_name
                                : 'Subscription join')
                          : tx.type === 'hold_join'
                            ? (tx.metadata?.service_name && tx.metadata?.owner_alias
                                ? `Pending: ${tx.metadata.service_name} – ${tx.metadata.owner_alias}`
                                : tx.metadata?.service_name
                                  ? `Pending: ${tx.metadata.service_name}`
                                  : 'Pending join')
                            : tx.type === 'refund_hold_join'
                              ? (tx.metadata?.service_name && tx.metadata?.owner_alias
                                  ? `Refund: ${tx.metadata.service_name} – ${tx.metadata.owner_alias}`
                                  : tx.metadata?.service_name
                                    ? `Refund: ${tx.metadata.service_name}`
                                    : 'Refund (join declined)')
                              : tx.type === 'withdrawal'
                                ? 'Withdraw to bank'
                                : tx.type}
                    </span>
                    <span className="wallet-history-item-amount">
                      {tx.amount_cents >= 0 ? '+' : ''}{formatEuros(tx.amount_cents)}€
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="wallet-history-empty">{t('dashboard.noHistory')}</p>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
