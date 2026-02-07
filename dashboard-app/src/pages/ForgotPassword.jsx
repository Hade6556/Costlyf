import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../contexts/I18nContext'

export default function ForgotPassword() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim()) {
      setError('Email is required.')
      return
    }
    setSubmitting(true)
    fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then((result) => {
        if (result.ok) {
          setSent(true)
        } else {
          setError(result.data?.error || 'Something went wrong. Try again.')
        }
      })
      .catch(() => setError('Network error. Try again.'))
      .finally(() => setSubmitting(false))
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">
          <img src="/media/logo.svg" alt="CostLyf" width="120" />
        </Link>
        <h1 className="auth-title">{t('dashboard.forgotPasswordTitle')}</h1>
        <p className="auth-subtitle">{t('dashboard.forgotPasswordSubtitle')}</p>

        {sent ? (
          <>
            <p className="auth-message visible">{t('dashboard.forgotPasswordSent')}</p>
            <p className="auth-footer">
              <Link to="/login">{t('dashboard.backToLogin')}</Link>
            </p>
          </>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="forgot-email">{t('dashboard.email')}</label>
              <input
                type="email"
                id="forgot-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                autoComplete="email"
                disabled={submitting}
              />
            </div>
            {error && (
              <p className="auth-error visible" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="auth-submit" disabled={submitting}>
              {submitting ? t('common.loading') : t('dashboard.sendResetLink')}
            </button>
          </form>
        )}

        {!sent && (
          <p className="auth-footer">
            {t('dashboard.rememberPassword')} <Link to="/login">{t('dashboard.backToLogin')}</Link>
          </p>
        )}
      </div>
    </div>
  )
}
