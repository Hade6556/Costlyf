import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../contexts/I18nContext'
import './Charter.css'

export default function Charter() {
  const { t } = useI18n()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, profile, fetchWithAuth, refreshAuth } = useAuth()
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
        return refreshAuth().then(() => { navigate(getReturnTo(true)) })
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
        <h1 className="charter-title">CostLyf Charter</h1>
        <p className="charter-intro">
          Sharing subscriptions should feel easy, fair, and stress-free.
          That’s the whole point of CostLyf.
        </p>
        <p className="charter-intro charter-intro--secondary">
          This charter exists to make sure owners and co-subscribers know what to expect from each other — so everyone can enjoy their services with confidence.
        </p>
        <p className="charter-lead">Everything here boils down to three ideas:</p>
        <div className="charter-pillars">
          <span className="charter-pillar">Kindness.</span>
          <span className="charter-pillar">Transparency.</span>
          <span className="charter-pillar">Mutual respect.</span>
        </div>

        <div className="charter-content">
          <section className="charter-section">
            <h2 className="charter-section-title">For Subscription Owners 👑</h2>
            <p className="charter-section-intro">Thanks for making sharing possible. To keep things running smoothly, a few simple rules apply:</p>
            <ul className="charter-list">
              <li><strong>Be the real owner</strong> — Only the actual subscription owner can create a split. In some cases, we may ask for proof (like an invoice).</li>
              <li><strong>Make sure your plan allows sharing</strong> — Your subscription must support multiple users and match the service listed on CostLyf.</li>
              <li><strong>Keep pricing fair</strong> — Subscriptions must be shared at the official price in your country. CostLyf is about splitting costs — not reselling for profit.</li>
              <li><strong>Guarantee at least 30 days of access</strong> — Co-subscribers must receive a full 30 days. If a split ends early, future payments are automatically canceled.</li>
              <li><strong>Trials must turn into real subscriptions</strong> — Free trials can only be shared if they convert into a paid plan. Chaining trials is not allowed.</li>
              <li><strong>Share securely</strong> — Login details and invite links must be shared only through CostLyf. Use the secure vault to protect credentials.</li>
              <li><strong>Respect seat limits</strong> — Only offer the number of spots your subscription actually allows.</li>
            </ul>
          </section>

          <section className="charter-section">
            <h2 className="charter-section-title">Messages & Communication 💬</h2>
            <p className="charter-section-intro">Messages exist to keep everyone safe, informed, and comfortable.</p>
            <ul className="charter-list">
              <li><strong>Be respectful</strong> — Polite, calm communication is expected — even when something goes wrong.</li>
              <li><strong>Keep payments on CostLyf</strong> — Never ask for payments outside the platform.</li>
              <li><strong>Protect privacy</strong> — Do not request or misuse personal information.</li>
              <li><strong>Be mindful of timing</strong> — Avoid late-night or very early messages. Not everyone replies instantly — patience matters.</li>
              <li><strong>Zero tolerance for discrimination</strong> — Any discriminatory behavior is not allowed.</li>
            </ul>
          </section>

          <section className="charter-section charter-section--closing">
            <h2 className="charter-section-title">In short 😎</h2>
            <p className="charter-closing">CostLyf is built on a simple belief: sharing should feel human, safe, and fair.</p>
            <p className="charter-closing">By following this charter, you help create a community where everyone enjoys their subscriptions with peace of mind.</p>
            <p className="charter-signature">— The CostLyf Team</p>
          </section>
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
