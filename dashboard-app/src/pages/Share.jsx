import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../contexts/I18nContext'
import { useNotification } from '../contexts/NotificationContext'
import { SHARE_CATEGORIES, SHARE_SERVICES } from '../data/shareServices'
import { getServiceBySlug, getPlanPriceTotal, getPriceBreakdown } from '../data/services'

const STEPS = ['service', 'how', 'offer', 'slots', 'credentials', 'confirm']

export default function Share() {
  const { t } = useI18n()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { fetchWithAuth, getToken } = useAuth()

  const [stepIndex, setStepIndex] = useState(0)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('popular')
  const [state, setState] = useState({
    service: null,
    serviceName: '',
    type: null,
    offerName: '',
    offerPrice: 0,
    offerSeatPrice: 0,
    offerMaxUsers: 1,
    slots: 1,
    loginEmail: '',
    loginPassword: '',
  })

  // Restore from charter return or hash
  useEffect(() => {
    const charterAccepted = searchParams.get('charter') === 'accepted'
    const urlService = searchParams.get('service')
    const urlServiceName = searchParams.get('serviceName')
    if (charterAccepted && urlService) {
      setState((s) => ({ ...s, service: urlService, serviceName: urlServiceName || urlService, type: 'public' }))
      setStepIndex(2)
      return
    }
    const hash = window.location.hash.slice(1)
    const idx = STEPS.indexOf(hash)
    if (idx >= 0) setStepIndex(idx)
  }, [searchParams])

  const filteredServices = SHARE_SERVICES.filter((s) => {
    const matchSearch = !search.trim() || s.name.toLowerCase().includes(search.trim().toLowerCase())
    const matchCat = category === 'popular' || s.cat === category
    return matchSearch && matchCat
  })

  const goBack = () => {
    if (stepIndex > 0) setStepIndex(stepIndex - 1)
  }

  const showStep = (idx) => setStepIndex(idx)

  const seatPrice = state.offerSeatPrice > 0 ? state.offerSeatPrice : (state.offerPrice / Math.max(1, state.offerMaxUsers))
  const { amountToOwner } = getPriceBreakdown(state.service, state.offerName, seatPrice)
  const earnings = (Math.round(amountToOwner * state.slots * 100) / 100).toFixed(2)

  const checkCharterAccepted = (cb) => {
    const token = getToken()
    if (!token) {
      cb(false)
      return
    }
    fetchWithAuth('/api/auth/me', {})
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => cb(!!(data?.profile?.charter_accepted_at)))
      .catch(() => cb(false))
  }

  const handleServiceSelect = (service, name) => {
    setState((s) => ({ ...s, service, serviceName: name }))
    showStep(1)
  }

  const handleHowSelect = (type) => {
    if (type === 'public') {
      checkCharterAccepted((accepted) => {
        if (!accepted) {
          const params = new URLSearchParams({ from: 'share' })
          if (state.service) params.set('service', state.service)
          if (state.serviceName) params.set('serviceName', state.serviceName)
          navigate({ pathname: '/charter', search: '?' + params.toString() })
          return
        }
        setState((s) => ({ ...s, type: 'public' }))
        showStep(2)
      })
    } else {
      setState((s) => ({ ...s, type: 'private' }))
      showStep(2)
    }
  }

  const handleOfferSelect = (planName, planPrice, offerMaxUsers, seatPriceEur) => {
    const seatPrice = seatPriceEur != null ? seatPriceEur : (planPrice / Math.max(1, offerMaxUsers))
    const slots = Math.min(state.slots, Math.max(1, offerMaxUsers - 1))
    setState((s) => ({ ...s, offerName: planName, offerPrice: planPrice, offerSeatPrice: seatPrice, offerMaxUsers, slots }))
    showStep(3)
  }

  const slotsMinus = () => {
    if (state.slots > 1) setState((s) => ({ ...s, slots: s.slots - 1 }))
  }
  const slotsPlus = () => {
    if (state.slots < state.offerMaxUsers - 1) setState((s) => ({ ...s, slots: s.slots + 1 }))
  }

  return (
    <main className="dashboard-main share-main">
      <div className="share-flow">
        {/* Step 1: Choose service */}
        <section className={`share-step ${stepIndex !== 0 ? 'share-step--hidden' : ''}`} data-step="service">
          <h1 className="share-page-title">{t('dashboard.sharePageTitle')}</h1>
          <div className="share-search-wrap">
            <span className="share-search-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            </span>
            <input
              type="search"
              className="share-search-input"
              placeholder={t('dashboard.searchPlaceholder')}
              aria-label={t('dashboard.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <nav className="share-categories" aria-label="Categories">
            {SHARE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`share-cat-pill ${category === cat.id ? 'share-cat-pill--active' : ''}`}
                data-cat={cat.id}
                onClick={() => setCategory(cat.id)}
              >
                {cat.id === 'popular' ? t('dashboard.popular') : t('dashboard.cat_' + cat.id)}
              </button>
            ))}
          </nav>
          <ul className="share-service-list" aria-label="Services">
            {filteredServices.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="share-service-row"
                  data-service={s.id}
                  data-cat={s.cat}
                  onClick={() => handleServiceSelect(s.id, s.name)}
                >
                  <span className={`share-service-dot share-service-dot--${s.dot}`} />
                  <span className="share-service-name">{s.name}</span>
                  <span className="share-service-chevron">›</span>
                </button>
              </li>
            ))}
          </ul>
          {filteredServices.length === 0 && <p className="dash-muted">{t('dashboard.noServicesMatch')}</p>}
        </section>

        {/* Step 2: How would you like to share? */}
        <section className={`share-step ${stepIndex !== 1 ? 'share-step--hidden' : ''}`} data-step="how">
          <button type="button" className="share-back" aria-label={t('dashboard.back')} onClick={goBack}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          <h2 className="share-step-title">Who can join your subscription?</h2>
          <div className="share-options">
            <button type="button" className="share-option-card" data-type="public" onClick={() => handleHowSelect('public')}>
              <span className="share-option-emoji">🌐</span>
              <h3 className="share-option-title">{t('dashboard.createPublicShare')}</h3>
              <p className="share-option-desc">{t('dashboard.createPublicShareDesc')}</p>
            </button>
            <button type="button" className="share-option-card" data-type="private" onClick={() => handleHowSelect('private')}>
              <span className="share-option-emoji">🤝</span>
              <h3 className="share-option-title">{t('dashboard.createPrivateShare')}</h3>
              <p className="share-option-desc">{t('dashboard.createPrivateShareDesc')}</p>
            </button>
          </div>
          <p className="share-disclaimer">{t('dashboard.shareDisclaimer')}</p>
        </section>

        {/* Step 3: What offer? */}
        <section className={`share-step ${stepIndex !== 2 ? 'share-step--hidden' : ''}`} data-step="offer">
          <button type="button" className="share-back" aria-label={t('dashboard.back')} onClick={goBack}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          <h2 className="share-step-title">{t('dashboard.whatOfferShare', { service: state.serviceName || 'service' })}</h2>
          {(() => {
            const serviceInfo = getServiceBySlug(state.service)
            const fallbackDesc = serviceInfo?.description || `${state.serviceName || 'Service'} subscription.`
            if (serviceInfo?.planOptions?.length) {
              const planName = (name) => (name === 'Standard' || name === 'Premium' ? t('dashboard.' + name.toLowerCase()) : name)
              const planDesc = (slug, name, desc) => {
                if (slug === 'netflix' && name === 'Standard') return t('dashboard.plan_netflix_standard_desc')
                if (slug === 'netflix' && name === 'Premium') return t('dashboard.plan_netflix_premium_desc')
                return desc || fallbackDesc
              }
              return serviceInfo.planOptions.map((plan) => (
                <button
                  key={plan.name}
                  type="button"
                  className="share-offer-row"
                  data-offer={plan.name.toLowerCase().replace(/\s+/g, '-')}
                  onClick={() => handleOfferSelect(plan.name, plan.planPriceEur, plan.maxSeatsNumeric, plan.seatPriceEur)}
                >
                  <div className="share-offer-info">
                    <strong className="share-offer-name">{planName(plan.name)}</strong>
                    <span className="share-offer-desc">{planDesc(state.service, plan.name, plan.description)}</span>
                    <span className="share-offer-meta">
                      {plan.planPriceEur > 0 ? `${plan.planPriceEur.toFixed(2)}${t('dashboard.eurPerMonth')}` : '—'} <span className="share-offer-sep">|</span> <span className="share-offer-users">{plan.maxSeatsNumeric} {t('dashboard.usersMax')}</span>
                    </span>
                  </div>
                  <span className="share-service-chevron">›</span>
                </button>
              ))
            }
            const plans = serviceInfo?.plans?.length ? serviceInfo.plans : ['Family']
            const planPrice = serviceInfo ? getPlanPriceTotal(serviceInfo) : 0
            const maxUsers = serviceInfo?.maxSeatsNumeric ?? 6
            const seatPrice = planPrice / Math.max(1, maxUsers)
            const planLabel = (name) => (name === 'Standard' || name === 'Premium' ? t('dashboard.' + name.toLowerCase()) : name)
            return plans.map((planName) => (
              <button
                key={planName}
                type="button"
                className="share-offer-row"
                data-offer={planName.toLowerCase().replace(/\s+/g, '-')}
                onClick={() => handleOfferSelect(planName, planPrice, maxUsers, seatPrice)}
              >
                <div className="share-offer-info">
                  <strong className="share-offer-name">{planLabel(planName)}</strong>
                  <span className="share-offer-desc">{fallbackDesc}</span>
                  <span className="share-offer-meta">
                    {planPrice > 0 ? `${planPrice.toFixed(2)}${t('dashboard.eurPerMonth')}` : '—'} <span className="share-offer-sep">|</span> <span className="share-offer-users">{maxUsers} {t('dashboard.usersMax')}</span>
                  </span>
                </div>
                <span className="share-service-chevron">›</span>
              </button>
            ))
          })()}
        </section>

        {/* Step 4: How many slots? */}
        <section className={`share-step ${stepIndex !== 3 ? 'share-step--hidden' : ''}`} data-step="slots">
          <button type="button" className="share-back" aria-label={t('dashboard.back')} onClick={goBack}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          <h2 className="share-step-title">{t('dashboard.howManySlots')}</h2>
          <div className="share-slots-counter">
            <button
              type="button"
              className={`share-slots-btn ${state.slots <= 1 ? 'share-slots-btn--disabled' : ''}`}
              aria-label={t('dashboard.decrease')}
              disabled={state.slots <= 1}
              onClick={slotsMinus}
            >
              −
            </button>
            <span className="share-slots-value">{state.slots}</span>
            <button
              type="button"
              className={`share-slots-btn ${state.slots >= state.offerMaxUsers - 1 ? 'share-slots-btn--disabled' : ''}`}
              aria-label={t('dashboard.increase')}
              disabled={state.slots >= state.offerMaxUsers - 1}
              onClick={slotsPlus}
            >
              +
            </button>
          </div>
          <p className="share-slots-earnings">{t('dashboard.youllGetBack')} <strong className="share-slots-price">{earnings} €</strong> {t('dashboard.perMonth')}</p>
          <p className="share-slots-helper">You stay in full control. Seats can be removed anytime.</p>
          <button type="button" className="share-next-btn" onClick={() => showStep(4)}>{t('dashboard.nextLabel')}</button>
          <div className="share-easy-box">
            <strong className="share-easy-title">{t('dashboard.easy')}</strong>
            <p className="share-easy-text">{t('dashboard.easyText')}</p>
          </div>
        </section>

        {/* Step 5: Secure access details (login email, password) */}
        <section className={`share-step share-step--credentials ${stepIndex !== 4 ? 'share-step--hidden' : ''}`} data-step="credentials">
          <button type="button" className="share-back" aria-label={t('dashboard.back')} onClick={goBack}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          <div className="share-step-inner share-step-inner--narrow">
            <h2 className="share-step-title">Secure access {state.serviceName || 'service'} details</h2>
            <p className="share-credentials-helper">Enter the email and password you use to sign in to {state.serviceName || 'the service'}. Co-subscribers will receive these after payment so they can log in. Type the password in full so you can confirm it&apos;s correct.</p>
            <p className="share-credentials-encrypted-label">Encrypted</p>
            <div className="share-credentials-encrypted-box">
              <div className="share-form-group">
                <label htmlFor="share-login-email">Login email</label>
                <input
                  type="email"
                  id="share-login-email"
                  className="share-input share-input--dark"
                  placeholder="email@example.com"
                  autoComplete="email"
                  value={state.loginEmail}
                  onChange={(e) => setState((s) => ({ ...s, loginEmail: e.target.value }))}
                />
              </div>
              <div className="share-form-group">
                <label htmlFor="share-login-password">Password</label>
                <input
                  type="text"
                  id="share-login-password"
                  className="share-input share-input--dark"
                  placeholder="Subscription password"
                  autoComplete="off"
                  value={state.loginPassword}
                  onChange={(e) => setState((s) => ({ ...s, loginPassword: e.target.value }))}
                />
              </div>
            </div>
            <button type="button" className="share-next-btn" onClick={() => showStep(5)} disabled={!state.loginEmail.trim() || !state.loginPassword.trim()}>{t('dashboard.nextLabel')}</button>
          </div>
        </section>

        {/* Step 6: Confirm */}
        <section className={`share-step ${stepIndex !== 5 ? 'share-step--hidden' : ''}`} data-step="confirm">
          <ConfirmStep
            t={t}
            state={state}
            serviceName={state.serviceName || 'the service'}
            onBack={goBack}
            fetchWithAuth={fetchWithAuth}
            getToken={getToken}
            onSuccess={(offerId) => navigate(`/offer?id=${encodeURIComponent(offerId)}`)}
          />
        </section>
      </div>
    </main>
  )
}

