import { Link } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useI18n } from '../contexts/I18nContext'
import { useAuth } from '../contexts/AuthContext'

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

const TOPUP_AMOUNTS = [
  { cents: 1000, label: '10€' },
  { cents: 2000, label: '20€' },
  { cents: 5000, label: '50€' },
  { cents: 10000, label: '100€' },
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
  const [bankMessageShow, setBankMessageShow] = useState(false)
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

  const transactionsInMonth = transactions.filter((tx) => {
    const d = new Date(tx.created_at)
    return d.getFullYear() === monthDate.getFullYear() && d.getMonth() === monthDate.getMonth()
  })

  const openTopup = () => {
    setTopupOpen(true)
    setTopupStep(1)
    setSelectedCents(5000)
    setTopupError('')
    setTopupSuccess('')
    setBankMessageShow(false)
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
        <Link to="/home" className="wallet-back" aria-label={t('dashboard.backToHome')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </Link>

        <h1 className="wallet-title">{t('dashboard.walletTitle')}</h1>
        <p className="wallet-balance-amount">{formatEuros(balanceCents)}€</p>

        <div className="wallet-actions">
          <button type="button" className="wallet-action-btn" onClick={openTopup}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
            <span>{t('dashboard.topUp')}</span>
          </button>
          <button type="button" className="wallet-action-btn" onClick={() => setBankMessageShow(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17 17 7M7 7h10v10" /></svg>
            <span>{t('dashboard.bankTransfer')}</span>
          </button>
        </div>

        {bankMessageShow && (
          <p className="wallet-info-message" role="status">
            Bank transfer is not available yet. Please use Top-up with a card.
            <button type="button" className="wallet-info-message-dismiss" onClick={() => setBankMessageShow(false)} aria-label="Dismiss">Got it</button>
          </p>
        )}

        {topupOpen && (
          <div className="wallet-modal" aria-modal="true" aria-labelledby="wallet-topup-title">
            <div className="wallet-modal-backdrop" onClick={closeTopup} aria-hidden="true" />
            <div className="wallet-modal-box">
              {topupStep === 1 && (
                <div className="wallet-topup-step">
                  <h2 id="wallet-topup-title" className="wallet-modal-title">Top up wallet</h2>
                  <p className="wallet-modal-desc">Add funds to your balance. Choose an amount (€).</p>
                  <div className="wallet-topup-amounts">
                    {TOPUP_AMOUNTS.map(({ cents, label }) => (
                      <button
                        key={cents}
                        type="button"
                        className={`wallet-topup-amount-btn ${selectedCents === cents ? 'wallet-topup-amount-btn--active' : ''}`}
                        data-cents={cents}
                        onClick={() => setSelectedCents(cents)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="wallet-modal-actions wallet-modal-actions--step1">
                    <button type="button" className="wallet-modal-cancel" onClick={closeTopup}>Cancel</button>
                    <button type="button" className="wallet-modal-next" onClick={goNext} disabled={nextLoading}>{nextLoading ? '…' : 'Next'}</button>
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
          <div className={`wallet-receipt ${transactionsInMonth.length === 0 ? 'wallet-receipt--empty' : ''}`}>
            {transactionsInMonth.length > 0 ? (
              <div className="wallet-history-list wallet-history-list--has-items">
                {transactionsInMonth.map((tx) => (
                  <div key={tx.id} className="wallet-history-item">
                    <span className="wallet-history-item-date">{formatTransactionDate(tx.created_at)}</span>
                    <span className="wallet-history-item-label">{tx.type === 'top_up' ? 'Top-up' : tx.type}</span>
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
