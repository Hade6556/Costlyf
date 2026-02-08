import { Outlet, Link, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { useInboxUnread } from './contexts/InboxUnreadContext'
import { useI18n } from './contexts/I18nContext'

const HERO_AVATAR_COLORS = ['#a8e6cf', '#d4b5ff', '#a8d4f0', '#fff4b8', '#ffc8d4']
function getDefaultHeroIndex(userId) {
  if (!userId) return 1
  let h = 0
  const s = String(userId)
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0
  return (Math.abs(h) % 5) + 1
}

function ProfileAvatar({ profile, user, className = 'sidebar-user-avatar' }) {
  const avatarUrl = profile?.avatar_url?.trim()
  const heroIndex = getDefaultHeroIndex(user?.id)
  const color = HERO_AVATAR_COLORS[heroIndex - 1] || HERO_AVATAR_COLORS[0]
  if (avatarUrl) {
    return (
      <span className={`${className} ${className}--photo`} aria-hidden="true">
        <img src={avatarUrl} alt="" />
      </span>
    )
  }
  return (
    <span className={`${className} ${className}--default`} aria-hidden="true" style={{ '--circle-color': color }}>
      <span className="profile-avatar-circle">
        <img src={`/media/hero-profiles/${heroIndex}.png`} alt="" />
      </span>
    </span>
  )
}

const navItems = [
  { path: 'home', labelKey: 'dashboard.navHome', icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', polyline: '9 22 9 12 15 12 15 22' },
  { path: 'join', labelKey: 'dashboard.navJoin', icon: 'M11 11m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0', path2: 'm21 21-4.35-4.35' },
  { path: 'share', labelKey: 'dashboard.navShare', icon: 'M12 5v14M5 12h14', circle: true },
  { path: 'inbox', labelKey: 'dashboard.navInbox', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { path: 'wallet', labelKey: 'dashboard.navWallet', customPath: 'M21 9V6.4c0-1.325-.88-2.4-1.964-2.4H2.964C1.879 4 1 5.075 1 6.4v11.2c0 1.325.88 2.4 1.964 2.4h16.072C20.121 20 21 18.925 21 17.6V15m-1-3h.01M16.6 9h4.8a1.6 1.6 0 0 1 1.6 1.6v2.8a1.6 1.6 0 0 1-1.6 1.6h-4.8a1.6 1.6 0 0 1-1.6-1.6v-2.8A1.6 1.6 0 0 1 16.6 9' },
]
const profilePath = 'profile'
const profileLabelKey = 'dashboard.navProfile'

function NavIcon({ item }) {
  const path = item.customPath
    ? <path d={item.customPath} strokeWidth="1.5" />
    : item.circle
    ? <path d={`M12 5v14M5 12h14`} strokeWidth="2" />
    : item.polyline
    ? <><path d={item.icon} strokeWidth="2" /><polyline points={item.polyline} strokeWidth="2" /></>
    : item.path2 && !item.circle
    ? <><circle cx="11" cy="11" r="8" strokeWidth="2" /><path d={item.path2} strokeWidth="2" /></>
    : item.path2 && item.circle
    ? <><rect x="2" y="5" width="20" height="14" rx="2" strokeWidth="2" /><path d={item.path2} strokeWidth="2" /><circle cx="16" cy="15" r="1.5" fill="currentColor" /></>
    : <path d={item.icon} strokeWidth="2" />
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={item.circle ? 'sidebar-nav-icon--circle' : 'sidebar-nav-icon'}>
      {path}
    </svg>
  )
}

function BottomNavIcon({ item }) {
  const path = item.customPath
    ? <path d={item.customPath} strokeWidth="1.5" />
    : item.circle
    ? <path d="M12 5v14M5 12h14" strokeWidth="2" />
    : item.polyline
    ? <><path d={item.icon} strokeWidth="2" /><polyline points={item.polyline} strokeWidth="2" /></>
    : item.path2 && !item.circle
    ? <><circle cx="11" cy="11" r="8" strokeWidth="2" /><path d={item.path2} strokeWidth="2" /></>
    : item.path2 && item.circle
    ? <><rect x="2" y="5" width="20" height="14" rx="2" strokeWidth="2" /><path d={item.path2} strokeWidth="2" /><circle cx="16" cy="15" r="1.5" fill="currentColor" /></>
    : <path d={item.icon} strokeWidth="2" />
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={item.circle ? 'bottom-nav-icon--circle' : 'bottom-nav-icon'}>
      {path}
    </svg>
  )
}

const PUBLIC_SEGMENTS = new Set(['login', 'signup', 'forgot-password', 'reset-password', 'join', 'charter', 'terms', 'privacy', 'legal', 'guides'])

export default function Layout() {
  const location = useLocation()
  const { user, profile, loading } = useAuth()
  const { unreadCount } = useInboxUnread()
  const { t } = useI18n()

  // pathname is relative to basename (e.g. /join or /profile), so first segment is the route
  const segments = location.pathname.split('/').filter(Boolean)
  const current = segments[0] || 'home'
  const isJoinPage = location.pathname.startsWith('/join')
  const isAuthPage = segments.includes('login') || segments.includes('signup')
  const isPublicRoute = isAuthPage || isJoinPage || (segments[0] && PUBLIC_SEGMENTS.has(segments[0]))
  const inboxBadge = unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : null

  if (isAuthPage) {
    return <Outlet />
  }

  // Only join (and auth pages) are allowed without account; any other route requires login
  if (!loading && !user && !isPublicRoute) {
    const redirect = `${location.pathname}${location.search || ''}`
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />
  }

  return (
    <div className="dashboard">
      <aside className="sidebar" aria-label="Navigation">
        <div className="sidebar-header">
          <a href="/" className="sidebar-logo">
            <img src="/media/iconlogo.png" alt="" className="sidebar-logo-icon" />
            <img src="/media/logo.svg" alt="CostLyf" />
          </a>
        </div>
        <nav className="sidebar-nav">
          <p className="sidebar-nav-heading">{t('dashboard.mainMenu')}</p>
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={`/${item.path}`}
              className={`sidebar-nav-item ${current === item.path ? 'sidebar-nav-item--active' : ''}`}
            >
              <span className="sidebar-nav-icon"><NavIcon item={item} /></span>
              <span>{t(item.labelKey)}</span>
              {item.path === 'inbox' && (inboxBadge ? <span className="inbox-unread-badge" aria-label={`${unreadCount} ${t('dashboard.unreadMessages')}`}>{inboxBadge}</span> : null)}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <Link to={`/${profilePath}`} className={`sidebar-user ${current === profilePath ? 'sidebar-user--active' : ''}`} aria-label={t(profileLabelKey)}>
            <ProfileAvatar profile={profile} user={user} className="sidebar-user-avatar" />
            <span className="sidebar-user-label">{t(profileLabelKey)}</span>
          </Link>
        </div>
      </aside>

      <div className={`dashboard-content ${current === profilePath ? 'dashboard-content--profile' : ''} ${isJoinPage ? 'dashboard-content--join' : ''}`}>
        <main className="dashboard-main">
          <Outlet />
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Main navigation">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={`/${item.path}`}
            className={`bottom-nav-item ${current === item.path ? 'bottom-nav-item--active' : ''}`}
          >
            <span className="bottom-nav-icon-wrap">
              <span className="bottom-nav-icon"><BottomNavIcon item={item} /></span>
              {item.path === 'inbox' && (inboxBadge ? <span className="inbox-unread-badge inbox-unread-badge--overlay" aria-label={`${unreadCount} ${t('dashboard.unreadMessages')}`}>{inboxBadge}</span> : null)}
            </span>
            <span>{t(item.labelKey)}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
