import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <main className="dashboard-main">
      <h1 className="profile-main-title">Page not found</h1>
      <p className="profile-panel-desc">The page you’re looking for doesn’t exist.</p>
      <Link to="/home" className="profile-btn profile-btn--primary" style={{ display: 'inline-block', marginTop: '1rem' }}>Go to home</Link>
    </main>
  )
}
