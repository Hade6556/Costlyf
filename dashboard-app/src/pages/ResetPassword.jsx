import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useI18n } from '../contexts/I18nContext'

function parseHash(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  return {
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token'),
    type: params.get('type'),
  }
}

export default function ResetPassword() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [recoveryToken, setRecoveryToken] = useState(null)

  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    const { access_token, type } = parseHash(hash)
    if (type === 'recovery' && access_token) {
      setRecoveryToken(access_token)
    } else {
      setError(t('dashboard.resetPasswordInvalidLink'))
    }
  }, [t])

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!recoveryToken) return
    if (password.length < 6) {
      setError(t('dashboard.resetPasswordTooShort'))
      return
    }
    if (password !== confirm) {
      setError(t('dashboard.resetPasswordMismatch'))
      return
    }
    setSubmitting(true)
    fetch('/api/auth/update-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: recoveryToken, new_password: password }),
    })
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then((result) => {
        if (result.ok) {
          setSuccess(true)
          setTimeout(() => navigate('/login', { replace: true }), 3000)
        } else {
          setError(result.data?.error || t('dashboard.resetPasswordError'))
        }
      })
      .catch(() => setError(t('dashboard.resetPasswordError')))
      .finally(() => setSubmitting(false))
  }

  if (recoveryToken === null && !error) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p className="auth-subtitle">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  if (error && !recoveryToken) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <Link to="/" className="auth-logo">
            <img src="/media/logo.svg" alt="CostLyf" width="120" />
          </Link>
          <h1 className="auth-title">{t('dashboard.resetPasswordTitle')}</h1>
          <p className="auth-error visible" role="alert">{error}</p>
          <p className="auth-footer">
            <Link to="/forgot-password">{t('dashboard.requestNewLink')}</Link>
            {' · '}
            <Link to="/login">{t('dashboard.backToLogin')}</Link>
          </p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <Link to="/" className="auth-logo">
            <img src="/media/logo.svg" alt="CostLyf" width="120" />
          </Link>
          <h1 className="auth-title">{t('dashboard.resetPasswordTitle')}</h1>
          <p className="auth-message visible">{t('dashboard.resetPasswordSuccess')}</p>
          <p className="auth-footer">
            <Link to="/login">{t('dashboard.backToLogin')}</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">
          <img src="/media/logo.svg" alt="CostLyf" width="120" />
        </Link>
        <h1 className="auth-title">{t('dashboard.resetPasswordTitle')}</h1>
        <p className="auth-subtitle">{t('dashboard.resetPasswordSubtitle')}</p>
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="reset-password">{t('dashboard.newPassword')}</label>
            <input
              type="password"
              id="reset-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={submitting}
            />
          </div>
          <div className="field">
            <label htmlFor="reset-confirm">{t('dashboard.confirmPassword')}</label>
            <input
              type="password"
              id="reset-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={submitting}
            />
          </div>
          {error && (
            <p className="auth-error visible" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? t('common.loading') : t('dashboard.setNewPassword')}
          </button>
        </form>
        <p className="auth-footer">
          <Link to="/login">{t('dashboard.backToLogin')}</Link>
        </p>
      </div>
    </div>
  )
}
