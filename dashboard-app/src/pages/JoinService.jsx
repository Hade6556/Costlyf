import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../contexts/I18nContext'
import { getServiceMeta } from '../data/joinServices'
import { getPriceBreakdown } from '../data/services'

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

const TOPUP_AMOUNTS = [
  { cents: 1000, label: '10€' },
  { cents: 2000, label: '20€' },
  { cents: 5000, label: '50€' },
  { cents: 10000, label: '100€' },
]

function JoinModalTopupCard({
  fetchWithAuth,
  topupCents,
  topupClientSecretRef,
  topupPublishableKeyRef,
  topupCardNumberRef,
  topupCardExpiryRef,
  topupCardCvcRef,
  topupStripeRef,
  topupElementsRef,
  topupCardElementRef,
  loadStripeScript,
  topupError,
  setTopupError,
  onSuccess,
}) {
  const [payLoading, setPayLoading] = useState(false)
  useEffect(() => {
    if (!topupClientSecretRef.current || !topupPublishableKeyRef.current || !topupCardNumberRef.current) return
    const key = topupPublishableKeyRef.current
    loadStripeScript().then((Stripe) => {
      if (!topupCardNumberRef.current || !topupCardExpiryRef.current || !topupCardCvcRef.current) return
      topupCardNumberRef.current.innerHTML = ''
      topupCardExpiryRef.current.innerHTML = ''
      topupCardCvcRef.current.innerHTML = ''
      const stripe = Stripe(key)
      topupStripeRef.current = stripe
      const elements = stripe.elements()
      topupElementsRef.current = elements
      const style = { base: { fontSize: '16px', paddingLeft: '12px', paddingRight: '12px' } }
      const cardNumber = elements.create('cardNumber', { style, disableLink: true })
      const cardExpiry = elements.create('cardExpiry', { style })
      const cardCvc = elements.create('cardCvc', { style })
      topupCardElementRef.current = cardNumber
      cardNumber.mount(topupCardNumberRef.current)
      cardExpiry.mount(topupCardExpiryRef.current)
      cardCvc.mount(topupCardCvcRef.current)
    }).catch((e) => setTopupError(e.message || 'Failed to load payment form'))
  }, [])
  const handlePay = () => {
    const stripe = topupStripeRef.current
    const secret = topupClientSecretRef.current
    const cardElement = topupCardElementRef.current
    if (!stripe || !secret || !cardElement) return
    setTopupError('')
    setPayLoading(true)
    stripe.confirmCardPayment(secret, { payment_method: { card: cardElement } })
      .then((result) => {
        if (result.error) throw new Error(result.error.message || 'Payment failed')
        let pollCount = 0
        const poll = () => {
          fetchWithAuth('/api/wallet/balance', {}).then((r) => r.ok ? r.json() : null).then((data) => {
            if (data && data.balance_cents != null) onSuccess()
          })
          pollCount += 1
          if (pollCount < 10) setTimeout(poll, 500)
          else onSuccess()
        }
        setTimeout(poll, 500)
      })
      .catch((e) => setTopupError(e.message || 'Payment failed'))
      .finally(() => setPayLoading(false))
  }
  return (
    <>
      <p className="join-offer-subtitle">Pay {topupCents / 100}€ — enter your card details.</p>
      <div className="wallet-card-fields" style={{ marginBottom: '1rem' }}>
        <div className="wallet-card-field">
          <label className="wallet-card-label">Card number</label>
          <div ref={topupCardNumberRef} className="wallet-stripe-input" style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }} />
        </div>
        <div className="wallet-card-field-row" style={{ display: 'flex', gap: '0.5rem' }}>
          <div className="wallet-card-field" style={{ flex: 1 }}>
            <label className="wallet-card-label">Expiry</label>
            <div ref={topupCardExpiryRef} className="wallet-stripe-input" style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }} />
          </div>
          <div className="wallet-card-field" style={{ flex: 1 }}>
            <label className="wallet-card-label">CVC</label>
            <div ref={topupCardCvcRef} className="wallet-stripe-input" style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }} />
          </div>
        </div>
      </div>
      {topupError && <p className="join-offer-insufficient" role="alert">{topupError}</p>}
      <button type="button" className="join-offer-pay" disabled={payLoading} onClick={handlePay}>
        {payLoading ? '…' : `Pay ${(topupCents / 100).toFixed(2)}€`}
      </button>
    </>
  )
}

