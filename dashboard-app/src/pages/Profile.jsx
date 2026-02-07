import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../contexts/I18nContext'

const HERO_AVATAR_COLORS = ['#a8e6cf', '#d4b5ff', '#a8d4f0', '#fff4b8', '#ffc8d4']

function getDefaultHeroIndex(userId) {
  if (!userId) return 1
  let h = 0
  const s = String(userId)
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0
  return (Math.abs(h) % 5) + 1
}

function formatDate(str) {
  if (!str) return '—'
  try {
    const d = new Date(str)
    if (isNaN(d.getTime())) return str
    const day = ('0' + d.getDate()).slice(-2)
    const month = ('0' + (d.getMonth() + 1)).slice(-2)
    return day + '/' + month + '/' + d.getFullYear()
  } catch {
    return str || '—'
  }
}

function dateToInputValue(str) {
  if (!str) return ''
  try {
    const d = new Date(str)
    if (isNaN(d.getTime())) return ''
    const y = d.getFullYear()
    const m = ('0' + (d.getMonth() + 1)).slice(-2)
    const day = ('0' + d.getDate()).slice(-2)
    return `${y}-${m}-${day}`
  } catch {
    return ''
  }
}

const TRUST_CRITERIA = [
  { key: 'avatar', emoji: '📸', action: 'personal', text: 'Add your profile picture' },
  { key: 'phone', emoji: '☎️', action: 'personal', text: 'Add a verified phone number' },
  { key: 'email', emoji: '📬', action: 'personal', text: 'Confirm your email or log in from a social network' },
  { key: 'date_of_birth', emoji: '📅', action: 'personal', text: 'Add your date of birth' },
  { key: 'first_subscription', emoji: '🤝', action: 'inbox', text: 'Accept a first subscription request' },
  { key: 'subscription_12h', emoji: '⏱️', action: 'inbox', text: 'Accept a subscription request in less than 12 hours' },
  { key: 'shared_30_days', emoji: '📆', action: 'inbox', text: 'Share your subscription with a co-subscriber for a minimum of 30 days' },
  { key: 'bank_account', emoji: '🏦', action: '', text: 'Send a bank account proof (IBAN, SWIFT, BIC …) validated by our banking partner', banking: true },
  { key: 'identity_document', emoji: '🪪', action: '', text: 'Send a first identity document validated by our banking partner', banking: true },
  { key: 'invoices', emoji: '📄', action: 'wallet', text: 'Check my invoices', meta: (c) => ` (${c || 0} / 1)` },
]

function computeTrust(profile, trustStats) {
  const done = {
    avatar: !!(profile?.avatar_url?.trim()),
    phone: !!(profile?.phone?.trim()),
    email: true,
    date_of_birth: !!(profile?.date_of_birth?.trim()),
    first_subscription: !!trustStats?.first_subscription,
    subscription_12h: !!trustStats?.subscription_12h,
    shared_30_days: !!trustStats?.shared_30_days,
    bank_account: false,
    identity_document: false,
    invoices: ((trustStats?.invoices_count ?? 0) | 0) >= 1,
  }
  const total = 10
  const score = [done.avatar, done.phone, done.email, done.date_of_birth, done.first_subscription, done.subscription_12h, done.shared_30_days, done.bank_account, done.identity_document, done.invoices].filter(Boolean).length
  return { score, total, done }
}

function AvatarDisplay({ avatarUrl, userId, size = 'sidebar' }) {
  const isCard = size === 'card'
  const heroIndex = getDefaultHeroIndex(userId)
  const color = HERO_AVATAR_COLORS[heroIndex - 1] || HERO_AVATAR_COLORS[0]
  if (avatarUrl) {
    return (
      <span className={isCard ? 'profile-card-avatar profile-card-avatar--photo' : 'profile-avatar profile-avatar--photo'}>
        <img src={avatarUrl} alt="" />
      </span>
    )
  }
  return (
    <span className={isCard ? 'profile-card-avatar profile-card-avatar--default' : 'profile-avatar profile-avatar--default'}>
      <span className="profile-avatar-circle" style={{ '--circle-color': color }}>
        <img src={`/media/hero-profiles/${heroIndex}.png`} alt="" />
      </span>
    </span>
  )
}

