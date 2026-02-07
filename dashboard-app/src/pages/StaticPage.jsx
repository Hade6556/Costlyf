import { Link } from 'react-router-dom'
import { useI18n } from '../contexts/I18nContext'

export default function StaticPage({ title, children }) {
  const { t } = useI18n()
  return (
    <main className="dashboard-main">
      <Link to="/home" className="profile-nav-item" style={{ display: 'inline-flex', marginBottom: '1rem' }}>
        <span className="profile-nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg></span>
        <span>{t('common.back') || 'Back'}</span>
      </Link>
      <h1 className="profile-main-title">{title}</h1>
      <div className="profile-panel-desc" style={{ maxWidth: '60ch' }}>
        {children || <p>Content for this page can be added here.</p>}
      </div>
    </main>
  )
}
