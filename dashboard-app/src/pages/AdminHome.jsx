import { Link } from 'react-router-dom'

const ADMIN_LINKS = [
  { path: '/admin/withdrawals', label: 'Withdrawals', desc: 'Review and process payout requests, add notes, mark paid or cancelled.' },
  { path: '/admin/chats', label: 'Chats', desc: 'View all user chats and reply as Support.' },
  { path: '/admin/tickets', label: 'Tickets', desc: 'Manage support tickets: status, search, and reply.' },
  { path: '/admin/users', label: 'Users', desc: 'Browse users, view profile, balance, and history.' },
]

export default function AdminHome() {
  return (
    <>
      <h2 className="profile-main-title">Admin</h2>
      <p className="profile-panel-desc">Choose a section below.</p>
      <div className="admin-home-cards" style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {ADMIN_LINKS.map(({ path, label, desc }) => (
          <Link
            key={path}
            to={path}
            className="admin-home-card"
            style={{
              display: 'block',
              padding: '1.25rem',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              background: '#fff',
              color: 'inherit',
              textDecoration: 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{label}</span>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: '#6b7280', lineHeight: 1.4 }}>{desc}</p>
          </Link>
        ))}
      </div>
    </>
  )
}
