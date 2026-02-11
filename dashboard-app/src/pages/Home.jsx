import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../contexts/I18nContext'

// Same logo map as Join page (join/:service) for consistent service cards
const LOGO_MAP = {
  netflix: '/media/brand-logos/netflix.svg',
  'youtube-premium': '/media/brand-logos/youtube.svg',
  youtube: '/media/brand-logos/youtube.svg',
  spotify: '/media/brand-logos/spotify.svg',
  disney: '/media/brand-logos/disney.svg',
  'prime-video': '/media/brand-logos/prime-video.svg',
  crunchyroll: '/media/brand-logos/disney.svg',
}
const DEFAULT_LOGO = '/media/brand-logos/netflix.svg'

const TIP_CARDS = [
  {
    id: 'netflix',
    bg: '#171946',
    image: '/media/tips/monke.png',
    class: 'home-tip-card--netflix',
    content: (
      <>
        <p className="home-tip-main">Save 120€<span className="home-tip-year">/year</span></p>
        <p className="home-tip-sub">by sharing <strong className="home-tip-brand">NETFLIX</strong> with others</p>
      </>
    ),
  },
  {
    id: 'spotify',
    bg: 'linear-gradient(90deg, #0d3320 0%, #0a1f14 50%, #061a10 100%)',
    image: '/media/tips/shark.png',
    class: 'home-tip-card--spotify',
    content: (
      <>
        <div className="home-tip-spotify-head">
          <img src="/media/brand-logos/spotify.svg" alt="Spotify" className="home-tip-spotify-logo" />
        </div>
        <p className="home-tip-slogan">You don&apos;t have to pay <strong>full price</strong> for this</p>
      </>
    ),
  },
  {
    id: 'banana',
    bg: '#e8b742',
    image: '/media/tips/banana.png',
    class: 'home-tip-card--banana',
    content: (
      <>
        <p className="home-tip-dyk">Did you know?</p>
        <p className="home-tip-main-text">You can <strong>reserve</strong> seats for your friends</p>
      </>
    ),
  },
  {
    id: 'cat',
    bg: '#5B4F46',
    image: '/media/tips/cat.png',
    class: 'home-tip-card--cat',
    content: (
      <>
        <p className="home-tip-dyk home-tip-dyk--gray">Did you know?</p>
        <p className="home-tip-headline">Sharing <strong>doesn&apos;t</strong> limit features — only the <strong>price</strong></p>
      </>
    ),
  },
]

const HERO_AVATAR_COLORS = ['#a8e6cf', '#d4b5ff', '#a8d4f0', '#fff4b8', '#ffc8d4']
function getDefaultHeroIndex(userId) {
  if (!userId) return 1
  let h = 0
  const s = String(userId)
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0
  return (Math.abs(h) % 5) + 1
}

function getDaysLeftInMonth() {
  const now = new Date()
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return Math.max(0, lastDay - now.getDate())
}

function getMonthProgressColor(fractionLeft) {
  const hue = Math.round(120 * fractionLeft)
  return `hsl(${hue}, 65%, 42%)`
}

function formatEuros(cents) {
  if (cents == null) return '0'
  return (cents / 100).toFixed(2).replace('.', ',')
}

