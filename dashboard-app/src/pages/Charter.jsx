import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../contexts/I18nContext'
import './Charter.css'

export default function Charter() {
  const { t } = useI18n()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, profile, fetchWithAuth } = useAuth()
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [alreadyAccepted, setAlreadyAccepted] = useState(false)
  const [statusLoaded, setStatusLoaded] = useState(false)

  const from = searchParams.get('from')
  const id = searchParams.get('id')
  const service = searchParams.get('service')
  const serviceName = searchParams.get('serviceName')

  function getReturnTo(afterAccept) {
    if (from === 'offer') {
      const params = new URLSearchParams()
      if (id) params.set('id', id)
      if (afterAccept) params.set('charter', 'accepted')
      const search = params.toString()
      return { pathname: '/offer', search: search ? '?' + search : '' }
    }
    if (from === 'share') {
      const params = new URLSearchParams()
      if (afterAccept) params.set('charter', 'accepted')
      if (service) params.set('service', service)
      if (serviceName) params.set('serviceName', serviceName)
      const search = params.toString()
      return { pathname: '/share', search: search ? '?' + search : '' }
    }
    return { pathname: '/home', search: '' }
  }

  useEffect(() => {
    if (!user || statusLoaded) return
    fetchWithAuth('/api/auth/me', {})
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setStatusLoaded(true)
        if (data?.profile?.charter_accepted_at) setAlreadyAccepted(true)
      })
      .catch(() => setStatusLoaded(true))
  }, [user, statusLoaded, fetchWithAuth])

  const handleAccept = () => {
    if (!checked || loading) return
    if (!user) {
      setError('Please log in to accept the charter.')
      return
    }
    setError('')
    setLoading(true)
    fetchWithAuth('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ charter_accepted_at: new Date().toISOString() }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(r.statusText || 'Update failed')
        return r.json()
      })
      .then(() => {
        navigate(getReturnTo(true))
      })
      .catch((err) => {
        setError(err.message || 'Could not save. Try again.')
        setLoading(false)
      })
  }

  const backTo = getReturnTo(false)

  return (
    <main className="dashboard-main">
      <div className="charter-page">
        <Link to={backTo} className="charter-back">
          ‹ {t('dashboard.back')}
        </Link>
        <h1 className="charter-title">{t('dashboard.charterTitle')}</h1>
        <p className="charter-subtitle">
          {t('dashboard.charterSubtitle1')}
        </p>
        <p className="charter-subtitle">
          {t('dashboard.charterSubtitle2')}
        </p>
        <p className="charter-subtitle">
          {t('dashboard.charterSubtitle3')}
        </p>

        <div className="charter-content">
          <h2>Subscription Owner 👑</h2>
          <p>Thank you for making sharing possible. A few simple commitments help keep everything smooth:</p>
          <ul>
            <li><strong>You must be the real owner</strong><br />Only the subscription owner can create a split. In some cases, an invoice may be requested for verification.</li>
            <li><strong>Make sure your plan supports sharing</strong><br />Your subscription must allow simultaneous users and match the service listed on CostLyf.</li>
            <li><strong>Fair pricing only</strong><br />Subscriptions must be shared at the official price in your country. CostLyf exists for fairness — not resale or profit.</li>
            <li><strong>Minimum 30 days of access</strong><br />Co-subscribers must receive at least 30 full days of access. If a split ends early, future payments are automatically canceled.</li>
            <li><strong>Trials must lead to real subscriptions</strong><br />Free trials can be shared only if they convert into a paid plan. Chaining free trials is not allowed.</li>
            <li><strong>Keep it secure</strong><br />Login details and invitation links must be shared only through CostLyf. Use the secure vault to protect credentials.</li>
            <li><strong>Respect the number of seats</strong><br />Only offer the number of spots your subscription allows.</li>
          </ul>

          <h2>Messages 💬</h2>
          <p>Messages exist to make communication easy and safe for everyone.</p>
          <ul>
            <li><strong>Be respectful</strong><br />Kind, polite communication is expected at all times — even when resolving issues.</li>
            <li><strong>Keep payments on CostLyf</strong><br />Never ask users to pay outside the platform.</li>
            <li><strong>Protect privacy</strong><br />Do not request or misuse personal information.</li>
            <li><strong>Be considerate with timing</strong><br />Avoid late-night or very early messages. Not everyone replies instantly — patience matters.</li>
            <li><strong>No discrimination</strong><br />Any form of discriminatory behavior will not be tolerated.</li>
          </ul>

          <h2>In short 😎</h2>
          <p>CostLyf is built on a simple idea: sharing should feel safe, fair, and human.</p>
          <p>By following this charter, you help create a friendly community where everyone enjoys their subscriptions with peace of mind.</p>
          <p><strong>— The CostLyf Team</strong></p>
        </div>

        {!alreadyAccepted && (
          <div className="charter-accept-block">
            <label className="charter-accept-label">
              <input
                type="checkbox"
                className="charter-accept-checkbox"
                checked={checked}
                onChange={(e) => { setChecked(e.target.checked); setError('') }}
                aria-describedby="charter-error"
              />
              <span className="charter-accept-text">{t('dashboard.charterAccept')}</span>
            </label>
            <button
              type="button"
              className="charter-accept-btn"
              disabled={!checked || loading}
              onClick={handleAccept}
            >
              {loading ? t('dashboard.saving') : t('dashboard.acceptAndContinue')}
            </button>
            {error && (
              <p className="charter-error" id="charter-error" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
        {alreadyAccepted && (
          <div className="charter-already">
            {t('dashboard.charterAlreadyAccepted')}
          </div>
        )}
      </div>
    </main>
  )
}
