import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { setSession } from '../lib/auth'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../contexts/I18nContext'

export default function Signup() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const { refreshAuth } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [alias, setAlias] = useState('')
  const [phone, setPhone] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const segments = location.pathname.split('/').filter(Boolean)
  const landingPath = segments.length ? `/${segments[0]}` : '/'

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    const payload = {
      email: email.trim(),
      password,
      first_name: firstName.trim() || undefined,
      last_name: lastName.trim() || undefined,
      alias: alias.trim() || undefined,
      phone: phone.trim() || undefined,
      date_of_birth: dateOfBirth || undefined,
    }
    if (!payload.email || !payload.password) {
      setError('Email and password are required.')
      return
    }
    setSubmitting(true)
    fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json().then((data) => ({ ok: r.ok, status: r.status, data })))
      .then((result) => {
        if (result.ok && result.data.access_token) {
          setSession(result.data.access_token, result.data.refresh_token)
          return refreshAuth().then(() => navigate('/home', { replace: true }))
        }
        if (result.ok) {
          setError(result.data.message || 'Account created. Please log in.')
        } else {
          setError(result.data.error || 'Sign up failed')
        }
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
        <h1 className="auth-title">{t('dashboard.signupTitle')}</h1>
        <p className="auth-subtitle">{t('dashboard.signupSubtitle')}</p>
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="signup-email">{t('dashboard.email')}</label>
            <input
              type="email"
              id="signup-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              autoComplete="email"
              disabled={submitting}
            />
          </div>
          <div className="field">
            <label htmlFor="signup-password">{t('dashboard.password')}</label>
            <input
              type="password"
              id="signup-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={submitting}
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="signup-first-name">First name</label>
              <input
                type="text"
                id="signup-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                autoComplete="given-name"
                disabled={submitting}
              />
            </div>
            <div className="field">
              <label htmlFor="signup-last-name">Last name</label>
              <input
                type="text"
                id="signup-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                autoComplete="family-name"
                disabled={submitting}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="signup-alias">Alias</label>
            <input
              type="text"
              id="signup-alias"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="Display name / alias"
              autoComplete="username"
              disabled={submitting}
            />
          </div>
          <div className="field">
            <label htmlFor="signup-phone">Phone (optional)</label>
            <input
              type="tel"
              id="signup-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+33 6 12 34 56 78"
              autoComplete="tel"
              disabled={submitting}
            />
          </div>
          <div className="field">
            <label htmlFor="signup-dob">Date of Birth</label>
            <input
              type="date"
              id="signup-dob"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              autoComplete="bday"
              disabled={submitting}
            />
          </div>
          {error && (
            <p className="auth-error visible" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="auth-submit" disabled={submitting}>
            {t('dashboard.signupTitle')}
          </button>
        </form>
        <p className="auth-footer">
          {t('dashboard.alreadyHaveAccount')} <Link to="/login">{t('dashboard.logIn')}</Link>
        </p>
      </div>
    </div>
  )
}