export default function Profile() {
  const { user, profile, trustStats, setProfile, fetchWithAuth, clearSession, loading } = useAuth()
  const navigate = useNavigate()
  const { locale } = useI18n()
  const currentLocale = locale || 'en'
  const [panel, setPanel] = useState('personal')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const avatarInputRef = useRef(null)

  const trust = computeTrust(profile, trustStats)
  const invoicesCount = (trustStats?.invoices_count ?? 0) | 0

  useEffect(() => {
    if (loading) return
    if (!user && !profile) {
      navigate('/login', { replace: true })
      return
    }
  }, [loading, user, profile, navigate])

  useEffect(() => {
    const hash = window.location.hash.slice(1) || 'personal'
    if (['personal', 'privacy', 'trust'].includes(hash)) setPanel(hash)
  }, [])

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.slice(1) || 'personal'
      if (['personal', 'privacy', 'trust'].includes(hash)) setPanel(hash)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const showPanel = (name) => {
    setPanel(name)
    window.location.hash = name
  }

  const handleSignOut = () => {
    clearSession()
    window.location.href = '/'
  }

  const { t } = useI18n()

  if (loading) {
    return (
      <main className="dashboard-main">
        <p className="dash-muted">{t('common.loading')}</p>
      </main>
    )
  }

  const p = profile || {}
  const fullName = [p.first_name, p.last_name].filter(Boolean).join(' ') || '—'
  const username = p.alias || p.email || '—'
  const registeredStr = p.created_at ? (t('dashboard.profileRegisteredSince') + ' ' + formatDate(p.created_at)) : '—'

  return (
    <main className="dashboard-main dashboard-content dashboard-content--profile">
      <div className="profile-layout">
        <aside className="profile-sidebar">
          <div className="profile-user-block">
            <div className="profile-avatar-wrap">
              <AvatarDisplay avatarUrl={p.avatar_url} userId={user?.id} size="sidebar" />
              <span className="profile-avatar-badge">{trust.score}</span>
            </div>
            <p className="profile-username">{username}</p>
            <p className="profile-registered">{registeredStr}</p>
          </div>

          <button type="button" className="profile-trust-card" onClick={() => showPanel('trust')} aria-label={t('dashboard.profileTrustScore')}>
            <div className="profile-trust-row">
              <span className="profile-trust-icon-wrap" aria-hidden="true">
                <span className="profile-trust-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15 8 22 9 17 14 18 21 12 18 6 21 7 14 2 9 9 8" /></svg>
                </span>
              </span>
              <span className="profile-trust-label">{t('dashboard.profileTrustScore')}</span>
              <span className="profile-trust-value">{trust.score}/{trust.total}</span>
            </div>
            <div className="profile-trust-bar-wrap">
              <div className="profile-trust-bar" style={{ width: (trust.score / trust.total * 100) + '%' }} />
            </div>
          </button>

          <p className="profile-nav-heading">{t('dashboard.profileMyAccount')}</p>
          <nav className="profile-nav">
            <button type="button" className={`profile-nav-item ${panel === 'personal' ? 'profile-nav-item--active' : ''}`} onClick={() => showPanel('personal')}>
              <span className="profile-nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg></span>
              <span>{t('dashboard.profilePersonalInfo')}</span>
              <span className="profile-nav-chevron">›</span>
            </button>
            <a href="/wallet" className="profile-nav-item">
              <span className="profile-nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /></svg></span>
              <span>{t('dashboard.profileMyWallet')}</span>
              <span className="profile-nav-chevron">›</span>
            </a>
          </nav>

          <p className="profile-nav-heading">Security &amp; payments</p>
          <nav className="profile-nav">
            <button type="button" className={`profile-nav-item ${panel === 'privacy' ? 'profile-nav-item--active' : ''}`} onClick={() => showPanel('privacy')}>
              <span className="profile-nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg></span>
              <span>{t('dashboard.profilePrivacySecurity')}</span>
              <span className="profile-nav-chevron">›</span>
            </button>
            <a href="#" className="profile-nav-item">
              <span className="profile-nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg></span>
              <span>{t('dashboard.profilePaymentMethod')}</span>
              <span className="profile-nav-chevron">›</span>
            </a>
            <button type="button" className="profile-sign-out" onClick={handleSignOut}>
              <span className="profile-sign-out-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg></span>
              <span>{t('dashboard.profileSignOut')}</span>
            </button>
          </nav>
        </aside>

        <div className="profile-main">
          {panel === 'personal' && (
            <PersonalPanel
              profile={p}
              user={user}
              onUpdate={(data) => setProfile((prev) => ({ ...prev, ...data }))}
              fetchWithAuth={fetchWithAuth}
              onTrustUpdate={() => {}}
              avatarInputRef={avatarInputRef}
            />
          )}
          {panel === 'privacy' && (
            <PrivacyPanel
              passwordError={passwordError}
              passwordSuccess={passwordSuccess}
              setPasswordError={setPasswordError}
              setPasswordSuccess={setPasswordSuccess}
              fetchWithAuth={fetchWithAuth}
            />
          )}
          {panel === 'trust' && (
            <TrustPanel
              trust={trust}
              trustStats={trustStats}
              invoicesCount={invoicesCount}
              onNavigate={showPanel}
              navigateTo={navigate}
              locale={currentLocale}
            />
          )}
        </div>
      </div>
    </main>
  )
}

