import { useEffect, useState } from 'react'
import { Outlet, Link, NavLink, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const ADMIN_NAV = [
  { path: '/admin/withdrawals', label: 'Withdrawals' },
  { path: '/admin/chats', label: 'Chats' },
  { path: '/admin/tickets', label: 'Tickets' },
  { path: '/admin/users', label: 'Users' },
]

export default function AdminLayout() {
  const { user, fetchWithAuth } = useAuth()
  const [adminCheck, setAdminCheck] = useState(null) // null = loading, { admin: true } = ok, { admin: false, message, yourEmail, reason } = denied

  useEffect(() => {
    if (!user) return
    fetchWithAuth('/api/admin/check', {})
      .then((r) => r.json().then((data) => ({ status: r.status, data })))
      .then(({ status, data }) => {
        if (status === 200 && data.admin) setAdminCheck({ admin: true })
        else setAdminCheck({ admin: false, message: data.message || 'Access denied.', yourEmail: data.yourEmail, reason: data.reason })
      })
      .catch(() => setAdminCheck({ admin: false, message: 'Could not verify admin access.', yourEmail: null, reason: 'error' }))
  }, [user, fetchWithAuth])

  if (!user) return <Navigate to="/login" replace />

  if (adminCheck === null) {
    return (
      <main className="dashboard-main">
        <div className="admin-layout">
          <p className="dash-muted">Checking access…</p>
        </div>
      </main>
    )
  }

  if (adminCheck.admin === false) {
    return (
      <main className="dashboard-main">
        <div className="admin-layout">
          <Link to="/home" className="admin-back" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <span className="profile-nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg></span>
            <span>Back to app</span>
          </Link>
          <div className="profile-form-error" role="alert" style={{ padding: '1rem', borderRadius: '8px', marginBottom: '0.5rem' }}>
            <strong>Access denied</strong>
            <p style={{ margin: '0.5rem 0 0' }}>{adminCheck.message}</p>
            {adminCheck.yourEmail && <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', opacity: 0.9 }}>Your login email: <code>{adminCheck.yourEmail}</code></p>}
          </div>
          <p className="dash-muted" style={{ fontSize: '0.9rem' }}>
            On the server, set <code>ADMIN_EMAILS</code> to your email (comma-separated for multiple). On Vercel: Project → Settings → Environment Variables.
          </p>
        </div>
      </main>
    )
  }

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
