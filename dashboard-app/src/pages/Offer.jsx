import { useState, useEffect } from 'react'
import { useSearchParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../contexts/I18nContext'
import { getPriceBreakdown } from '../data/services'

const LOGO_MAP = {
  youtube: '/media/brand-logos/youtube.svg',
  'youtube-premium': '/media/brand-logos/youtube.svg',
  spotify: '/media/brand-logos/spotify.svg',
  netflix: '/media/brand-logos/netflix.svg',
  disney: '/media/brand-logos/disney.svg',
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const day = ('0' + d.getDate()).slice(-2)
    const month = ('0' + (d.getMonth() + 1)).slice(-2)
    return day + '/' + month + '/' + d.getFullYear()
  } catch {
    return '—'
  }
}

function daysLeftUntil(iso) {
  if (!iso) return 0
  try {
    const end = new Date(iso)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    end.setHours(0, 0, 0, 0)
    return Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)))
  } catch {
    return 0
  }
}

const HERO_COLORS = ['#a8e6cf', '#d4b5ff', '#a8d4f0', '#fff4b8', '#ffc8d4']
function getHeroIndex(seed) {
  let h = 0
  const s = String(seed || '')
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0
  return (Math.abs(h) % 5) + 1
}

export default function Offer() {
  const { t } = useI18n()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { fetchWithAuth, user, profile } = useAuth()
  const offerId = searchParams.get('id')
  const [shareLinkCopied, setShareLinkCopied] = useState(false)
  const [offer, setOffer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [charterAccepted, setCharterAccepted] = useState(false)
  const [cosubsOpen, setCosubsOpen] = useState(false)
  const [stopOverlay, setStopOverlay] = useState(false)
  const [cancelOverlay, setCancelOverlay] = useState(false)
  const [cancelSlotIndex, setCancelSlotIndex] = useState(null)
  const [publishOverlay, setPublishOverlay] = useState(false)

  useEffect(() => {
    if (!offerId) {
      navigate('/home', { replace: true })
      return
    }
    fetchWithAuth(`/api/offers/${encodeURIComponent(offerId)}`, {})
      .then((r) => {
        if (!r.ok) return null
        return r.json()
      })
      .then((data) => {
        setOffer(data)
        if (!data) navigate('/home', { replace: true })
      })
      .catch(() => { setOffer(null); navigate('/home', { replace: true }) })
      .finally(() => setLoading(false))
  }, [offerId, fetchWithAuth, navigate])

  useEffect(() => {
    if (searchParams.get('charter') === 'accepted') setCharterAccepted(true)
    else if (user && profile) setCharterAccepted(!!profile.charter_accepted_at)
  }, [user, profile, searchParams])

  if (loading || !offer) {
    return (
      <main className="dashboard-main dashboard-main--offer">
        <section className="offer-screen">
          <div className="app-loading-placeholder" aria-hidden="false">
            <div className="app-loading-placeholder__container">
              <div className="app-loading-placeholder__row">
                <span className="app-loading-placeholder__circle" />
                <div className="app-loading-placeholder__bars">
                  <span className="app-loading-placeholder__bar app-loading-placeholder__bar--short" />
                  <span className="app-loading-placeholder__bar app-loading-placeholder__bar--medium" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    )
  }

  const isOwner = user && offer.owner_id === user.id
  const slots = offer.slots || []
  const mySlot = slots.find((s) => s.user_id === user?.id)
  const isMember = mySlot && !isOwner

  // Non-owner must have a slot to view
  if (user && !isOwner && !mySlot) {
    navigate('/home', { replace: true })
    return null
  }

  const contribution = (offer.contribution_per_month != null) ? Number(offer.contribution_per_month) : 0
  const taken = offer.seats_taken != null ? offer.seats_taken : 0
  const total = offer.max_slots != null ? offer.max_slots : 1
  const filled = (offer.slots || []).filter((s) => s.status === 'taken' || s.status === 'reserved').length
  const displayCount = filled > 0 ? filled : taken
  const { amountToOwner } = getPriceBreakdown(offer.service, offer.plan, contribution)
  const ownerEarningsPerMonth = Math.round(amountToOwner * displayCount * 100) / 100
  const logo = LOGO_MAP[offer.service] || '/media/logo.svg'
  const isPrivate = (offer.visibility || 'private') === 'private'

  const refreshOffer = () => {
    fetchWithAuth(`/api/offers/${encodeURIComponent(offerId)}`, {})
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setOffer(data))
  }

  const updateVisibility = (vis) => {
    fetchWithAuth(`/api/offers/${encodeURIComponent(offerId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility: vis }),
    })
      .then((r) => { if (r.ok) refreshOffer(); else return r.json().then((d) => { throw new Error(d.error) }) })
      .catch((e) => alert(e.message || 'Update failed'))
  }

  const handleStopOffer = () => {
    setStopOverlay(false)
    fetchWithAuth(`/api/offers/${encodeURIComponent(offerId)}`, { method: 'DELETE' })
      .then((r) => { if (r.ok) navigate('/home'); else return r.json().then((d) => { throw new Error(d.error) }) })
      .catch((e) => alert(e.message || 'Could not stop share'))
  }

  const handlePublicClick = () => {
    if (isPrivate && !charterAccepted) {
      navigate({ pathname: '/charter', search: `?from=offer&id=${encodeURIComponent(offerId)}` })
      return
    }
    if (isPrivate) {
      setPublishOverlay(true)
    } else {
      updateVisibility('private')
    }
  }

  const handlePublishConfirm = () => {
    setPublishOverlay(false)
    updateVisibility('public')
  }

  const handleCancelSubscription = (slotIndex) => {
    setCancelSlotIndex(slotIndex)
    setCancelOverlay(true)
  }

  const confirmCancelSubscription = () => {
    if (cancelSlotIndex == null) return
    const idx = cancelSlotIndex
    setCancelOverlay(false)
    setCancelSlotIndex(null)
    fetchWithAuth(`/api/offers/${encodeURIComponent(offerId)}/slots/${idx}/cancel-subscription`, { method: 'POST' })
      .then((r) => { if (r.ok) refreshOffer(); else return r.json().then((d) => { throw new Error(d.error) }) })
      .catch((e) => alert(e.message || 'Could not cancel subscription'))
  }

  return (
    <main className="dashboard-main dashboard-main--offer">
      <section className="offer-screen">
        <header className="offer-header">
          <Link to="/home" className="offer-back" aria-label={t('dashboard.back')}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg></Link>
          <div className="offer-header-center">
            <img src={logo} alt="" className="offer-logo" />
            <h1 className="offer-service-name">{offer.service_name || offer.service || 'Offer'}</h1>
          </div>
          <button type="button" className="offer-share" aria-label="Share" />
        </header>

        <div className={`offer-card offer-view-${isOwner ? 'owner' : 'member'}`} id="offer-card">
          {/* Owner row: only for member view */}
          {isMember && (
            <div className="offer-row offer-row--static offer-member-only" id="offer-owner-row">
              <div className="offer-row-main" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <OwnerAvatar offer={offer} />
                <div>
                  <h2 className="offer-row-title">{t('dashboard.offerOwner')}</h2>
                  <p className="offer-row-meta">{offer.owner_name || '—'}</p>
                </div>
              </div>
              <div className="offer-row-actions offer-row-actions--centered">
                <Link to={`/inbox?offerId=${encodeURIComponent(offerId)}`} className="offer-row-btn offer-owner-action-btn">{t('dashboard.openChat')}</Link>
                <Link to="/help" className="offer-row-btn offer-owner-action-btn offer-support-btn">{t('dashboard.support')}</Link>
              </div>
            </div>
          )}

          <div className="offer-row offer-row--static">
            <div className="offer-row-main">
              <h2 className="offer-row-title">{t('dashboard.details')}</h2>
              <p className="offer-row-detail">{offer.service_name || offer.service || '—'} : {offer.plan || '—'}</p>
              <p className="offer-row-detail offer-row-detail--muted">{t('dashboard.ownerSince')} {formatDate(offer.created_at)}</p>
            </div>
          </div>

          <div className="offer-row offer-row--static">
            <div className="offer-row-main">
              <h2 className="offer-row-title">{isOwner ? t('dashboard.youllGet') : t('dashboard.contribution')}</h2>
              <p className="offer-row-value">
                <svg className="offer-row-bolt" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10.67 21c-.35 0-.62-.31-.57-.66L11 14H7.5c-.88 0-.33-.75-.31-.78c1.26-2.23 3.15-5.53 5.65-9.93a.577.577 0 0 1 1.07.37l-.9 6.34h3.51c.4 0 .62.19.4.66c-3.29 5.74-5.2 9.09-5.75 10.05c-.1.18-.29.29-.5.29"/></svg>
                {isOwner
                  ? `${ownerEarningsPerMonth.toFixed(2)} ${t('dashboard.eurPerMonth')}`
                  : `${contribution === 0 ? '0.00' : contribution.toFixed(2)}${t('dashboard.eurPerMonth')}`
                }
              </p>
              {isOwner && displayCount === 0 && (
                <p className="offer-row-meta offer-row-meta--muted">{t('dashboard.whenCoSubscribersJoin')}</p>
              )}
            </div>
          </div>

          {isOwner && (
            <button type="button" className="offer-row" id="offer-cosubs-row" onClick={() => setCosubsOpen(true)}>
              <div className="offer-row-main">
                <h2 className="offer-row-title">{t('dashboard.coSubscribers')}</h2>
                <p className="offer-row-meta">{displayCount}/{total}</p>
              </div>
              <span className="offer-row-avatar" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg></span>
              <span className="offer-row-chevron">›</span>
            </button>
          )}

          {isMember && mySlot && (
            <div className="offer-row offer-row--static offer-member-only">
              <div className="offer-row-main">
                <h2 className="offer-row-title">{t('dashboard.yourSlot')}</h2>
                <p className="offer-row-meta">
                  <span className={(mySlot.status === 'taken' || mySlot.status === 'reserved') && !mySlot.removal_effective_at ? 'offer-my-slot-status--active' : ''}>
                    {mySlot.removal_effective_at ? 'Canceled' : 'Active'}
                    {(mySlot.status === 'taken' || mySlot.status === 'reserved') && !mySlot.removal_effective_at && typeof mySlot.days_left === 'number' && mySlot.days_left >= 0 ? ` · ${mySlot.days_left} days left` : ''}
                  </span>
                </p>
                {mySlot.removal_effective_at && (
                  <p className="offer-row-meta offer-cancel-effective offer-cancel-effective--scheduled">
                    Cancels on {formatDate(mySlot.removal_effective_at)}. <strong>{daysLeftUntil(mySlot.removal_effective_at)} days left.</strong>
                  </p>
                )}
                {!mySlot.removal_effective_at && (mySlot.status === 'taken' || mySlot.status === 'reserved') && (
                  <button type="button" className="offer-row-btn offer-row-btn--danger" onClick={() => handleCancelSubscription(mySlot.slot_index)}>{t('dashboard.cancelSubscription')}</button>
                )}
              </div>
            </div>
          )}

          {isOwner && (
            <>
              <div className="offer-row offer-row--static offer-owner-only">
                <div className="offer-row-main">
                  <h2 className="offer-row-title">{t('dashboard.support')}</h2>
                  <p className="offer-row-meta offer-row-meta--muted">{t('dashboard.supportHelp')}</p>
                </div>
                <Link to="/help" className="offer-row-btn offer-owner-action-btn offer-support-btn">{t('dashboard.support')}</Link>
              </div>
              <div className="offer-row offer-row--static offer-owner-only">
                <div className="offer-row-main">
                  <h2 className="offer-row-title">{t('dashboard.visibility')}</h2>
                  <div className="offer-visibility-pill" role="group">
                    <button type="button" className={`offer-visibility-option ${isPrivate ? 'offer-visibility-option--active' : ''}`} aria-pressed={isPrivate} onClick={() => updateVisibility('private')}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                      {t('dashboard.private')}
                    </button>
                    <button type="button" className={`offer-visibility-option ${!isPrivate ? 'offer-visibility-option--active' : ''}`} aria-pressed={!isPrivate} onClick={handlePublicClick}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                      {t('dashboard.public')}
                    </button>
                  </div>
                  <p className="offer-row-desc">{t('dashboard.privateModeDesc')}</p>
                </div>
              </div>
              <div className="offer-row offer-row--static offer-owner-only">
                <div className="offer-row-main">
                  <h2 className="offer-row-title">{t('dashboard.shareLink')}</h2>
                  <p className="offer-row-desc">{isPrivate ? t('dashboard.shareLinkDescPrivate') : t('dashboard.shareLinkDescPublic')}</p>
                </div>
                <button
                  type="button"
                  className="offer-row-btn offer-owner-action-btn"
                  onClick={() => {
                    const base = `${window.location.origin}/join`
                    const token = isPrivate && offer.share_token ? `&token=${encodeURIComponent(offer.share_token)}` : ''
                    const url = `${base}?offer=${encodeURIComponent(offerId)}${token}`
                    navigator.clipboard.writeText(url).then(() => {
                      setShareLinkCopied(true)
                      setTimeout(() => setShareLinkCopied(false), 2000)
                    }).catch(() => {})
                  }}
                >
                  {shareLinkCopied ? t('dashboard.copied') : t('dashboard.copyLink')}
                </button>
              </div>
              <Link to={`/charter?from=offer&id=${encodeURIComponent(offerId)}`} className="offer-row offer-owner-only">
                <div className="offer-row-main">
                  <h2 className="offer-row-title">{t('dashboard.charterTitle')}</h2>
                  <span className={`offer-charter-status ${charterAccepted ? '' : 'offer-charter-status--pending'}`}>
                    {charterAccepted ? <><span className="offer-charter-check" aria-hidden="true">✓</span> {t('dashboard.charterAccepted')}</> : t('dashboard.notApproved')}
                  </span>
                  <p className="offer-row-desc">{charterAccepted ? t('dashboard.readCharter') : t('dashboard.readAndAcceptCharter')}</p>
                </div>
                <span className="offer-row-chevron">›</span>
              </Link>
              <button type="button" className="offer-row offer-row--stop offer-owner-only" onClick={() => setStopOverlay(true)}>
                <div className="offer-row-main">
                  <h2 className="offer-row-title">{t('dashboard.stopTheShare')}</h2>
                  <p className="offer-row-desc">{t('dashboard.stopTheShareDesc')}</p>
                </div>
                <span className="offer-row-chevron">›</span>
              </button>
            </>
          )}
        </div>

        {stopOverlay && (
          <div className="offer-stop-overlay" role="dialog" aria-modal="true">
            <div className="offer-stop-backdrop" onClick={() => setStopOverlay(false)} />
            <div className="offer-stop-modal">
              <h2 className="offer-stop-title">{t('dashboard.stopTheShareConfirm')}</h2>
              <p className="offer-stop-message">{t('dashboard.stopTheShareMessage')}</p>
              <div className="offer-stop-actions">
                <button type="button" className="offer-stop-btn offer-stop-btn--secondary" onClick={() => setStopOverlay(false)}>{t('dashboard.cancelLabel')}</button>
                <button type="button" className="offer-stop-btn offer-stop-btn--danger" onClick={handleStopOffer}>{t('dashboard.stopTheShare')}</button>
              </div>
            </div>
          </div>
        )}

        {publishOverlay && (
          <div className="offer-publish-overlay" role="dialog" aria-modal="true">
            <div className="offer-publish-backdrop" onClick={() => setPublishOverlay(false)} />
            <div className="offer-publish-modal">
              <h2 className="offer-publish-title">{t('dashboard.allSet')}</h2>
              <p className="offer-publish-subtitle">{t('dashboard.publishSubtitle')}</p>
              <p className="offer-publish-service">{offer.service_name} {offer.plan}</p>
              <p className="offer-publish-meta">{t('dashboard.perPersonSlots', { total, price: contribution.toFixed(2) })}</p>
              <button type="button" className="offer-publish-btn" onClick={handlePublishConfirm}>{t('dashboard.publish')}</button>
              <button type="button" className="offer-publish-btn offer-publish-btn--secondary" onClick={() => setPublishOverlay(false)}>{t('dashboard.nevermind')}</button>
            </div>
          </div>
        )}

        {cancelOverlay && (
          <div className="offer-cancel-overlay" role="dialog" aria-modal="true">
            <div className="offer-cancel-backdrop" onClick={() => { setCancelOverlay(false); setCancelSlotIndex(null); }} />
            <div className="offer-cancel-modal">
              <h2 className="offer-cancel-title">{t('dashboard.cancelSubscriptionConfirm')}</h2>
              <p className="offer-cancel-message">{t('dashboard.cancelMessage')}</p>
              <div className="offer-cancel-actions">
                <button type="button" className="offer-stop-btn offer-stop-btn--secondary" onClick={() => { setCancelOverlay(false); setCancelSlotIndex(null); }}>{t('dashboard.keepSubscription')}</button>
                <button type="button" className="offer-stop-btn offer-stop-btn--danger" onClick={confirmCancelSubscription}>{t('dashboard.cancelSubscription')}</button>
              </div>
            </div>
          </div>
        )}

        {cosubsOpen && (
          <OfferCosubsModal offer={offer} user={user} onClose={() => setCosubsOpen(false)} onAction={refreshOffer} fetchWithAuth={fetchWithAuth} />
        )}
      </section>
    </main>
  )
}

function OwnerAvatar({ offer }) {
  const avatarUrl = offer?.owner_avatar_url?.trim()
  const name = offer?.owner_name || offer?.owner_alias || 'Owner'
  const idx = getHeroIndex(name)
  const color = HERO_COLORS[idx - 1] || HERO_COLORS[0]
  if (avatarUrl) {
    return (
      <span className="offer-owner-avatar subscription-owner-avatar subscription-owner-avatar--img">
        <img src={avatarUrl} alt="" />
      </span>
    )
  }
  return (
    <span className="offer-owner-avatar subscription-owner-avatar subscription-owner-avatar--default" style={{ '--circle-color': color }}>
      <span className="inbox-avatar-circle"><img src={`/media/hero-profiles/${idx}.webp`} alt="" /></span>
    </span>
  )
}

function OfferCosubsModal({ offer, user, onClose, onAction, fetchWithAuth }) {
  const { t: tf } = useI18n()
  const [loadingState, setLoadingState] = useState(null) // { slotIndex, action: 'reserve' | 'unreserve' }
  const slots = offer?.slots || []
  const filled = slots.filter((s) => s.status === 'taken' || s.status === 'reserved').length
  const displayCount = filled > 0 ? filled : (offer?.seats_taken ?? 0)
  const offerId = offer?.id
  const myId = user?.id != null ? String(user.id) : ''
  const ownerId = offer?.owner_id != null ? String(offer.owner_id) : ''
  const isOwner = ownerId && myId && ownerId === myId

  useEffect(() => {
    if (!loadingState || !slots.length) return
    const slot = slots.find((s) => s.slot_index === loadingState.slotIndex)
    if (!slot) return
    const currentStatus = slot.status || 'available'
    const expected = loadingState.action === 'reserve' ? 'reserved' : 'available'
    if (currentStatus === expected) setLoadingState(null)
  }, [loadingState, slots])

  const doSlotAction = (slotIndex, action) => {
    if (action === 'reserve' || action === 'unreserve') setLoadingState({ slotIndex, action })
    const url = `/api/offers/${encodeURIComponent(offerId)}/slots/${slotIndex}`
    let method = 'POST'
    let path = url
    if (action === 'unreserve') { path = url + '/reserve'; method = 'DELETE' }
    else if (action === 'accept') path = url + '/accept'
    else if (action === 'decline') path = url + '/decline'
    else if (action === 'request-removal') path = url + '/request-removal'
    else if (action === 'schedule-removal') path = url + '/schedule-removal'
    else path = url + '/reserve'
    fetchWithAuth(path, { method })
      .then((r) => {
        if (r.ok) onAction()
        else return r.json().then((d) => { throw new Error(d.error) })
      })
      .catch((e) => {
        setLoadingState(null)
        alert(e.message || 'Action failed')
      })
  }

  return (
    <div className="offer-cosubs-overlay" role="dialog" aria-modal="true">
      <div className="offer-cosubs-backdrop" onClick={onClose} />
      <div className="offer-cosubs-modal">
        <h2 className="offer-cosubs-title">{tf('dashboard.coSubscribers')}</h2>
        <p className="offer-cosubs-meta">{displayCount}/{offer?.max_slots ?? 0} {tf('dashboard.slotsLabel')}</p>
        <div className="offer-cosubs-list">
          {slots.map((slot) => {
            const status = slot.status || 'available'
            const isMine = slot.user_id && String(slot.user_id) === myId
            const reservedByOwner = isOwner && slot.user_id && String(slot.user_id) === myId
            const statusLabel = status === 'available' ? tf('dashboard.available') : status === 'reserved' ? tf('dashboard.reserved') : (slot.removal_effective_at ? tf('dashboard.canceled') : tf('dashboard.active'))
            const slotUserName = (slot.slot_user_name && slot.slot_user_name.trim()) ? slot.slot_user_name : (slot.user_id ? 'User' : '')
            const canUnreserve = status === 'reserved' && isMine
            const canRequestRemoval = status === 'taken' && isMine
            const canOwnerRemove = isOwner && status === 'taken' && slot.user_id && !reservedByOwner && !slot.removal_effective_at
            const canReserve = status === 'available' && user
            const isSlotLoading = loadingState?.slotIndex === slot.slot_index
            const hasSubscriber = (status === 'taken' || status === 'reserved') && slotUserName
            return (
              <div key={slot.slot_index} className={`offer-cosubs-slot offer-cosubs-slot--${status}`}>
                <div>
                  <span className="offer-cosubs-slot-label">{tf('dashboard.slotN', { n: slot.slot_index })}</span>
                  <span className="offer-cosubs-slot-status">{statusLabel}</span>
                  {hasSubscriber && <div className="offer-cosubs-slot-user">{slotUserName}</div>}
                  {(status === 'taken' && slotUserName) && (
                    <div className="offer-cosubs-slot-taken-meta">
                      {slot.reserved_at ? tf('dashboard.sinceDate', { date: formatDate(slot.reserved_at) }) : ''}
                      {slot.removal_effective_at ? ` · ${tf('dashboard.canceledRemoval', { date: formatDate(slot.removal_effective_at) })}` : ''}
                    </div>
                  )}
                </div>
                <div className="offer-cosubs-slot-actions">
                  {canReserve && !isSlotLoading && <button type="button" className="offer-cosubs-slot-btn offer-cosubs-slot-btn--primary" onClick={() => doSlotAction(slot.slot_index, 'reserve')}>{tf('dashboard.reserve')}</button>}
                  {canUnreserve && !isSlotLoading && <button type="button" className="offer-cosubs-slot-btn offer-cosubs-slot-btn--secondary" onClick={() => doSlotAction(slot.slot_index, 'unreserve')}>{tf('dashboard.unreserve')}</button>}
                  {isSlotLoading && (
                    <span className="offer-cosubs-slot-loading" aria-label="Loading">
                      <span className="offer-cosubs-slot-bubble" />
                      <span className="offer-cosubs-slot-bubble" />
                      <span className="offer-cosubs-slot-bubble" />
                    </span>
                  )}
                  {canRequestRemoval && <button type="button" className="offer-cosubs-slot-btn offer-cosubs-slot-btn--danger" onClick={() => doSlotAction(slot.slot_index, 'request-removal')}>{tf('dashboard.requestRemoval')}</button>}
                  {canOwnerRemove && <button type="button" className="offer-cosubs-slot-btn offer-cosubs-slot-btn--danger" onClick={() => doSlotAction(slot.slot_index, 'schedule-removal')}>{tf('dashboard.remove')}</button>}
                </div>
              </div>
            )
          })}
        </div>
        <button type="button" className="offer-cosubs-close" onClick={onClose}>{tf('dashboard.close')}</button>
      </div>
    </div>
  )
}