function ConfirmStep({ t = (k) => k, state, serviceName, onBack, fetchWithAuth, getToken, onSuccess }) {
  const { showNotification } = useNotification()
  const [phone, setPhone] = useState('')
  const [terms, setTerms] = useState(false)
  const [wiggle, setWiggle] = useState(false)
  const [creating, setCreating] = useState(false)

  const handlePhoneInput = (e) => {
    setPhone(e.target.value.replace(/[^\d+]/g, ''))
  }

  const handleCreate = () => {
    if (!phone.trim()) {
      return
    }
    if (!terms) {
      setWiggle(true)
      const t = setTimeout(() => setWiggle(false), 500)
      return () => clearTimeout(t)
    }
    const token = getToken()
    if (!token) {
      showNotification({ type: 'error', title: 'Error', message: 'Please log in to create an offer.' })
      return
    }
    setCreating(true)
    const visibility = state.type === 'public' ? 'public' : 'private'
    const body = {
      service: state.service,
      service_name: state.serviceName,
      plan: state.offerName,
      price: state.offerSeatPrice > 0 ? state.offerSeatPrice : (state.offerPrice / Math.max(1, state.offerMaxUsers)),
      max_slots: state.slots,
      visibility,
      instant: false,
      verified: false,
      login_email: (state.loginEmail || '').trim() || undefined,
      login_password: (state.loginPassword || '').trim() || undefined,
    }
    fetchWithAuth('/api/offers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then((r) => r.json().then((data) => ({ status: r.status, data })))
      .then((result) => {
        if (result.status === 201 && result.data?.id) {
          onSuccess(result.data.id)
          return
        }
        const msg = result.status === 409
          ? "You already have an offer for this service. Edit or stop the existing one first."
          : (result.data?.error || 'Could not create offer.')
        showNotification({ type: 'error', title: 'Error', message: msg })
      })
      .catch(() => showNotification({ type: 'error', title: 'Error', message: 'Network error.' }))
      .finally(() => setCreating(false))
  }

  return (
    <>
      <button type="button" className="share-back" aria-label={t('dashboard.back')} onClick={onBack}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
      </button>
      <h2 className="share-step-title">Almost there – fees & security</h2>
      <div className="share-fees-box">
        <p className="share-fees-line">Connection fee <span className="share-fees-amount">€0.99</span> — One time applied only for a new co-subscriber.</p>
      </div>
      <div className="share-form-group">
        <label htmlFor="share-phone">{t('dashboard.phoneNumber')}</label>
        <input
          type="tel"
          id="share-phone"
          className="share-input"
          placeholder="+33 6 12 34 56 78"
          inputMode="tel"
          value={phone}
          onChange={handlePhoneInput}
        />
        <p className="share-phone-helper">Used only for security and recovery if access issues occur.</p>
      </div>
      <label className={`share-terms-label ${wiggle ? 'share-terms-label--wiggle' : ''}`}>
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
        <span>I confirm this subscription supports sharing and I agree to the relevant terms. <a href="/terms" target="_blank" rel="noopener noreferrer">Costlyf Terms</a> · <a href="/legal" target="_blank" rel="noopener noreferrer">Service Terms</a></span>
      </label>
      <button type="button" className="share-create-btn" onClick={handleCreate} disabled={creating}>
        {creating ? t('dashboard.creating') : 'Publish listing'}
      </button>
      <p className="share-publish-reassurance">You&apos;re in control. You can remove seats anytime.</p>
    </>
  )
}
