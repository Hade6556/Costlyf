import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, useLocation, Link, useNavigate } from 'react-router-dom'
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

const TOPUP_MIN_CENTS = 1000   // 10€
const TOPUP_MAX_CENTS = 15000  // 150€
const TOPUP_PRESETS = [
  { cents: 2000, label: '20€' },
  { cents: 3000, label: '30€' },
  { cents: 5000, label: '50€' },
  { cents: 8000, label: '80€' },
]

function JoinModalTopupCard({
  fetchWithAuth,
  topupCents,
  topupClientSecretRef,
  topupPublishableKeyRef,
  topupPaymentElementRef,
  topupStripeRef,
  topupElementsRef,
  topupExpressCheckoutRef,
  loadStripeScript,
  topupError,
  setTopupError,
  onSuccess,
}) {
  const [payLoading, setPayLoading] = useState(false)
  useEffect(() => {
    if (!topupClientSecretRef.current || !topupPublishableKeyRef.current || !topupPaymentElementRef?.current) return
    const key = topupPublishableKeyRef.current
    const secret = topupClientSecretRef.current
    const amountCents = topupCents
    loadStripeScript().then((Stripe) => {
      if (!topupPaymentElementRef?.current) return
      topupPaymentElementRef.current.innerHTML = ''
      if (topupExpressCheckoutRef?.current) topupExpressCheckoutRef.current.innerHTML = ''
      const stripe = Stripe(key)
      topupStripeRef.current = stripe
      const elements = stripe.elements({
        clientSecret: secret,
        appearance: { theme: 'stripe' },
      })
      topupElementsRef.current = elements
      const paymentElement = elements.create('payment')
      paymentElement.mount(topupPaymentElementRef.current)
      if (topupExpressCheckoutRef?.current) {
        const paymentRequest = stripe.paymentRequest({
          country: 'LT',
          currency: 'eur',
          total: { label: 'Join subscription', amount: amountCents },
        })
        paymentRequest.on('paymentmethod', (ev) => {
          stripe.confirmCardPayment(secret, { payment_method: ev.paymentMethod.id })
            .then((result) => {
              if (result.error) {
                ev.complete('fail')
                setTopupError(result.error.message || 'Payment failed')
                return
              }
              ev.complete('success')
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
            .catch((e) => {
              ev.complete('fail')
              setTopupError(e.message || 'Payment failed')
            })
        })
        paymentRequest.canMakePayment().then((result) => {
          if (result && topupExpressCheckoutRef.current) {
            const prButton = elements.create('paymentRequestButton', { paymentRequest })
            prButton.mount(topupExpressCheckoutRef.current)
          }
        })
      }
    }).catch((e) => setTopupError(e.message || 'Failed to load payment form'))
  }, [topupCents])
  const handlePay = () => {
    const stripe = topupStripeRef.current
    const secret = topupClientSecretRef.current
    const elements = topupElementsRef.current
    if (!stripe || !secret || !elements) return
    setTopupError('')
    setPayLoading(true)
    const returnUrl = window.location.origin + window.location.pathname
    // Stripe requires elements.submit() before confirmPayment (validates form first)
    Promise.resolve()
      .then(() => elements.submit())
      .then((submitResult) => {
        if (submitResult && submitResult.error) {
          setTopupError(submitResult.error.message || 'Please complete the form')
          setPayLoading(false)
          return null
        }
        return stripe.confirmPayment({
          elements,
          clientSecret: secret,
          confirmParams: { return_url: returnUrl },
        })
      })
      .then((result) => {
        if (result === null) return
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
      <p className="join-offer-subtitle">Pay {topupCents / 100}€ — choose your payment method.</p>
      <div ref={topupExpressCheckoutRef} id="join-express-checkout-element" className="wallet-express-checkout-wrap" style={{ marginBottom: '1rem' }} />
      <div ref={topupPaymentElementRef} id="join-payment-element" className="wallet-payment-element-wrap" style={{ marginBottom: '1rem' }} />
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
  const [instantOnly, setInstantOnly] = useState(false) // mock: does not filter (all offers are instant)
  const [sortBy, setSortBy] = useState('trust')
  const [joinModal, setJoinModal] = useState(null) // { offerId, offer }
  const [joinModalResumeStep, setJoinModalResumeStep] = useState(null) // 4 = show securing then access after card redirect
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const location = useLocation()

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

  // After Stripe redirect (e.g. 3DS): complete reserve and reopen modal at access step.
  // Stripe may put payment_intent/redirect_status in query or hash; our join_offer/join_slot may be lost if Stripe overwrites query.
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search)
    const hashParams = new URLSearchParams((location.hash && location.hash.slice(1)) || '')
    const redirectStatus = queryParams.get('redirect_status') || hashParams.get('redirect_status')
    const paymentIntentId = queryParams.get('payment_intent') || hashParams.get('payment_intent')
    if (redirectStatus !== 'succeeded' || !paymentIntentId) return
    if (!user || !fetchWithAuth) return

    let cancelled = false
    function runReserveAndOpenModal(offerId, slotIdx, piId) {
      return fetchWithAuth(`/api/offers/${encodeURIComponent(offerId)}`, {})
        .then((r) => (r.ok ? r.json() : null))
        .then((full) => {
          if (cancelled || !full) return
          return fetchWithAuth(`/api/offers/${encodeURIComponent(offerId)}/slots/${slotIdx}/reserve-after-card`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payment_intent_id: piId }),
          }).then((r) => {
            if (!r.ok) return r.json().then((d) => { throw new Error(d.error || 'Could not reserve slot') })
            setJoinModal(full)
            setJoinModalResumeStep(4)
          })
        })
    }
    function clearRedirectUrl() {
      const nextSearch = new URLSearchParams(searchParams)
      nextSearch.delete('join_offer')
      nextSearch.delete('join_slot')
      nextSearch.delete('payment_intent')
      nextSearch.delete('payment_intent_client_secret')
      nextSearch.delete('redirect_status')
      const qs = nextSearch.toString()
      navigate(`${location.pathname}${qs ? '?' + qs : ''}`, { replace: true })
      if (typeof window !== 'undefined' && window.history.replaceState && location.hash) {
        window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''))
      }
    }

    let joinOffer = searchParams.get('join_offer')
    let joinSlot = searchParams.get('join_slot')
    if (!joinOffer || joinSlot == null) {
      fetchWithAuth(`/api/offers/join-from-payment-intent?payment_intent_id=${encodeURIComponent(paymentIntentId)}`, {})
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (cancelled || !data || !data.offer_id) return
          return runReserveAndOpenModal(data.offer_id, data.slot_index, paymentIntentId)
        })
        .then(() => { if (!cancelled) clearRedirectUrl() })
        .catch(() => {})
      return () => { cancelled = true }
    }

    runReserveAndOpenModal(joinOffer, joinSlot, paymentIntentId)
      .then(() => { if (!cancelled) clearRedirectUrl() })
      .catch(() => {})
    return () => { cancelled = true }
  }, [searchParams, location.search, location.hash, location.pathname, user, fetchWithAuth, navigate])

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
                      <span className="service-offer-price">
                        <svg className="service-offer-price-bolt" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10.67 21c-.35 0-.62-.31-.57-.66L11 14H7.5c-.88 0-.33-.75-.31-.78c1.26-2.23 3.15-5.53 5.65-9.93a.577.577 0 0 1 1.07.37l-.9 6.34h3.51c.4 0 .62.19.4.66c-3.29 5.74-5.2 9.09-5.75 10.05c-.1.18-.29.29-.5.29"/></svg>
                        {priceStr(o)} <span className="service-offer-period">{t('dashboard.eurPerMonth')}</span>
                      </span>
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
          onClose={() => { setJoinModal(null); setJoinModalResumeStep(null) }}
          onSuccess={(offerId, opts) => { setJoinModal(null); setJoinModalResumeStep(null); navigate(opts?.redirect || `/offer?id=${encodeURIComponent(offerId)}`); }}
          fetchWithAuth={fetchWithAuth}
          initialStep={joinModalResumeStep ?? undefined}
          resumeAfterPayment={joinModalResumeStep != null}
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