export default function Home() {
  const { t } = useI18n()
  const { profile, user, fetchWithAuth } = useAuth()
  const [offers, setOffers] = useState([])
  const [joined, setJoined] = useState([])
  const [balanceCents, setBalanceCents] = useState(null)
  const [loadingOffers, setLoadingOffers] = useState(true)
  const [loadingJoined, setLoadingJoined] = useState(true)
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIP_CARDS.length)
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setLoadingOffers(true)
    fetchWithAuth('/api/offers/mine', {})
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setOffers(Array.isArray(data) ? data : []))
      .catch(() => setOffers([]))
      .finally(() => setLoadingOffers(false))
  }, [fetchWithAuth])

  useEffect(() => {
    setLoadingJoined(true)
    fetchWithAuth('/api/offers/joined', {})
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setJoined(Array.isArray(data) ? data : []))
      .catch(() => setJoined([]))
      .finally(() => setLoadingJoined(false))
  }, [fetchWithAuth])

  useEffect(() => {
    fetchWithAuth('/api/wallet/balance', {})
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setBalanceCents(data && data.balance_cents != null ? data.balance_cents : 0))
      .catch(() => setBalanceCents(0))
  }, [fetchWithAuth])

  const nickname = profile?.alias || profile?.email || '—'
  const avatarUrl = profile?.avatar_url?.trim()
  const heroIndex = getDefaultHeroIndex(user?.id)
  const heroColor = HERO_AVATAR_COLORS[heroIndex - 1] || HERO_AVATAR_COLORS[0]

  return (
    <section className="dashboard-home">
      <Link to="/profile" className="home-profile" aria-label={t('dashboard.navProfile', 'Profile')}>
        <span className="home-profile-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" />
          ) : (
            <span className="home-profile-avatar-placeholder" style={{ '--hero-color': heroColor }}>
              <img src={`/media/hero-profiles/${heroIndex}.webp`} alt="" />
            </span>
          )}
        </span>
        <span className="home-profile-name">{nickname}</span>
      </Link>

      <Link to="/wallet" className="home-balance">
        <span className="home-balance-label">{t('dashboard.homeBalance')}</span>
        <span className="home-balance-right">
          <span className="home-balance-amount">{formatEuros(balanceCents)}€</span>
          <span className="home-balance-chevron" aria-hidden="true">›</span>
        </span>
      </Link>

      <div className="home-tip-card-wrap" aria-label="Tip">
        {TIP_CARDS.map((tip, i) => (
          <div
            key={tip.id}
            className={`home-tip-card ${tip.class} ${i === tipIndex ? 'home-tip-card--active' : ''}`}
            style={{ background: tip.bg }}
            aria-hidden={i !== tipIndex}
          >
            <div className="home-tip-card-inner">
              <div className="home-tip-text">{tip.content}</div>
              <div className="home-tip-image-wrap">
                <img src={tip.image} alt="" className="home-tip-image" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {(loadingOffers || offers.length > 0) && (
        <section className="my-offers" id="my-offers-section">
          <h2 className="my-offers-title">{t('dashboard.myOffers')}</h2>
          {loadingOffers ? (
            <div className="my-offers-list skeleton-cards" aria-hidden="true">
              {[1, 2].map((i) => (
                <div key={i} className="skeleton-card skeleton-card--offer">
                  <span className="skeleton-card__avatar" />
                  <div className="skeleton-card__lines">
                    <span className="skeleton-card__line skeleton-card__line--name" />
                    <span className="skeleton-card__line skeleton-card__line--sub" />
                  </div>
                  <span className="skeleton-card__chevron" />
                </div>
              ))}
            </div>
          ) : (
            <div className="my-offers-list" id="my-offers-list">
              {offers.map((offer) => {
                const logo = LOGO_MAP[offer.service] || DEFAULT_LOGO
                const filled = offer.seats_taken || 0
                const total = offer.max_slots || 1
                const visLabel = (offer.visibility || 'private') === 'public' ? t('dashboard.public') : t('dashboard.private')
                return (
                  <Link key={offer.id} to={`/offer?id=${encodeURIComponent(offer.id)}`} className="my-offer-card">
                    <img src={logo} alt="" className="my-offer-logo" />
                    <div className="my-offer-info">
                      <span className="my-offer-name">{offer.service_name || offer.service || 'Offer'}</span>
                      <div className="my-offer-slots">
                        {Array.from({ length: total }).map((_, i) => (
                          <span key={i} className={`my-offer-slot ${i < filled ? 'my-offer-slot--filled' : ''}`} aria-hidden="true">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill={i < filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="my-offer-tag">
                      {visLabel}
                      {(offer.visibility || 'private') === 'public' ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                      )}
                    </span>
                    <span className="my-offer-chevron">›</span>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      )}

      {(loadingJoined || joined.length > 0) && (
        <section className="my-offers my-subscriptions" id="my-subscriptions-section">
          <h2 className="my-offers-title">{t('dashboard.mySubscriptions')}</h2>
          {loadingJoined ? (
            <div className="my-offers-list skeleton-cards" aria-hidden="true">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton-card skeleton-card--offer">
                  <span className="skeleton-card__avatar" />
                  <div className="skeleton-card__lines">
                    <span className="skeleton-card__line skeleton-card__line--name" />
                    <span className="skeleton-card__line skeleton-card__line--sub" />
                  </div>
                  <span className="skeleton-card__circle" />
                  <span className="skeleton-card__chevron" />
                </div>
              ))}
            </div>
          ) : (
            <div className="my-offers-list" id="my-subscriptions-list">
              {joined.map((sub) => {
                const logo = LOGO_MAP[sub.service] || DEFAULT_LOGO
                const daysLeft = typeof sub.days_left === 'number' ? Math.max(0, sub.days_left) : 0
                const isTaken = sub.my_slot_status === 'taken'
                const statusLine = isTaken ? t('dashboard.activeDaysLeft', { n: daysLeft }) : t('dashboard.active')
                const maxDays = 30
                const fractionLeft = Math.min(1, daysLeft / maxDays)
                const progressColor = getMonthProgressColor(fractionLeft)
                const circumference = 2 * Math.PI * 18
                const strokeDash = circumference * fractionLeft
                return (
                  <Link key={sub.id} to={`/offer?id=${encodeURIComponent(sub.id)}`} className="my-offer-card">
                    <img src={logo} alt="" className="my-offer-logo" />
                    <div className="my-offer-info">
                      <span className="my-offer-name">{sub.service_name || sub.service || 'Subscription'}</span>
                      <span className="my-sub-status">{statusLine}</span>
                    </div>
                    <div className="my-sub-days" aria-label={`${daysLeft} days left`}>
                      <div className="my-sub-days-wheel" style={{ '--sub-progress-color': progressColor, '--sub-stroke-dash': strokeDash, '--sub-stroke-circumference': circumference }}>
                        <svg className="my-sub-days-svg" viewBox="0 0 40 40" aria-hidden="true">
                          <circle className="my-sub-days-bg" cx="20" cy="20" r="18" fill="none" strokeWidth="3" />
                          <circle className="my-sub-days-fill" cx="20" cy="20" r="18" fill="none" strokeWidth="3" stroke="var(--sub-progress-color)" strokeDasharray={`${strokeDash} ${circumference}`} strokeDashoffset="0" transform="rotate(-90 20 20)" />
                        </svg>
                        <span className="my-sub-days-num" style={{ color: progressColor }}>{daysLeft}</span>
                      </div>
                    </div>
                    <span className="my-offer-chevron">›</span>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      )}

      <div className="home-cards">
        <div className="home-card home-card--join">
          <div className="home-card-inner">
            <h2 className="home-card-title">{t('dashboard.joinASubscription')}</h2>
            <div className="home-card-illus">
              <img src="/media/home/chairs.webp" alt="" className="home-card-illus-img" />
            </div>
            <Link to="/join" className="home-pill">
              <svg className="home-pill-icon home-pill-icon--svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
              <span className="home-pill-text">{t('dashboard.join')}</span>
            </Link>
          </div>
        </div>
        <div className="home-card home-card--share">
          <div className="home-card-inner">
            <h2 className="home-card-title">{t('dashboard.shareASubscription')}</h2>
            <div className="home-card-illus">
              <img src="/media/home/openhouse.webp" alt="" className="home-card-illus-img" />
            </div>
            <Link to="/share" className="home-pill">
              <span className="home-pill-icon home-pill-icon--plus">+</span>
              <span className="home-pill-text">{t('dashboard.share')}</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
