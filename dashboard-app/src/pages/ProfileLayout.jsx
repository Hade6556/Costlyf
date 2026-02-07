import { useEffect } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../contexts/I18nContext'
import { AvatarDisplay, computeTrust, formatDate } from './Profile'

export default function ProfileLayout() {
  const { user, profile, trustStats, clearSession, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useI18n()

  const path = location.pathname
  const isPersonal = path === '/profile' || path === '/profile/personal'
  const isPrivacy = path === '/profile/privacy'
  const isTrust = path === '/profile/trust'
  const isPaymentMethod = path === '/profile/payment-method'

  useEffect(() => {
    if (loading) return
    if (!user && !profile) {
      navigate('/login', { replace: true })
    }
  }, [loading, user, profile, navigate])

  const handleSignOut = () => {
    clearSession()
    window.location.href = '/'
  }

  if (loading) {
    return (
      <main className="dashboard-main">
        <p className="dash-muted">{t('common.loading')}</p>
      </main>
    )
  }

  const p = profile || {}
  const username = p.alias || p.email || '—'
  const registeredStr = p.created_at ? (t('dashboard.profileRegisteredSince') + ' ' + formatDate(p.created_at)) : '—'
  const trust = computeTrust(profile, trustStats)

  return (
    <main className="dashboard-main dashboard-content dashboard-content--profile">
      <div className="profile-layout">
        <aside className="profile-sidebar">
          <div className="profile-user-block">
            <div className="profile-avatar-wrap">
              <AvatarDisplay avatarUrl={p.avatar_url} userId={user?.id} size="sidebar" />
              <span className="profile-avatar-badge">{trust.score}</span>
            </div>
            <p className="profile-username">{username}</p>
            <p className="profile-registered">{registeredStr}</p>
          </div>

          <Link to="/profile/trust" className="profile-trust-card" aria-label={t('dashboard.profileTrustScore')}>
            <div className="profile-trust-row">
              <span className="profile-trust-icon-wrap" aria-hidden="true">
                <span className="profile-trust-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15 8 22 9 17 14 18 21 12 18 6 21 7 14 2 9 9 8" /></svg>
                </span>
              </span>
              <span className="profile-trust-label">{t('dashboard.profileTrustScore')}</span>
              <span className="profile-trust-value">{trust.score}/{trust.total}</span>
            </div>
            <div className="profile-trust-bar-wrap">
              <div className="profile-trust-bar" style={{ width: (trust.score / trust.total * 100) + '%' }} />
            </div>
          </Link>

          <p className="profile-nav-heading">{t('dashboard.profileMyAccount')}</p>
          <nav className="profile-nav">
            <Link to="/profile/personal" className={`profile-nav-item ${isPersonal ? 'profile-nav-item--active' : ''}`}>
              <span className="profile-nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg></span>
              <span>{t('dashboard.profilePersonalInfo')}</span>
              <span className="profile-nav-chevron">›</span>
            </Link>
          </nav>

          <p className="profile-nav-heading">Security &amp; payments</p>
          <nav className="profile-nav">
            <Link to="/profile/privacy" className={`profile-nav-item ${isPrivacy ? 'profile-nav-item--active' : ''}`}>
              <span className="profile-nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg></span>
              <span>{t('dashboard.profilePrivacySecurity')}</span>
              <span className="profile-nav-chevron">›</span>
            </Link>
            <Link to="/profile/payment-method" className={`profile-nav-item ${isPaymentMethod ? 'profile-nav-item--active' : ''}`}>
              <span className="profile-nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg></span>
              <span>{t('dashboard.profilePaymentMethod')}</span>
              <span className="profile-nav-chevron">›</span>
            </Link>
            <button type="button" className="profile-sign-out" onClick={handleSignOut}>
              <span className="profile-sign-out-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg></span>
              <span>{t('dashboard.profileSignOut')}</span>
            </button>
          </nav>
        </aside>

        <div className={`profile-main profile-main--outlet ${isPrivacy ? 'profile-main--privacy' : ''}`}>
          <Outlet />
        </div>
      </div>
    </main>
  )
}