const LOGO_MAP = {
  netflix: '/media/brand-logos/netflix.svg',
  'youtube-premium': '/media/brand-logos/youtube.svg',
  spotify: '/media/brand-logos/spotify.svg',
  disney: '/media/brand-logos/disney.svg',
  'prime-video': '/media/brand-logos/prime-video.svg',
  crunchyroll: '/media/brand-logos/disney.svg',
}

function trustRingClass(trust) {
  const t = Math.min(10, Math.max(0, parseInt(trust, 10) || 0))
  return t >= 1 && t <= 10 ? `service-offer-trust-ring--${t}` : ''
}

export default function JoinService() {
  const { t, locale } = useI18n()
  const currentLocale = locale || (typeof window !== 'undefined' && window.location.pathname.split('/')[1]) || 'en'
  const { service: serviceSlug } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { fetchWithAuth, user } = useAuth()
  const meta = getServiceMeta(serviceSlug)
  const [offers, setOffers] = useState([])
  const [joinedIds, setJoinedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [planFilter, setPlanFilter] = useState('all')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [instantOnly, setInstantOnly] = useState(false)
  const [sortBy, setSortBy] = useState('trust')
  const [joinModal, setJoinModal] = useState(null) // { offerId, offer }
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  const offerIdFromUrl = searchParams.get('offer')
  const tokenFromUrl = searchParams.get('token')

  useEffect(() => {
    if (!serviceSlug) return
    fetch(`/api/offers?service=${encodeURIComponent(serviceSlug)}&minSeats=1`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setOffers(Array.isArray(data) ? data : []))
      .catch(() => setOffers([]))
      .finally(() => setLoading(false))
  }, [serviceSlug])

  useEffect(() => {
    if (!offerIdFromUrl) return
    if (!user) {
      const redirect = `${window.location.pathname}${window.location.search}`
      navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true })
      return
    }
    const qs = tokenFromUrl ? `?token=${encodeURIComponent(tokenFromUrl)}` : ''
    fetchWithAuth(`/api/offers/${encodeURIComponent(offerIdFromUrl)}${qs}`, {})
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return
        const available = (data.slots || []).filter((s) => s.status === 'available')
        if (available.length > 0) setJoinModal(data)
      })
      .catch(() => {})
  }, [offerIdFromUrl, tokenFromUrl, user, navigate, fetchWithAuth])

  useEffect(() => {
    const token = typeof localStorage !== 'undefined' && localStorage.getItem('costlyf_access_token')
    if (!token) {
      setJoinedIds(new Set())
      return
    }
    fetchWithAuth('/api/offers/joined', {})
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const ids = new Set((Array.isArray(data) ? data : []).map((j) => j.id))
        setJoinedIds(ids)
      })
      .catch(() => setJoinedIds(new Set()))
  }, [fetchWithAuth, serviceSlug])

  const filtered = offers
    .filter((o) => {
      const plan = (o.plan || 'premium').toLowerCase()
      if (planFilter !== 'all' && plan !== planFilter) return false
      if (verifiedOnly && !o.verified) return false
      if (instantOnly && !o.instant) return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'trust') return (b.trust_score || 0) - (a.trust_score || 0)
      if (sortBy === 'price') return (a.contribution_per_month || 0) - (b.contribution_per_month || 0)
      return 0
    })

  const priceStr = (o) => {
    const c = o.contribution_per_month
    const n = c == null || c === '' ? 0 : Number(c)
    return (Number.isNaN(n) ? 0 : n).toFixed(2)
  }

  return (
    <main className="dashboard-main dashboard-content dashboard-content--service">
      <header className="service-header">
        <Link to="/join" className="service-back" aria-label={t('dashboard.back')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
        </Link>
        <div className="service-header-center">
          <h1 className="service-title">{meta.name}</h1>
          <p className="service-desc">{meta.description}</p>
        </div>
      </header>

      {/* Service title (prominent on mobile) + offer cards */}
      <div className="service-page-title-wrap">
        <h2 className="service-page-title">{meta.name}</h2>
      </div>

      <div className="service-layout">
        <aside className="service-sidebar">
          <div className="service-filters">
            <p className="service-filter-label">{t('dashboard.typeOfPlan', { service: meta.name })}</p>
            <div className="service-plan-pills">
              {['all', 'standard', 'premium'].map((plan) => (
                <button
                  key={plan}
                  type="button"
                  className={`service-plan-pill ${planFilter === plan ? 'service-plan-pill--active' : ''}`}
                  data-plan-filter={plan}
                  onClick={() => setPlanFilter(plan)}
                >
                  {plan === 'all' ? t('dashboard.all') : t('dashboard.' + plan)}
                </button>
              ))}
            </div>
            <div className="service-toggle-row">
              <span className="service-toggle-icon" aria-hidden="true"><img src="/media/icons/ic--round-verified.svg" alt="" width="24" height="24" /></span>
              <span className="service-toggle-label">{t('dashboard.subscriptionVerified')}</span>
              <label className="service-toggle-wrap">
                <input type="checkbox" className="service-toggle-input" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
                <span className="service-toggle-slider" />
              </label>
            </div>
            <div className="service-toggle-row">
              <span className="service-toggle-icon service-toggle-icon--bolt" aria-hidden="true"><img src="/media/icons/ic--round-bolt.svg" alt="" width="24" height="24" /></span>
              <span className="service-toggle-label">{t('dashboard.instantlyAccepts')}</span>
              <label className="service-toggle-wrap">
                <input type="checkbox" className="service-toggle-input" checked={instantOnly} onChange={(e) => setInstantOnly(e.target.checked)} />
                <span className="service-toggle-slider" />
              </label>
            </div>
            <p className="service-filter-label">{t('dashboard.sortBy')}:</p>
            <div className="service-sort-list">
              {[
                { id: 'trust', label: t('dashboard.trustScore'), icon: 'mingcute--medal-line.svg' },
                { id: 'price', label: t('dashboard.lowestPrice'), icon: 'mingcute--coin-2-line.svg' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`service-sort-item ${sortBy === s.id ? 'service-sort-item--active' : ''}`}
                  data-sort={s.id}
                  onClick={() => setSortBy(s.id)}
                >
                  <span className="service-sort-icon"><img src={`/media/icons/${s.icon}`} alt="" width="18" height="18" /></span>
                  <span>{s.label}</span>
                  <span className="service-sort-chevron">›</span>
                </button>
              ))}
            </div>
            <div className="service-become-owner">
              <h3 className="service-become-owner-title">{t('dashboard.becomeOwner')}</h3>
              <p className="service-become-owner-desc">{t('dashboard.becomeOwnerDesc', { service: meta.name })}</p>
              <Link to="/share" className="service-share-btn">{t('dashboard.shareMy', { service: meta.name })}</Link>
            </div>
          </div>
        </aside>

        <main className="service-main">
          {loading && (
            <div className="service-offers-list" aria-hidden="false">
              <div className="skeleton-cards" id="service-offers-loading">
                <div className="skeleton-card skeleton-card--offer"><span className="skeleton-card__avatar" /><div className="skeleton-card__lines"><span className="skeleton-card__line skeleton-card__line--name" /><span className="skeleton-card__line skeleton-card__line--sub" /></div><span className="skeleton-card__chevron" /></div>
                <div className="skeleton-card skeleton-card--offer"><span className="skeleton-card__avatar" /><div className="skeleton-card__lines"><span className="skeleton-card__line skeleton-card__line--name" /><span className="skeleton-card__line skeleton-card__line--sub" /></div><span className="skeleton-card__chevron" /></div>
              </div>
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <p className="service-offers-empty">{t('dashboard.noOffersNow')}</p>
          )}
          {!loading && filtered.length > 0 && (
            <div className="service-offers-list" id="service-offers-list">
              {filtered.map((o) => {
                const plan = (o.plan || 'premium').toLowerCase()
                const trust = o.trust_score != null ? o.trust_score : 0
                const trustDisplay = trust > 0 ? String(trust) : '—'
                const displayName = o.owner_name || 'Host'
                const avatarSrc = (o.owner_avatar_url && o.owner_avatar_url.trim()) ? o.owner_avatar_url : '/media/hero-profiles/1.webp'
                const isOwner = user && o.owner_id === user.id
                const isJoined = joinedIds.has(o.id)
                return (
                  <article key={o.id} className="service-offer-card" data-offer-id={o.id} data-plan={plan} data-verified={!!o.verified} data-instant={!!o.instant} data-trust={trust} data-price={o.contribution_per_month || 0}>
                    <div className={`service-offer-avatar-wrap ${trustRingClass(trust)}`}>
                      <div className="service-offer-avatar service-offer-avatar--img"><img src={avatarSrc} alt="" /></div>
                      <span className="service-offer-trust">{trustDisplay}</span>
                    </div>
                    <div className="service-offer-body">
                      <p className="service-offer-text"><strong>{displayName}</strong> {t('dashboard.isSharing')} {o.service_name || o.service} {(o.plan === 'Standard' || o.plan === 'Premium' ? t('dashboard.' + (o.plan || 'premium').toLowerCase()) : (o.plan || 'Premium'))} <span className="service-tv-icon">[🚫TV]</span></p>
                      <div className="service-offer-badges">
                        {o.verified && <span className="service-offer-badge service-offer-badge--verified"><img src="/media/icons/ic--round-verified.svg" alt="" width="12" height="12" className="service-offer-badge-icon" /> VERIFIED SUBSCRIPTION</span>}
                        {o.instant && <span className="service-offer-badge service-offer-badge--instant"><img src="/media/icons/ic--round-bolt.svg" alt="" width="12" height="12" className="service-offer-badge-icon" /> Instant</span>}
                      </div>
                    </div>
                    <div className="service-offer-right">
                      <span className="service-offer-price">{priceStr(o)} <span className="service-offer-period">{t('dashboard.eurPerMonth')}</span></span>
                      {isOwner ? (
                        <Link to={`/offer?id=${encodeURIComponent(o.id)}`} className="service-offer-join service-offer-join--manage">{t('dashboard.manage')}</Link>
                      ) : isJoined ? (
                        <Link to={`/offer?id=${encodeURIComponent(o.id)}`} className="service-offer-join service-offer-join--joined">{t('dashboard.joined')}</Link>
                      ) : (
                        <button type="button" className="service-offer-join" onClick={() => openJoinModal(o)}>{t('dashboard.join')}</button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </main>
      </div>

      {/* Mobile: floating Filter button above bottom nav */}
      <button
        type="button"
        className="service-filter-float"
        aria-label={t('dashboard.filter')}
        aria-expanded={filterSheetOpen}
        onClick={() => setFilterSheetOpen(true)}
      >
        <span className="service-filter-float-text">{t('dashboard.filter')}</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="16" y2="12" /><line x1="4" y1="18" x2="12" y2="18" />
        </svg>
      </button>

      {/* Mobile: bottom sheet for filters/sort (popout from bottom, tap outside to close) */}
      {filterSheetOpen && (
        <div
          className="service-filter-sheet"
          role="dialog"
          aria-modal="true"
          aria-label={t('dashboard.filter')}
          onClick={() => setFilterSheetOpen(false)}
        >
          <div className="service-filter-sheet__panel" onClick={(e) => e.stopPropagation()}>
            <div className="service-filter-sheet__handle" aria-hidden="true" />
            <div className="service-filters">
              <p className="service-filter-label">{t('dashboard.typeOfPlan', { service: meta.name })}</p>
              <div className="service-plan-pills">
                {['all', 'standard', 'premium'].map((plan) => (
                  <button
                    key={plan}
                    type="button"
                    className={`service-plan-pill ${planFilter === plan ? 'service-plan-pill--active' : ''}`}
                    onClick={() => setPlanFilter(plan)}
                  >
                    {plan === 'all' ? t('dashboard.all') : t('dashboard.' + plan)}
                  </button>
                ))}
              </div>
              <div className="service-toggle-row">
                <span className="service-toggle-icon" aria-hidden="true"><img src="/media/icons/ic--round-verified.svg" alt="" width="24" height="24" /></span>
                <span className="service-toggle-label">{t('dashboard.subscriptionVerified')}</span>
                <label className="service-toggle-wrap">
                  <input type="checkbox" className="service-toggle-input" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
                  <span className="service-toggle-slider" />
                </label>
              </div>
              <div className="service-toggle-row">
                <span className="service-toggle-icon service-toggle-icon--bolt" aria-hidden="true"><img src="/media/icons/ic--round-bolt.svg" alt="" width="24" height="24" /></span>
                <span className="service-toggle-label">{t('dashboard.instantlyAccepts')}</span>
                <label className="service-toggle-wrap">
                  <input type="checkbox" className="service-toggle-input" checked={instantOnly} onChange={(e) => setInstantOnly(e.target.checked)} />
                  <span className="service-toggle-slider" />
                </label>
              </div>
              <p className="service-filter-label">{t('dashboard.sortBy')}:</p>
              <div className="service-sort-list">
                {[
                  { id: 'trust', label: t('dashboard.trustScore'), icon: 'mingcute--medal-line.svg' },
                  { id: 'price', label: t('dashboard.lowestPrice'), icon: 'mingcute--coin-2-line.svg' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`service-sort-item ${sortBy === s.id ? 'service-sort-item--active' : ''}`}
                    onClick={() => setSortBy(s.id)}
                  >
                    <span className="service-sort-icon"><img src={`/media/icons/${s.icon}`} alt="" width="18" height="18" /></span>
                    <span>{s.label}</span>
                    <span className="service-sort-chevron">›</span>
                  </button>
                ))}
              </div>
              <button type="button" className="service-filter-sheet-done" onClick={() => setFilterSheetOpen(false)}>
                {t('dashboard.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {joinModal && (
        <JoinOfferModal
          offer={joinModal}
          serviceName={meta.name}
          serviceSlug={serviceSlug}
          onClose={() => setJoinModal(null)}
          onSuccess={(offerId) => { setJoinModal(null); navigate(`/offer?id=${encodeURIComponent(offerId)}`); }}
          fetchWithAuth={fetchWithAuth}
        />
      )}
    </main>
  )

  async function openJoinModal(offer) {
    const token = typeof localStorage !== 'undefined' && localStorage.getItem('costlyf_access_token')
    if (!token) {
      navigate('/login')
      return
    }
    try {
      const r = await fetchWithAuth(`/api/offers/${encodeURIComponent(offer.id)}`, {})
      if (!r.ok) throw new Error('Offer not found')
      const full = await r.json()
      const available = (full.slots || []).filter((s) => s.status === 'available')
      if (available.length === 0) {
        alert('No seats left for this offer.')
        return
      }
      setJoinModal(full)
    } catch {
      alert('Could not load offer.')
    }
  }
}

export function JoinOfferModal({ offer, serviceName, serviceSlug, onClose, onSuccess, fetchWithAuth }) {
  const { t, locale } = useI18n()
  const [step, setStep] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState(null)
  const [loading, setLoading] = useState(false)
  const [balanceCents, setBalanceCents] = useState(null)
  const [boxCollapsed, setBoxCollapsed] = useState(true)
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [payError, setPayError] = useState('')
  const [topupSubStep, setTopupSubStep] = useState(1)
  const [topupCents, setTopupCents] = useState(5000)
  const [topupLoading, setTopupLoading] = useState(false)
  const [topupError, setTopupError] = useState('')
  const topupClientSecretRef = useRef(null)
  const topupPublishableKeyRef = useRef(null)
  const topupCardNumberRef = useRef(null)
  const topupCardExpiryRef = useRef(null)
  const topupCardCvcRef = useRef(null)
  const topupStripeRef = useRef(null)
  const topupElementsRef = useRef(null)
  const topupCardElementRef = useRef(null)

  const slots = offer.slots || []
  const available = slots.filter((s) => s.status === 'available')
  const slotIndex = available.length > 0 ? available[0].slot_index : null
  const totalPrice = offer.contribution_per_month != null ? Number(offer.contribution_per_month) : 0
  const amountCents = Math.round(totalPrice * 100) || 0
  const priceStr = totalPrice > 0 ? totalPrice.toFixed(2) : '0.00'
  const price = totalPrice > 0 ? totalPrice.toFixed(2) + '€' : '0.00€'
  const canPayWithWallet = balanceCents != null && balanceCents >= amountCents && amountCents > 0
  const breakdown = getPriceBreakdown(serviceSlug, offer.plan, totalPrice)
  const amountToOwner = totalPrice > 0 ? breakdown.amountToOwner.toFixed(2) : '0.00'
  const operatingCostsVal = totalPrice > 0 ? breakdown.operatingFee.toFixed(2) : '0.00'
  const ownerName = offer.owner_name || 'Host'
  const ownerAvatar = (offer.owner_avatar_url && offer.owner_avatar_url.trim()) ? offer.owner_avatar_url : '/media/hero-profiles/2.webp'
  const trustScore = offer.trust_score != null ? offer.trust_score : 0
  const scoreDisplay = trustScore > 0 ? String(trustScore) : '—'
  const logo = LOGO_MAP[serviceSlug] || LOGO_MAP.netflix
  const planName = offer.plan === 'Standard' || offer.plan === 'Premium' ? t('dashboard.' + (offer.plan || 'premium').toLowerCase()) : (offer.plan || 'Premium')
  const memberSince = offer.owner_created_at ? t('dashboard.memberSince', { date: new Date(offer.owner_created_at).toLocaleDateString(locale || 'en', { month: 'long', day: 'numeric', year: 'numeric' }) }) : ''

  useEffect(() => {
    if (step !== 2) return
    setPayError('')
    fetchWithAuth('/api/wallet/balance', {})
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setBalanceCents(data && data.balance_cents != null ? data.balance_cents : 0))
      .catch(() => setBalanceCents(0))
  }, [step, fetchWithAuth])

  const handlePay = () => {
    setPayError('')
    if (paymentMethod === 'wallet' && slotIndex != null) {
      if (!canPayWithWallet) {
        setTopupError('')
        setTopupSubStep(1)
        setTopupCents(TOPUP_AMOUNTS.find((a) => a.cents >= amountCents)?.cents ?? 1000)
        setStep(3)
        return
      }
      setLoading(true)
      fetchWithAuth(`/api/offers/${encodeURIComponent(offer.id)}/slots/${slotIndex}/reserve-with-balance`, { method: 'POST' })
        .then((r) => {
          if (r.ok) {
            onSuccess(offer.id)
            return
          }
          return r.json().then((d) => { throw new Error(d.error || 'Could not reserve slot') })
        })
        .catch((e) => { setPayError(e.message || 'Could not join'); setLoading(false) })
      return
    }
    if (paymentMethod === 'card' && slotIndex) {
      setLoading(true)
      fetchWithAuth(`/api/offers/${encodeURIComponent(offer.id)}/slots/${slotIndex}/reserve`, { method: 'POST' })
        .then((r) => {
          if (r.ok) {
            onSuccess(offer.id)
            return
          }
          return r.json().then((d) => { throw new Error(d.error || 'Could not reserve slot') })
        })
        .catch((e) => { setPayError(e.message || 'Could not join'); setLoading(false) })
    }
  }

  const payButtonDisabled = !paymentMethod || loading
  const payButtonLabel = loading
    ? 'Joining…'
    : paymentMethod === 'card'
      ? `Pay ${price}`
      : paymentMethod === 'wallet' && canPayWithWallet
        ? `Pay ${price}`
        : 'Next'

  return (
    <div className="join-offer-overlay" role="dialog" aria-modal="true" aria-labelledby="join-offer-title">
      <div className="join-offer-backdrop" onClick={onClose} />
      <div className="join-offer-modal">
        <button type="button" className="join-offer-close" onClick={onClose} aria-label="Close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>

        {step === 1 && (
          <div className="join-offer-step">
            <h2 className="join-offer-title" id="join-offer-title">{t('dashboard.join')}</h2>
            <div className={`join-offer-avatar-wrap ${trustScore >= 1 && trustScore <= 10 ? `service-offer-trust-ring--${trustScore}` : ''}`}>
              <div className="join-offer-avatar"><img src={ownerAvatar} alt="" width="80" height="80" /></div>
              <span className="join-offer-score service-offer-trust">{scoreDisplay}</span>
            </div>
            <p className="join-offer-owner-name">{ownerName}</p>
            <span className="join-offer-verified-badge">{t('dashboard.verifiedProfile')} <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><g fill="none" fillRule="evenodd"><path d="m12.593 23.258l-.012.002l-.071.035l-.02.004l-.014-.004l-.071-.036q-.016-.004-.024.006l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.016-.018m.264-.113l-.014.002l-.184.093l-.01.01l-.003.011l.018.43l.005.012l.008.008l.201.092q.019.005.029-.008l.004-.014l-.034-.614q-.005-.019-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.003-.011l.018-.43l-.003-.012l-.01-.01z"/><path fill="currentColor" d="M21.546 5.111a1.5 1.5 0 0 1 0 2.121L10.303 18.475a1.6 1.6 0 0 1-2.263 0L2.454 12.89a1.5 1.5 0 1 1 2.121-2.121l4.596 4.596L19.424 5.111a1.5 1.5 0 0 1 2.122 0"/></g></svg></span>
            {memberSince && <p className="join-offer-member-since">{memberSince}</p>}
            <div className={`join-offer-box ${boxCollapsed ? 'join-offer-box--collapsed' : ''}`}>
              <button type="button" className="join-offer-box-head" onClick={() => setBoxCollapsed(!boxCollapsed)} aria-label={t('dashboard.expandCollapseDetails')} aria-expanded={!boxCollapsed}>
                <span className="join-offer-service"><img src={logo} alt="" width="24" height="24" className="join-offer-service-icon" /> <strong>{offer.service_name || serviceName}</strong></span>
                <span className="join-offer-expand" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 15-6-6-6 6" /></svg></span>
              </button>
              <div className="join-offer-box-body">
                <div className="join-offer-box-sep" />
                <p className="join-offer-plan"><span>{planName}</span></p>
                <p className="join-offer-verify"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> {t('dashboard.verifiedInvoice')}</p>
                <p className="join-offer-verify"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> {t('dashboard.bySharingLogin')}</p>
              </div>
            </div>
            <p className="join-offer-label">{t('dashboard.monthlyParticipation')}</p>
            <div className="join-offer-price-row">
              <button type="button" className="join-offer-price-wrap" onClick={() => setBreakdownOpen(!breakdownOpen)} aria-label={t('dashboard.showPriceBreakdown')} aria-expanded={breakdownOpen}>
                <span className="join-offer-price-icon" aria-hidden="true">€</span>
                <span className="join-offer-price">{priceStr}</span><span className="join-offer-period">{t('dashboard.eurPerMonth')}</span>
                <span className="join-offer-price-arrow" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: breakdownOpen ? 'rotate(180deg)' : undefined }}><path d="m6 9 6 6 6-6"/></svg></span>
              </button>
              {breakdownOpen && (
                <div className="join-offer-price-breakdown">
                  <div className="join-offer-breakdown-row">
                    <span className="join-offer-breakdown-label">{t('dashboard.amountPaidToOwner')}</span>
                    <span className="join-offer-breakdown-value">{amountToOwner}€</span>
                  </div>
                  <div className="join-offer-breakdown-row">
                    <span className="join-offer-breakdown-label">{t('dashboard.operatingCosts')}</span>
                    <span className="join-offer-breakdown-value">{operatingCostsVal}€</span>
                  </div>
                  <p className="join-offer-breakdown-heading">{t('dashboard.operatingCostsInclude')}</p>
                  <ul className="join-offer-breakdown-includes">
                    <li><span className="join-offer-breakdown-icon join-offer-breakdown-icon--vat" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M5 11h14"/></svg></span>{t('dashboard.vat')}</li>
                    <li><span className="join-offer-breakdown-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>{t('dashboard.antiFraud')}</li>
                    <li><span className="join-offer-breakdown-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg></span>{t('dashboard.coSubscriberGuarantee')}</li>
                    <li><span className="join-offer-breakdown-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>{t('dashboard.profileVerification')}</li>
                  </ul>
                </div>
              )}
            </div>
            <p className="join-offer-disclaimer">{t('dashboard.noStringsAttached')}</p>
            <button type="button" className="join-offer-next" onClick={() => setStep(2)}>{t('dashboard.nextLabel')}</button>
          </div>
        )}

        {step === 2 && (
          <div className="join-offer-step">
            <button type="button" className="join-offer-back" aria-label={t('dashboard.back')} onClick={() => setStep(1)}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg></button>
            <h2 className="join-offer-title">{t('dashboard.join')}</h2>
            <p className="join-offer-subtitle">Choose the payment method:</p>
            <p className="join-offer-charge">Charge: {price} €/month</p>
            <div className="join-offer-payment-options">
              <label className="join-offer-payment-option">
                <input type="radio" name="join-payment-method" value="card" className="join-offer-payment-radio" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} />
                <span className="join-offer-payment-label">Bank card</span>
                <span className="join-offer-payment-icon" aria-hidden="true"><svg width="32" height="24" viewBox="0 0 32 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="4" width="30" height="16" rx="2" /><line x1="1" y1="10" x2="31" y2="10" /></svg></span>
              </label>
              <label className="join-offer-payment-option">
                <input type="radio" name="join-payment-method" value="wallet" className="join-offer-payment-radio" checked={paymentMethod === 'wallet'} onChange={() => setPaymentMethod('wallet')} />
                <span className="join-offer-payment-label">Pay with Wallet</span>
                <span className="join-offer-payment-amount">{balanceCents != null ? (balanceCents / 100).toFixed(2) + '€' : '…'}</span>
              </label>
            </div>
            {paymentMethod === 'wallet' && balanceCents != null && balanceCents < amountCents && (
              <p className="join-offer-insufficient" role="alert">Insufficient balance. Top up your wallet or pay by card.</p>
            )}
            {payError && <p className="join-offer-insufficient" role="alert">{payError}</p>}
            <p className="join-offer-legal">By clicking Pay, the right of withdrawal (article L. 221-18 of the Consumer Code) does not apply.</p>
            <button type="button" className="join-offer-pay" disabled={payButtonDisabled} onClick={handlePay}>
              <span>{payButtonLabel}</span>
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="join-offer-step">
            <button
              type="button"
              className="join-offer-back"
              aria-label="Back"
              onClick={() => {
                setTopupError('')
                if (topupSubStep === 2) {
                  topupClientSecretRef.current = null
                  topupPublishableKeyRef.current = null
                  if (topupCardNumberRef.current) topupCardNumberRef.current.innerHTML = ''
                  if (topupCardExpiryRef.current) topupCardExpiryRef.current.innerHTML = ''
                  if (topupCardCvcRef.current) topupCardCvcRef.current.innerHTML = ''
                  setTopupSubStep(1)
                } else {
                  setStep(2)
                }
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <h2 className="join-offer-title">Top up your balance</h2>
            {topupSubStep === 1 && (
              <>
                <p className="join-offer-subtitle">Insufficient balance. Choose amount to add (€):</p>
                <div className="join-offer-topup-amounts" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                  {TOPUP_AMOUNTS.map(({ cents, label }) => (
                    <button
                      key={cents}
                      type="button"
                      className={`join-offer-payment-option ${topupCents === cents ? 'join-offer-payment-option--selected' : ''}`}
                      style={{ flex: '1 1 auto', minWidth: '4rem' }}
                      onClick={() => setTopupCents(cents)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button type="button" className="join-offer-pay" disabled={topupLoading} onClick={() => {
                  setTopupError('')
                  setTopupLoading(true)
                  fetchWithAuth('/api/wallet/topup-intent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount_cents: topupCents }),
                  })
                    .then((r) => r.json())
                    .then((data) => {
                      if (data.error) throw new Error(data.error)
                      if (!data.client_secret || !data.publishableKey) throw new Error('Missing payment setup')
                      topupClientSecretRef.current = data.client_secret
                      topupPublishableKeyRef.current = data.publishableKey
                      setTopupSubStep(2)
                    })
                    .catch((e) => setTopupError(e.message || 'Something went wrong'))
                    .finally(() => setTopupLoading(false))
                }}>
                  {topupLoading ? '…' : 'Next'}
                </button>
              </>
            )}
            {topupSubStep === 2 && (
              <JoinModalTopupCard
                fetchWithAuth={fetchWithAuth}
                topupCents={topupCents}
                topupClientSecretRef={topupClientSecretRef}
                topupPublishableKeyRef={topupPublishableKeyRef}
                topupCardNumberRef={topupCardNumberRef}
                topupCardExpiryRef={topupCardExpiryRef}
                topupCardCvcRef={topupCardCvcRef}
                topupStripeRef={topupStripeRef}
                topupElementsRef={topupElementsRef}
                topupCardElementRef={topupCardElementRef}
                loadStripeScript={loadStripeScript}
                topupError={topupError}
                setTopupError={setTopupError}
                onSuccess={() => {
                  setStep(2)
                  setTopupSubStep(1)
                  setTopupError('')
                  fetchWithAuth('/api/wallet/balance', {}).then((r) => r.ok ? r.json() : null).then((data) => setBalanceCents(data?.balance_cents ?? 0))
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
