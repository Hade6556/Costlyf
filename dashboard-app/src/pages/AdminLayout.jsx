import { Outlet, Link, NavLink, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const ADMIN_NAV = [
  { path: '/admin/withdrawals', label: 'Withdrawals' },
  { path: '/admin/chats', label: 'Chats' },
  { path: '/admin/tickets', label: 'Tickets' },
  { path: '/admin/users', label: 'Users' },
]

export default function AdminLayout() {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />

  return (
    <main className="dashboard-main">
      <div className="admin-layout">
        <div className="admin-nav">
          <Link to="/home" className="admin-back">
            <span className="profile-nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg></span>
            <span>Back to app</span>
          </Link>
          <h1 className="admin-title">Admin</h1>
          <nav className="admin-tabs" aria-label="Admin sections">
            {ADMIN_NAV.map(({ path, label }) => (
              <NavLink key={path} to={path} className="admin-tab" end>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </main>
  )
}
