import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../contexts/I18nContext'

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

export default function PaymentMethod() {
  const { user, profile, fetchWithAuth, loading } = useAuth()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [withdrawDetails, setWithdrawDetails] = useState(null)
  const [iban, setIban] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [bankSaving, setBankSaving] = useState(false)
  const [bankError, setBankError] = useState('')
  const [bankSuccess, setBankSuccess] = useState(false)
  const [cardSecret, setCardSecret] = useState(null)
  const [cardPublishableKey, setCardPublishableKey] = useState(null)
  const [cardSaving, setCardSaving] = useState(false)
  const [cardError, setCardError] = useState('')
  const [cardSuccess, setCardSuccess] = useState(false)
  const stripeRef = useRef(null)
  const cardNumberRef = useRef(null)
  const cardExpiryRef = useRef(null)
  const cardCvcRef = useRef(null)
  const cardElementRef = useRef(null)
  const elementsRef = useRef(null)

  useEffect(() => {
    if (loading) return
    if (!user && !profile) {
      navigate('/login', { replace: true })
      return
    }
  }, [loading, user, profile, navigate])

  useEffect(() => {
    fetchWithAuth('/api/wallet/withdrawal-details', {})
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setWithdrawDetails(d || {})
        if (d && d.account_holder) setAccountHolder(d.account_holder)
      })
      .catch(() => setWithdrawDetails({ has_iban: false }))
  }, [fetchWithAuth])

  useEffect(() => {
    fetchWithAuth('/api/wallet/setup-intent', { method: 'POST' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.client_secret) {
          setCardSecret(d.client_secret)
          setCardPublishableKey(d.publishableKey || null)
        }
      })
      .catch(() => {})
  }, [fetchWithAuth])

  useEffect(() => {
    if (!cardSecret || !cardPublishableKey || !cardNumberRef.current) return
    cardNumberRef.current.innerHTML = ''
    cardExpiryRef.current.innerHTML = ''
    cardCvcRef.current.innerHTML = ''
    loadStripeScript().then((Stripe) => {
      if (!cardNumberRef.current || !cardExpiryRef.current || !cardCvcRef.current) return
      const stripe = Stripe(cardPublishableKey)
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
    })
  }, [cardSecret, cardPublishableKey])

  const saveBank = () => {
    const raw = String(iban).trim().replace(/\s/g, '')
    if (raw.length < 15) {
      setBankError('Enter a valid IBAN (at least 15 characters)')
      return
    }
    setBankError('')
    setBankSaving(true)
    fetchWithAuth('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ withdrawal_iban: raw, withdrawal_account_holder: accountHolder.trim() || null }),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        if (ok) {
          setBankSuccess(true)
          setWithdrawDetails({ has_iban: true, iban_last4: raw.slice(-4), account_holder: accountHolder.trim() || null })
          setTimeout(() => setBankSuccess(false), 3000)
        } else setBankError(data?.error || 'Failed to save')
      })
      .catch(() => setBankError('Request failed'))
      .finally(() => setBankSaving(false))
  }

  const saveCard = () => {
    const stripe = stripeRef.current
    const secret = cardSecret
    const cardElement = cardElementRef.current
    if (!stripe || !secret || !cardElement) {
      setCardError('Payment form not ready')
      return
    }
    setCardError('')
    setCardSaving(true)
    stripe
      .confirmCardSetup(secret, { payment_method: { card: cardElement } })
      .then((result) => {
        if (result.error) throw new Error(result.error.message || 'Failed to save card')
        setCardSuccess(true)
        setTimeout(() => setCardSuccess(false), 3000)
      })
      .catch((e) => setCardError(e.message || 'Failed to save card'))
      .finally(() => setCardSaving(false))
  }

  if (loading) {
    return (
      <main className="dashboard-main">
        <p className="dash-muted">{t('common.loading')}</p>
      </main>
    )
  }

  return (
    <main className="dashboard-main dashboard-content dashboard-content--profile">
      <div className="profile-layout">
        <div className="profile-main" style={{ maxWidth: '100%' }}>
          <Link to="/profile" className="profile-nav-item" style={{ display: 'inline-flex', marginBottom: '1rem' }}>
            <span className="profile-nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg></span>
            <span>Back to profile</span>
          </Link>

          <h1 className="profile-main-title">Payment method</h1>
          <p className="profile-panel-desc">Manage your card for top-ups and your bank account (IBAN) for withdrawals.</p>

          <div className="profile-card">
            <h2 className="profile-card-title">Card for top-ups</h2>
            <p className="profile-card-text">Add or update the card used when you top up your wallet.</p>
            {cardSecret && cardPublishableKey ? (
              <>
                <div className="wallet-card-fields" style={{ marginBottom: '1rem' }}>
                  <div className="wallet-card-field">
                    <label className="wallet-card-label">Card number</label>
                    <div ref={cardNumberRef} className="subscription-chat-input" style={{ padding: '10px', minHeight: '40px' }} />
                  </div>
                  <div className="wallet-card-field" style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <label className="wallet-card-label">Expiry</label>
                      <div ref={cardExpiryRef} className="subscription-chat-input" style={{ padding: '10px', minHeight: '40px' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="wallet-card-label">CVC</label>
                      <div ref={cardCvcRef} className="subscription-chat-input" style={{ padding: '10px', minHeight: '40px' }} />
                    </div>
                  </div>
                </div>
                {cardError && <p className="profile-form-error" role="alert">{cardError}</p>}
                {cardSuccess && <p className="profile-form-error" style={{ color: '#059669' }}>Card saved.</p>}
                <button type="button" className="profile-btn profile-btn--primary" onClick={saveCard} disabled={cardSaving}>
                  {cardSaving ? 'Saving…' : 'Save card'}
                </button>
              </>
            ) : (
              <p className="dash-muted">Loading payment form…</p>
            )}
          </div>

          <div className="profile-card">
            <h2 className="profile-card-title">Bank account (IBAN) for withdrawals</h2>
            <p className="profile-card-text">Withdrawals from your wallet are sent to this account. Admin will confirm each withdrawal (e.g. via Stripe) before the transfer.</p>
            {withdrawDetails && withdrawDetails.has_iban && (
              <p className="profile-card-text" style={{ marginBottom: '0.5rem' }}>
                Saved: ****{withdrawDetails.iban_last4 || '····'}
                {withdrawDetails.account_holder ? ` — ${withdrawDetails.account_holder}` : ''}
              </p>
            )}
            <div className="profile-form-field" style={{ marginBottom: '0.75rem' }}>
              <label htmlFor="payment-iban">IBAN</label>
              <input
                id="payment-iban"
                type="text"
                placeholder="e.g. FR76 1234 5678 9012 3456 7890 123"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                className="subscription-chat-input"
                style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
                autoComplete="off"
              />
            </div>
            <div className="profile-form-field" style={{ marginBottom: '0.75rem' }}>
              <label htmlFor="payment-account-holder">Account holder name</label>
              <input
                id="payment-account-holder"
                type="text"
                placeholder="Name on the bank account"
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                className="subscription-chat-input"
                style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
                autoComplete="off"
              />
            </div>
            {bankError && <p className="profile-form-error" role="alert">{bankError}</p>}
            {bankSuccess && <p className="profile-form-error" style={{ color: '#059669' }}>Bank details saved.</p>}
            <button type="button" className="profile-btn profile-btn--primary" onClick={saveBank} disabled={bankSaving}>
              {bankSaving ? 'Saving…' : 'Save bank details'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
