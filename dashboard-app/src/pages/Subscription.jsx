import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../contexts/I18nContext'

const LOGO_MAP = {
  youtube: '/media/brand-logos/youtube.svg',
  'youtube-premium': '/media/brand-logos/youtube.svg',
  spotify: '/media/brand-logos/spotify.svg',
  netflix: '/media/brand-logos/netflix.svg',
  disney: '/media/brand-logos/disney.svg',
  'prime-video': '/media/brand-logos/prime-video.svg',
}

function getMonthProgressColor(fractionLeft) {
  const hue = Math.round(120 * fractionLeft)
  return `hsl(${hue}, 65%, 42%)`
}

export default function Subscription() {
  const { t } = useI18n()
  const { fetchWithAuth } = useAuth()
  const [joined, setJoined] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWithAuth('/api/offers/joined', {})
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setJoined(Array.isArray(data) ? data : []))
      .catch(() => setJoined([]))
      .finally(() => setLoading(false))
  }, [fetchWithAuth])

  return (
    <main className="dashboard-main">
      <div className="subscription-page">
        <Link to="/home" className="subscription-back">‹ {t('dashboard.backToHome')}</Link>
        <h1 className="subscription-title">{t('dashboard.mySubscriptions')}</h1>

        {loading && <p className="dash-muted">{t('dashboard.loading')}</p>}
        {!loading && joined.length === 0 && (
          <p className="my-offers-empty">{t('dashboard.noSubscriptionsJoinHint')}</p>
        )}
        {!loading && joined.length > 0 && (
          <div className="my-offers-list" style={{ marginTop: '1rem' }}>
            {joined.map((sub) => {
              const logo = LOGO_MAP[sub.service] || '/media/logo.svg'
              const daysLeft = typeof sub.days_left === 'number' ? Math.max(0, sub.days_left) : 0
              const isTaken = sub.my_slot_status === 'taken'
              const statusLine = isTaken ? t('dashboard.activeDaysLeft', { n: daysLeft }) : t('dashboard.pending')
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
      </div>
    </main>
  )
}