function PersonalPanel({ profile, user, onUpdate, fetchWithAuth, avatarInputRef }) {
  const { t } = useI18n()
  return (
    <>
      <h1 className="profile-main-title">{t('dashboard.profilePersonalInfo')}</h1>

      <div className="profile-card profile-card--avatar">
        <p className="profile-card-text">{t('dashboard.profileAvatarReassure')}</p>
        <div className="profile-card-avatar-wrap">
          <button type="button" className="profile-card-avatar-trigger" onClick={() => avatarInputRef.current?.click()} aria-label="Change profile picture">
            <AvatarDisplay avatarUrl={profile.avatar_url} userId={user?.id} size="card" />
            <span className="profile-card-avatar-edit" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg></span>
          </button>
          <input
            ref={avatarInputRef}
            id="profile-avatar-upload"
            name="avatar"
            type="file"
            accept="image/jpeg,image/png,image/gif"
            hidden
            aria-label="Upload profile picture"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const fd = new FormData()
              fd.append('avatar', file)
              const token = typeof window !== 'undefined' && localStorage.getItem('costlyf_access_token')
              const headers = token ? { Authorization: 'Bearer ' + token } : {}
              fetch('/api/profile/avatar', { method: 'POST', headers, body: fd })
                .then((r) => r.json())
                .then((data) => {
                  if (!data.error && data.avatar_url) onUpdate({ avatar_url: data.avatar_url })
                })
              e.target.value = ''
            }}
          />
        </div>
      </div>

      <ProfileField label={t('dashboard.profileFirstLastName')} value={[profile.first_name, profile.last_name].filter(Boolean).join(' ') || '—'} fieldKey="full_name" profile={profile} onUpdate={onUpdate} fetchWithAuth={fetchWithAuth} />
      <ProfileField label={t('dashboard.profileAlias')} value={profile.alias || '—'} fieldKey="alias" profile={profile} onUpdate={onUpdate} fetchWithAuth={fetchWithAuth} />
      <ProfileField label={t('dashboard.profileDateOfBirth')} value={profile.date_of_birth ? formatDate(profile.date_of_birth) : '—'} fieldKey="date_of_birth" profile={profile} onUpdate={onUpdate} fetchWithAuth={fetchWithAuth} isDate />
      <h2 className="profile-section-title">{t('dashboard.profileContactInfo')}</h2>
      <ProfileField label={t('dashboard.profileEmailAddress')} value={profile.email || '—'} fieldKey="email" profile={profile} onUpdate={onUpdate} fetchWithAuth={fetchWithAuth} inputType="email" />
      <ProfileField label={t('dashboard.profilePhone')} value={profile.phone || '—'} fieldKey="phone" profile={profile} onUpdate={onUpdate} fetchWithAuth={fetchWithAuth} inputType="tel" />
    </>
  )
}

