import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useI18n } from '../contexts/I18nContext'
import { useAuth } from '../contexts/AuthContext'
import { useInboxUnread } from '../contexts/InboxUnreadContext'

const HERO_AVATAR_COLORS = ['#a8e6cf', '#d4b5ff', '#a8d4f0', '#fff4b8', '#ffc8d4']
function getDefaultHeroIndex(userId) {
  if (!userId) return 1
  let h = 0
  const s = String(userId)
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0
  return (Math.abs(h) % 5) + 1
}

function ProfileAvatar({ profile, user }) {
  const avatarUrl = profile?.avatar_url?.trim()
  const heroIndex = getDefaultHeroIndex(user?.id)
  const color = HERO_AVATAR_COLORS[heroIndex - 1] || HERO_AVATAR_COLORS[0]
  if (avatarUrl) {
    return <span className="sidebar-user-avatar sidebar-user-avatar--photo" aria-hidden="true"><img src={avatarUrl} alt="" /></span>
  }
  return (
    <span className="sidebar-user-avatar sidebar-user-avatar--default" aria-hidden="true" style={{ '--circle-color': color }}>
      <span className="profile-avatar-circle">
        <img src={`/media/hero-profiles/${heroIndex}.png`} alt="" />
      </span>
    </span>
  )
}

function NavIcon({ item }) {
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      {path}
    </svg>
  )
}

const NAV_ITEMS = [
  { path: 'home', labelKey: 'dashboard.navHome', icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', polyline: '9 22 9 12 15 12 15 22' },
  { path: 'join', labelKey: 'dashboard.navJoin', icon: 'M11 11m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0', path2: 'm21 21-4.35-4.35' },
  { path: 'share', labelKey: 'dashboard.navShare', circle: true },
  { path: 'inbox', labelKey: 'dashboard.navInbox', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { path: 'wallet', labelKey: 'dashboard.navWallet', customPath: 'M21 9V6.4c0-1.325-.88-2.4-1.964-2.4H2.964C1.879 4 1 5.075 1 6.4v11.2c0 1.325.88 2.4 1.964 2.4h16.072C20.121 20 21 18.925 21 17.6V15m-1-3h.01M16.6 9h4.8a1.6 1.6 0 0 1 1.6 1.6v2.8a1.6 1.6 0 0 1-1.6 1.6h-4.8a1.6 1.6 0 0 1-1.6-1.6v-2.8A1.6 1.6 0 0 1 16.6 9' },
]

const MOBILE_BREAKPOINT = 767

export default function MobileNav() {
  const { t } = useI18n()
  const location = useLocation()
  const { user, profile } = useAuth()
  const { unreadCount } = useInboxUnread()
  const [open, setOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const segments = location.pathname.split('/').filter(Boolean)
  const current = segments[0] || 'home'
  const inboxBadge = unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : null

  const close = () => setOpen(false)

  if (!isMobile) return null

  return (
    <>
      <button
        type="button"
        className="mobile-nav-toggle"
        aria-label={t('dashboard.openMenu', 'Open menu')}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="mobile-nav-toggle-bar" />
        <span className="mobile-nav-toggle-bar" />
        <span className="mobile-nav-toggle-bar" />
      </button>

      <div
        className={`mobile-nav ${open ? 'mobile-nav--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        aria-hidden={!open}
      >
        <div className="mobile-nav-backdrop" onClick={close} onTouchEnd={close} aria-hidden="true" />
        <div className="mobile-nav-panel">
          <div className="mobile-nav-header">
            <a href="/" className="mobile-nav-logo" onClick={close}>
              <img src="/media/iconlogo.png" alt="" />
              <img src="/media/logo.svg" alt="CostLyf" />
            </a>
            <button
              type="button"
              className="mobile-nav-close"
              aria-label={t('dashboard.closeMenu', 'Close menu')}
              onClick={close}
            >
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1={18} y1={6} x2={6} y2={18} />
                <line x1={6} y1={6} x2={18} y2={18} />
              </svg>
            </button>
          </div>
          <nav className="mobile-nav-links">
            <p className="mobile-nav-heading">{t('dashboard.mainMenu')}</p>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.path}
                to={`/${item.path}`}
                className={`mobile-nav-link ${current === item.path ? 'mobile-nav-link--active' : ''}`}
                onClick={close}
              >
                <span className="mobile-nav-link-icon">
                  <NavIcon item={item} />
                </span>
                <span>{t(item.labelKey)}</span>
                {item.path === 'inbox' && inboxBadge ? (
                  <span className="mobile-nav-badge" aria-label={`${unreadCount} unread`}>{inboxBadge}</span>
                ) : null}
              </Link>
            ))}
          </nav>
          <div className="mobile-nav-footer">
            <Link
              to="/profile"
              className={`mobile-nav-link mobile-nav-link--profile ${current === 'profile' ? 'mobile-nav-link--active' : ''}`}
              onClick={close}
            >
              <ProfileAvatar profile={profile} user={user} />
              <span>{t('dashboard.navProfile')}</span>
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
