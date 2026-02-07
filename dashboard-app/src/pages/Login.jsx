import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { setSession } from '../lib/auth'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../contexts/I18nContext'

export default function Login() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const { refreshAuth } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const segments = location.pathname.split('/').filter(Boolean)
  const landingPath = segments.length ? `/${segments[0]}` : '/'

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    })
      .then((r) => r.json().then((data) => ({ ok: r.ok, status: r.status, data })))
      .then((result) => {
        if (result.ok && result.data.access_token) {
          setSession(result.data.access_token, result.data.refresh_token)
          return refreshAuth().then(() => {
            const params = new URLSearchParams(location.search)
            const redirect = params.get('redirect')
            if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
              navigate(redirect, { replace: true })
            } else {
              navigate('/home', { replace: true })
            }
          })
        }
        if (result.ok) {
          setError(result.data.message || 'Please try logging in.')
          return
        }
        setError(result.data.error || 'Invalid email or password.')
      })
      .catch(() => setError('Network error. Try again.'))
      .finally(() => setSubmitting(false))
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <a href={landingPath} className="auth-logo">
          <img src="/media/logo.svg" alt="CostLyf" width="120" />
        </a>
        <h1 className="auth-title">{t('dashboard.loginTitle')}</h1>
        <p className="auth-subtitle">{t('dashboard.loginSubtitle')}</p>
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="login-email">{t('dashboard.email')}</label>
            <input
              type="email"
              id="login-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              autoComplete="email"
              disabled={submitting}
            />
          </div>
          <div className="field">
            <label htmlFor="login-password">{t('dashboard.password')}</label>
            <input
              type="password"
              id="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={submitting}
            />
            <p className="auth-forgot">
              <Link to="/forgot-password">{t('dashboard.forgotPassword')}</Link>
            </p>
          </div>
          {error && (
            <p className="auth-error visible" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="auth-submit" disabled={submitting}>
            {t('dashboard.logIn')}
          </button>
        </form>
        <p className="auth-footer">
          {t('dashboard.noAccount')} <Link to="/signup">{t('dashboard.signUpLink')}</Link>
        </p>
      </div>
    </div>
  )
}