function ProfileField({ label, value, fieldKey, profile, onUpdate, fetchWithAuth, isDate, inputType = 'text' }) {
  const [editing, setEditing] = useState(false)
  const [first, setFirst] = useState(profile.first_name || '')
  const [last, setLast] = useState(profile.last_name || '')
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const startEdit = () => {
    setSaveError('')
    if (fieldKey === 'full_name') {
      setFirst(profile.first_name || '')
      setLast(profile.last_name || '')
    } else {
      setEditValue(fieldKey === 'date_of_birth' ? dateToInputValue(profile.date_of_birth) : (profile[fieldKey] || ''))
    }
    setEditing(true)
  }

  const handleSave = () => {
    let payload = {}
    if (fieldKey === 'full_name') {
      payload = { first_name: first.trim(), last_name: last.trim() }
    } else {
      payload = { [fieldKey]: editValue.trim() }
    }
    setSaving(true)
    setSaveError('')
    fetchWithAuth('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then((r) => {
        return r.json().then((data) => ({ ok: r.ok, data }))
      })
      .then(({ ok, data }) => {
        if (!ok) {
          setSaveError(data?.error || 'Update failed')
          return
        }
        onUpdate(data)
        setEditing(false)
      })
      .catch(() => {
        setSaveError('Request failed')
      })
      .finally(() => {
        setSaving(false)
      })
  }

  const fieldId = `profile-edit-${fieldKey}`
  const firstId = `profile-edit-first-name`
  const lastId = `profile-edit-last-name`

  return (
    <div className={`profile-field ${editing ? 'profile-field-edit-mode' : ''}`} data-field={fieldKey}>
      <label className="profile-field-label" htmlFor={fieldKey === 'full_name' ? firstId : fieldId}>
        {label}
      </label>
      <div className="profile-field-value">
        <span>{value}</span>
        <button type="button" className="profile-field-edit" aria-label="Edit" onClick={startEdit}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
        </button>
      </div>
      <div className="profile-field-edit-wrap">
        {fieldKey === 'full_name' ? (
          <>
            <div className="profile-field-edit-row">
              <input id={firstId} name="first_name" type="text" placeholder="First name" value={first} onChange={(e) => setFirst(e.target.value)} disabled={saving} autoComplete="given-name" />
              <input id={lastId} name="last_name" type="text" placeholder="Last name" value={last} onChange={(e) => setLast(e.target.value)} disabled={saving} autoComplete="family-name" />
            </div>
            {saveError && <p className="profile-form-error" role="alert">{saveError}</p>}
            <div className="profile-edit-actions">
              <button type="button" className="profile-btn-save" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              <button type="button" className="profile-btn-cancel" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <input
              id={fieldId}
              name={fieldKey}
              type={isDate ? 'date' : inputType}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              disabled={saving}
              autoComplete={fieldKey === 'email' ? 'email' : fieldKey === 'phone' ? 'tel' : 'off'}
            />
            {saveError && <p className="profile-form-error" role="alert">{saveError}</p>}
            <div className="profile-edit-actions">
              <button type="button" className="profile-btn-save" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              <button type="button" className="profile-btn-cancel" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function PrivacyPanel({ passwordError, passwordSuccess, setPasswordError, setPasswordSuccess, fetchWithAuth }) {
  const { t } = useI18n()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess(false)
    if (newPassword.length < 6) {
      setPasswordError(t('dashboard.passwordMinLength'))
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('dashboard.passwordsDoNotMatch'))
      return
    }
    fetchWithAuth('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ new_password: newPassword }) })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setPasswordError(data.error)
          return
        }
        setPasswordSuccess(true)
        setNewPassword('')
        setConfirmPassword('')
        setTimeout(() => setPasswordSuccess(false), 3000)
      })
  }

  return (
    <>
      <h1 className="profile-main-title">{t('dashboard.privacySecurity')}</h1>
      <p className="profile-panel-desc">{t('dashboard.managePasswordPrivacy')}</p>

      <div className="profile-card">
        <h2 className="profile-card-title">{t('dashboard.changePassword')}</h2>
        <form className="profile-form" onSubmit={handleSubmit}>
          <div className="profile-form-field">
            <label htmlFor="profile-new-password">{t('dashboard.newPassword')}</label>
            <input type="password" id="profile-new-password" minLength={6} placeholder={t('dashboard.atLeast6Chars')} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="profile-form-field">
            <label htmlFor="profile-confirm-password">{t('dashboard.confirmNewPassword')}</label>
            <input type="password" id="profile-confirm-password" minLength={6} placeholder={t('dashboard.repeatPassword')} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          {passwordError && <p className="profile-form-error" role="alert">{passwordError}</p>}
          {passwordSuccess && <p className="profile-form-error" style={{ color: '#059669' }}>{t('dashboard.passwordUpdated')}</p>}
          <button type="submit" className="profile-btn profile-btn--primary">{t('dashboard.updatePassword')}</button>
        </form>
      </div>

      <h2 className="profile-privacy-heading">{t('dashboard.privacy')}</h2>
      <p className="profile-privacy-label">{t('dashboard.costlyfTC')}</p>
      <a href="/terms" className="profile-cgu-card">
        <span className="profile-cgu-text">{t('dashboard.signedCGU')}</span>
        <span className="profile-cgu-chevron" aria-hidden="true">›</span>
      </a>
    </>
  )
}