const SERVICE_LOGIN_URL = {
  netflix: 'https://www.netflix.com/login',
  spotify: 'https://accounts.spotify.com/login',
  disney: 'https://www.disneyplus.com/login',
  'prime-video': 'https://www.primevideo.com',
  'youtube-premium': 'https://www.youtube.com',
  'apple-music': 'https://music.apple.com',
  'hbo-max': 'https://www.max.com',
  default: 'https://www.netflix.com/login',
}

const ISSUE_OPTIONS = [
  { id: 'cant_login', label: "Can't log in" },
  { id: 'password_wrong', label: "Password doesn't work" },
  { id: 'verification', label: 'Account asks for verification' },
  { id: 'other', label: 'Other issue' },
]

export function JoinOfferModal({ offer, serviceName, serviceSlug, onClose, onSuccess, fetchWithAuth, initialStep, resumeAfterPayment }) {
  const { t, locale } = useI18n()
  const [step, setStep] = useState(resumeAfterPayment ? 2 : 1)
  const resumeDoneRef = useRef(false)
  const [cardPaymentWaiting, setCardPaymentWaiting] = useState(resumeAfterPayment || false)
  const [cardPaymentSuccess, setCardPaymentSuccess] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState(null)
  const [loading, setLoading] = useState(false)
  const [balanceCents, setBalanceCents] = useState(null)
  const [boxCollapsed, setBoxCollapsed] = useState(true)
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [payError, setPayError] = useState('')
  const [topupSubStep, setTopupSubStep] = useState(1)
  const [topupCents, setTopupCents] = useState(5000) // used for join modal top-up; constrained by TOPUP_MIN/MAX
  const [topupLoading, setTopupLoading] = useState(false)
  const [topupError, setTopupError] = useState('')
  const [accessDetails, setAccessDetails] = useState({ email: '', password: '' })
  const [confirmSuccess, setConfirmSuccess] = useState(false)
  const [issueType, setIssueType] = useState('')
  const [issueSubmitted, setIssueSubmitted] = useState(false)
  const topupClientSecretRef = useRef(null)
  const topupPublishableKeyRef = useRef(null)
  const topupPaymentElementRef = useRef(null)
  const topupStripeRef = useRef(null)
  const topupElementsRef = useRef(null)
  const topupExpressCheckoutRef = useRef(null)
  const [joinCardPaymentActive, setJoinCardPaymentActive] = useState(false)
  const [joinCardElementReady, setJoinCardElementReady] = useState(false)
  const [joinCardLoading, setJoinCardLoading] = useState(false)
  const [joinCardPayLoading, setJoinCardPayLoading] = useState(false)
  const [joinCardError, setJoinCardError] = useState('')
  const joinCardClientSecretRef = useRef(null)
  const joinCardPublishableKeyRef = useRef(null)
  const joinCardPaymentElementRef = useRef(null)
  const joinCardExpressCheckoutRef = useRef(null)
  const joinCardStripeRef = useRef(null)
  const joinCardElementsRef = useRef(null)

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

  // After Stripe redirect: fetch access details then show success and go to step 5
  useEffect(() => {
    if (!resumeAfterPayment || resumeDoneRef.current || (initialStep !== 4 && initialStep != null)) return
    if (slotIndex == null) return
    resumeDoneRef.current = true
    fetchWithAuth(`/api/offers/${encodeURIComponent(offer.id)}/slots/${slotIndex}/access-details`, {})
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setAccessDetails({
          email: d?.login_email ?? "You'll receive login details from the owner in Inbox",
          password: d?.login_password ?? '—',
        })
        setCardPaymentWaiting(false)
        setCardPaymentSuccess(true)
      })
      .catch(() => {
        setAccessDetails({ email: "You'll receive login details from the owner in Inbox", password: '—' })
        setCardPaymentWaiting(false)
        setCardPaymentSuccess(true)
      })
  }, [resumeAfterPayment, initialStep, slotIndex, offer.id, fetchWithAuth])

  // When card payment success is shown, after 1.5s go to step 5 (login details)
  useEffect(() => {
    if (!cardPaymentSuccess) return
    const t = setTimeout(() => {
      setStep(5)
      setCardPaymentSuccess(false)
    }, 1500)
    return () => clearTimeout(t)
  }, [cardPaymentSuccess])

  // Mount Stripe Payment Element + Express Checkout when join card payment step is shown
  useEffect(() => {
    if (!joinCardPaymentActive || !joinCardClientSecretRef.current || !joinCardPublishableKeyRef.current || !joinCardPaymentElementRef.current) return
    setJoinCardElementReady(false)
    const key = joinCardPublishableKeyRef.current
    const secret = joinCardClientSecretRef.current
    loadStripeScript().then((Stripe) => {
      if (!joinCardPaymentElementRef.current) return
      joinCardPaymentElementRef.current.innerHTML = ''
      if (joinCardExpressCheckoutRef.current) joinCardExpressCheckoutRef.current.innerHTML = ''
      const stripe = Stripe(key)
      joinCardStripeRef.current = stripe
      const elements = stripe.elements({
        clientSecret: secret,
        appearance: { theme: 'stripe' },
      })
      joinCardElementsRef.current = elements
      const paymentElement = elements.create('payment')
      paymentElement.mount(joinCardPaymentElementRef.current)
      paymentElement.on('ready', () => {
        if (joinCardPaymentElementRef.current) setJoinCardElementReady(true)
      })
      const paymentRequest = stripe.paymentRequest({
        country: 'LT',
        currency: 'eur',
        total: { label: 'Join subscription', amount: amountCents },
      })
      paymentRequest.on('paymentmethod', (ev) => {
        setCardPaymentWaiting(true)
        stripe.confirmCardPayment(secret, { payment_method: ev.paymentMethod.id })
          .then((result) => {
            if (result.error) {
              ev.complete('fail')
              setJoinCardError(result.error.message || 'Payment failed')
              setCardPaymentWaiting(false)
              return
            }
            ev.complete('success')
            fetchWithAuth(`/api/offers/${encodeURIComponent(offer.id)}/slots/${slotIndex}/reserve-after-card`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ payment_intent_id: result.paymentIntent?.id }),
            })
              .then((r) => {
                if (!r.ok) return r.json().then((d) => { throw new Error(d.error || 'Could not reserve') })
                return fetchWithAuth(`/api/offers/${encodeURIComponent(offer.id)}/slots/${slotIndex}/access-details`, {})
                  .then((res) => (res.ok ? res.json() : null))
                  .then((d) => {
                    setAccessDetails({
                      email: d?.login_email ?? "You'll receive login details from the owner in Inbox",
                      password: d?.login_password ?? '—',
                    })
                    setCardPaymentWaiting(false)
                    setCardPaymentSuccess(true)
                  })
                  .catch(() => {
                    setAccessDetails({ email: "You'll receive login details from the owner in Inbox", password: '—' })
                    setCardPaymentWaiting(false)
                    setCardPaymentSuccess(true)
                  })
              })
              .catch((e) => { setJoinCardError(e.message || 'Reserve failed'); setCardPaymentWaiting(false) })
          })
          .catch((e) => { ev.complete('fail'); setJoinCardError(e.message || 'Payment failed'); setCardPaymentWaiting(false) })
      })
      paymentRequest.canMakePayment().then((result) => {
        if (result && joinCardExpressCheckoutRef.current) {
          const prButton = elements.create('paymentRequestButton', { paymentRequest })
          prButton.mount(joinCardExpressCheckoutRef.current)
        }
      })
    }).catch((e) => setJoinCardError(e.message || 'Failed to load payment form'))
  }, [joinCardPaymentActive, amountCents, offer.id, slotIndex, fetchWithAuth])

  const goToInstantAccess = (email = '', password = '') => {
    setAccessDetails({
      email: email || "You'll receive login details from the owner in Inbox",
      password: password || '—',
    })
    setStep(5)
  }

  const fetchAccessDetailsAndGo = () => {
    fetchWithAuth(`/api/offers/${encodeURIComponent(offer.id)}/slots/${slotIndex}/access-details`, {})
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        goToInstantAccess(d?.login_email ?? '', d?.login_password ?? '')
      })
      .catch(() => goToInstantAccess())
  }

  const handlePay = () => {
    setPayError('')
    if (paymentMethod === 'wallet' && slotIndex != null) {
      if (!canPayWithWallet) {
        setTopupError('')
        setTopupSubStep(1)
        setTopupCents(Math.max(TOPUP_MIN_CENTS, Math.min(TOPUP_MAX_CENTS, Math.ceil(amountCents / 100) * 100)) || TOPUP_MIN_CENTS)
        setStep(3)
        return
      }
      setLoading(true)
      fetchWithAuth(`/api/offers/${encodeURIComponent(offer.id)}/slots/${slotIndex}/reserve-with-balance`, { method: 'POST' })
        .then((r) => {
          if (r.ok) {
            setLoading(false)
            fetchAccessDetailsAndGo()
            return
          }
          return r.json().then((d) => { throw new Error(d.error || 'Could not reserve slot') })
        })
        .catch((e) => { setPayError(e.message || 'Could not join'); setLoading(false) })
      return
    }
    if (paymentMethod === 'card' && slotIndex) {
      setPayError('')
      setJoinCardError('')
      setJoinCardLoading(true)
      fetchWithAuth(`/api/offers/${encodeURIComponent(offer.id)}/slots/${slotIndex}/create-payment-intent`, { method: 'POST' })
        .then((r) => r.json())
        .then((data) => {
          if (data.error) throw new Error(data.error)
          if (!data.client_secret || !data.publishableKey) throw new Error('Missing Stripe keys')
          joinCardClientSecretRef.current = data.client_secret
          joinCardPublishableKeyRef.current = data.publishableKey
          setJoinCardPaymentActive(true)
        })
        .catch((e) => { setPayError(e.message || 'Could not start payment'); setJoinCardError(e.message || '') })
        .finally(() => setJoinCardLoading(false))
    }
  }

  const doJoinCardPay = () => {
    const stripe = joinCardStripeRef.current
    const secret = joinCardClientSecretRef.current
    const elements = joinCardElementsRef.current
    if (!stripe || !secret || !elements) return
    if (!joinCardElementReady) {
      setJoinCardError('Payment form is still loading. Please wait a moment.')
      return
    }
    setJoinCardError('')
    setJoinCardPayLoading(true)
    setCardPaymentWaiting(true)
    const returnUrl = `${window.location.origin}${window.location.pathname}?join_offer=${encodeURIComponent(offer.id)}&join_slot=${slotIndex}`
    Promise.resolve()
      .then(() => elements.submit())
      .then((submitResult) => {
        if (submitResult && submitResult.error) {
          setJoinCardError(submitResult.error.message || 'Please complete the form')
          setJoinCardPayLoading(false)
          setCardPaymentWaiting(false)
          return null
        }
        return stripe.confirmPayment({
          elements,
          clientSecret: secret,
          confirmParams: { return_url: returnUrl },
        })
      })
      .then((result) => {
        if (result === null) return
        if (result.error) throw new Error(result.error.message || 'Payment failed')
        const paymentIntentId = result.paymentIntent && result.paymentIntent.id
        if (!paymentIntentId) throw new Error('Payment succeeded but could not complete reservation')
        return fetchWithAuth(`/api/offers/${encodeURIComponent(offer.id)}/slots/${slotIndex}/reserve-after-card`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_intent_id: paymentIntentId }),
        }).then((r) => {
          if (!r.ok) return r.json().then((d) => { throw new Error(d.error || 'Could not reserve slot') })
          return fetchWithAuth(`/api/offers/${encodeURIComponent(offer.id)}/slots/${slotIndex}/access-details`, {})
            .then((res) => (res.ok ? res.json() : null))
            .then((d) => {
              setAccessDetails({
                email: d?.login_email ?? "You'll receive login details from the owner in Inbox",
                password: d?.login_password ?? '—',
              })
              setCardPaymentWaiting(false)
              setCardPaymentSuccess(true)
            })
            .catch(() => {
              setAccessDetails({ email: "You'll receive login details from the owner in Inbox", password: '—' })
              setCardPaymentWaiting(false)
              setCardPaymentSuccess(true)
            })
        })
      })
      .catch((e) => {
        const msg = (e && (e.message || e.error && e.error.message)) ? String(e.message || e.error.message) : String(e || 'Something went wrong')
        const isStripeElementOrNetwork = /could not retrieve data|specified Element|element.*mounted|ready event|Failed to fetch|ERR_BLOCKED|IntegrationError/i.test(msg)
        setJoinCardError(isStripeElementOrNetwork
          ? "Payment couldn't be completed. If you're using an ad blocker or privacy extension, try disabling it for this site and try again."
          : msg)
        setCardPaymentWaiting(false)
      })
      .finally(() => setJoinCardPayLoading(false))
  }

  const payButtonDisabled = !paymentMethod || loading || joinCardLoading
  const payButtonLabel = loading || joinCardLoading
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
              <div className="join-offer-avatar"><img src={ownerAvatar} alt="" width="64" height="64" /></div>
              <span className="join-offer-score service-offer-trust">{scoreDisplay}</span>
            </div>
            <p className="join-offer-owner-name">{ownerName}</p>
            <span className="join-offer-verified-badge">{t('dashboard.verifiedProfile')} <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><path fill="currentColor" d="M9.765 3.205a.75.75 0 0 1 .03 1.06l-4.25 4.5a.75.75 0 0 1-1.075.015L2.22 6.53a.75.75 0 0 1 1.06-1.06l1.705 1.704l3.72-3.939a.75.75 0 0 1 1.06-.03"/></svg></span>
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
            <button type="button" className="join-offer-next" onClick={() => setStep(2)}>Get instant access</button>
          </div>
        )}

        {step === 2 && (cardPaymentWaiting || cardPaymentSuccess) && (
          <div className="join-offer-step join-offer-step--card-status">
            <div className="join-offer-card-status-wrap">
              {cardPaymentWaiting && (
                <>
                  <div className="join-offer-card-status-spinner" aria-hidden="true" />
                  <p className="join-offer-card-status-text">Waiting for confirmation…</p>
                  <p className="join-offer-card-status-sub">This may take a moment. Do not close this window.</p>
                </>
              )}
              {cardPaymentSuccess && (
                <>
                  <div className="join-offer-card-status-check" aria-hidden="true">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  </div>
                  <p className="join-offer-card-status-text">Payment successful!</p>
                  <p className="join-offer-card-status-sub">Preparing your access details…</p>
                </>
              )}
            </div>
          </div>
        )}

        {step === 2 && !cardPaymentWaiting && !cardPaymentSuccess && (
          <div className="join-offer-step">
            <button
              type="button"
              className="join-offer-back"
              aria-label={t('dashboard.back')}
              onClick={() => {
                if (joinCardPaymentActive) {
                  setJoinCardPaymentActive(false)
                  setJoinCardError('')
                  joinCardClientSecretRef.current = null
                  joinCardPublishableKeyRef.current = null
                  if (joinCardPaymentElementRef.current) joinCardPaymentElementRef.current.innerHTML = ''
                  if (joinCardExpressCheckoutRef.current) joinCardExpressCheckoutRef.current.innerHTML = ''
                } else {
                  setStep(1)
                }
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <h2 className="join-offer-title">{t('dashboard.join')}</h2>
            {joinCardPaymentActive ? (
              <>
                <p className="join-offer-subtitle">Pay {price} — choose your payment method.</p>
                <div ref={joinCardExpressCheckoutRef} className="wallet-express-checkout-wrap" style={{ marginBottom: '1rem' }} />
                <div ref={joinCardPaymentElementRef} className="wallet-payment-element-wrap" style={{ marginBottom: '1rem' }} />
                {joinCardError && (
                  <p className="join-offer-insufficient" role="alert">
                    {/could not retrieve data|specified Element|element.*mounted|ready event|IntegrationError/i.test(joinCardError)
                      ? "Payment couldn't be completed. If you're using an ad blocker or privacy extension, try disabling it for this site and try again."
                      : joinCardError}
                  </p>
                )}
                <p className="join-offer-payment-hint">If the form doesn&apos;t load or payment fails, try disabling ad or tracking blockers for this site.</p>
                <div className="wallet-modal-actions wallet-modal-actions--step2" style={{ marginTop: '1rem' }}>
                  <button type="button" className="wallet-modal-back" onClick={() => { setJoinCardPaymentActive(false); setJoinCardError(''); joinCardClientSecretRef.current = null; joinCardPublishableKeyRef.current = null; if (joinCardPaymentElementRef.current) joinCardPaymentElementRef.current.innerHTML = ''; if (joinCardExpressCheckoutRef.current) joinCardExpressCheckoutRef.current.innerHTML = ''; }}>
                    Back
                  </button>
                  <button type="button" className="wallet-modal-pay" onClick={doJoinCardPay} disabled={!joinCardElementReady || joinCardPayLoading}>
                    {joinCardPayLoading ? '…' : joinCardElementReady ? `Pay ${price}` : 'Loading…'}
                  </button>
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
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
                  if (topupPaymentElementRef.current) topupPaymentElementRef.current.innerHTML = ''
                  if (topupExpressCheckoutRef.current) topupExpressCheckoutRef.current.innerHTML = ''
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
                <div className="join-offer-topup-stepper">
                  <button
                    type="button"
                    className="join-offer-topup-btn join-offer-topup-btn--minus"
                    aria-label="Decrease amount"
                    disabled={topupCents <= TOPUP_MIN_CENTS}
                    onClick={() => setTopupCents((c) => Math.max(TOPUP_MIN_CENTS, c - 100))}
                  >
                    −
                  </button>
                  <span className="join-offer-topup-value">{topupCents / 100}€</span>
                  <button
                    type="button"
                    className="join-offer-topup-btn join-offer-topup-btn--plus"
                    aria-label="Increase amount"
                    disabled={topupCents >= TOPUP_MAX_CENTS}
                    onClick={() => setTopupCents((c) => Math.min(TOPUP_MAX_CENTS, c + 100))}
                  >
                    +
                  </button>
                </div>
                <p className="join-offer-topup-hint">Enter an amount between €10 and €150</p>
                <div className="join-offer-topup-presets">
                  {TOPUP_PRESETS.map(({ cents, label }) => (
                    <button
                      key={cents}
                      type="button"
                      className={`join-offer-topup-preset ${topupCents === cents ? 'join-offer-topup-preset--active' : ''}`}
                      onClick={() => setTopupCents(cents)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button type="button" className="join-offer-pay join-offer-next--block" disabled={topupLoading} onClick={() => {
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
                topupPaymentElementRef={topupPaymentElementRef}
                topupStripeRef={topupStripeRef}
                topupElementsRef={topupElementsRef}
                topupExpressCheckoutRef={topupExpressCheckoutRef}
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

        {step === 5 && !confirmSuccess && !issueSubmitted && (
          <div className="join-offer-step join-offer-step--access">
            <h2 className="join-offer-title">Secure access {offer.service_name || serviceName || 'service'} details</h2>
            <p className="join-offer-access-intro">Use these credentials to sign in. Copy the email and password below, then open the service and log in. Your password is shown in full so you can copy it.</p>
            <div className="join-offer-access-logo">
              <img src={logo} alt="" width="48" height="48" />
            </div>
            <div className="join-offer-access-details-box">
              <div className="join-offer-access-details">
                <div className="join-offer-access-row">
                  <span className="join-offer-access-label">Login email</span>
                  <span className="join-offer-access-value join-offer-access-value--plain" data-access="email">{accessDetails.email}</span>
                  <button type="button" className="join-offer-copy-btn" onClick={() => { navigator.clipboard?.writeText(accessDetails.email); }}>Copy</button>
                </div>
                <div className="join-offer-access-row">
                  <span className="join-offer-access-label">Password</span>
                  <span className="join-offer-access-value join-offer-access-value--plain" data-access="password">{accessDetails.password}</span>
                  <button type="button" className="join-offer-copy-btn" onClick={() => { navigator.clipboard?.writeText(accessDetails.password); }}>Copy</button>
                </div>
              </div>
              <p className="join-offer-access-safe">Your information is encrypted and safe.</p>
              <a href={SERVICE_LOGIN_URL[serviceSlug] || SERVICE_LOGIN_URL.default} target="_blank" rel="noopener noreferrer" className="join-offer-open-service">Open {offer.service_name || serviceName}</a>
            </div>
            <p className="join-offer-access-instruction">Log in now and check if everything works. This usually takes under 30 seconds.</p>
            <button type="button" className="join-offer-next" onClick={async () => {
              try {
                await fetchWithAuth(`/api/offers/${encodeURIComponent(offer.id)}/slots/${slotIndex}/confirm-details`, { method: 'POST' })
              } catch (_) { /* slot may still be reserved; show success anyway */ }
              setConfirmSuccess(true)
              setTimeout(() => {
                if (typeof onSuccess === 'function') onSuccess(offer.id, { redirect: `/offer?id=${offer.id}` })
              }, 1500)
            }}>Confirm Access Works</button>
            <button type="button" className="join-offer-issue-btn" onClick={() => setStep(6)}>I have an issue</button>
          </div>
        )}

        {step === 5 && confirmSuccess && (
          <div className="join-offer-step">
            <p className="join-offer-success-message">Perfect! Your subscription is now active.</p>
            <p className="join-offer-success-sub">Redirecting to subscription management…</p>
          </div>
        )}

        {step === 6 && !issueSubmitted && (
          <div className="join-offer-step">
            <button type="button" className="join-offer-back" aria-label={t('dashboard.back')} onClick={() => setStep(5)}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg></button>
            <h2 className="join-offer-title">Let&apos;s fix this</h2>
            <p className="join-offer-subtitle">What&apos;s the issue?</p>
            <ul className="join-offer-issue-list">
              {ISSUE_OPTIONS.map((opt) => (
                <li key={opt.id}>
                  <button type="button" className={`join-offer-issue-option ${issueType === opt.id ? 'join-offer-issue-option--active' : ''}`} onClick={() => setIssueType(opt.id)}>{opt.label}</button>
                </li>
              ))}
            </ul>
            <button type="button" className="join-offer-next" disabled={!issueType} onClick={() => {
              setIssueSubmitted(true)
              fetchWithAuth(`/api/offers/${encodeURIComponent(offer.id)}/slots/${slotIndex}/request-removal`, { method: 'POST' }).catch(() => {})
            }}>Submit</button>
          </div>
        )}

        {step === 6 && issueSubmitted && (
          <div className="join-offer-step">
            <p className="join-offer-reassurance">Your payment is protected. You won&apos;t be charged while this is being resolved.</p>
            <p className="join-offer-reassurance-sub">We&apos;ve marked this subscription as Pending. Check Inbox for updates.</p>
            <button type="button" className="join-offer-next" onClick={() => { if (typeof onSuccess === 'function') onSuccess(offer.id, { redirect: `/offer?id=${offer.id}` }) }}>Go to subscription management</button>
          </div>
        )}
      </div>
    </div>
  )
}