function TrustPanel({ trust, trustStats, invoicesCount, onNavigate, navigateTo, locale: localeProp }) {
  const { t } = useI18n()
  const loc = localeProp || (typeof window !== 'undefined' && window.location.pathname.split('/')[1]) || 'en'
  return (
    <>
      <h1 className="profile-main-title">{t('dashboard.profileTrustScore')}</h1>
      <p className="profile-trust-page-score">{trust.score}/{trust.total}</p>
      <p className="profile-trust-page-desc">{t('dashboard.trustScoreIntro')}</p>
      <ul className="profile-trust-criteria" aria-label="Trust score criteria">
        {TRUST_CRITERIA.map((c) => {
          const isDone = trust.done[c.key]
          const isBanking = c.banking
          const clickable = !isBanking && c.action
          return (
            <li
              key={c.key}
              className={`profile-trust-criterion ${isDone && !isBanking ? 'profile-trust-criterion--done' : ''} ${!isDone && !isBanking ? 'profile-trust-criterion--pending' : ''} ${isBanking ? 'profile-trust-criterion--banking' : ''} ${clickable ? 'profile-trust-criterion--clickable' : ''}`}
              data-criterion={c.key}
              role={clickable ? 'button' : undefined}
              onClick={() => {
                if (!clickable) return
                if (c.action === 'personal') onNavigate('personal')
                else if (c.action === 'inbox') navigateTo('/inbox')
                else if (c.action === 'wallet') window.location.href = `/${loc}/wallet`
              }}
            >
              <span className="profile-trust-criterion-emoji" aria-hidden="true">{c.emoji}</span>
              <span className="profile-trust-criterion-text">{t('dashboard.trust_' + c.key)}{c.meta ? t('dashboard.trust_invoices_meta', { count: invoicesCount ?? 0 }) : ''}</span>
              <span className={`profile-trust-criterion-status profile-trust-criterion-status--${isBanking ? 'disabled' : isDone ? 'done' : 'pending'}`} aria-hidden="true">{isBanking ? '—' : isDone ? '✓' : '›'}</span>
            </li>
          )
        })}
      </ul>
    </>
  )
}
