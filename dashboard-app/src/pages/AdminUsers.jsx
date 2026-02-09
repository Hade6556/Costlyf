import { useEffect, useState, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function formatDate(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString()
  } catch (e) {
    return iso
  }
}

function formatEuros(cents) {
  if (cents == null) return '0'
  return (cents / 100).toFixed(2)
}

export default function AdminUsers() {
  const { fetchWithAuth } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const qs = search ? `?q=${encodeURIComponent(search)}` : ''
    fetchWithAuth(`/api/admin/users${qs}`, {})
      .then((r) => {
        if (r.status === 403) throw new Error('Forbidden')
        return r.ok ? r.json() : []
      })
      .then(setUsers)
      .catch((e) => {
        setError(e.message || 'Failed to load')
        if (e.message === 'Forbidden') navigate('/home', { replace: true })
      })
      .finally(() => setLoading(false))
  }, [fetchWithAuth, search, navigate])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    setDetailLoading(true)
    fetchWithAuth(`/api/admin/users/${selectedId}`, {})
      .then((r) => (r.ok ? r.json() : null))
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false))
  }, [selectedId, fetchWithAuth])

  return (
    <>
      <h2 className="profile-main-title">Users</h2>
      <p className="profile-panel-desc">View every user profile, balance, subscriptions, and withdrawal history.</p>

      <div style={{ marginBottom: '1rem' }}>
        <input
          type="search"
          placeholder="Search by email, name, alias, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="subscription-chat-input"
          style={{ padding: '8px 12px', width: '320px', maxWidth: '100%' }}
        />
      </div>

      {error && <p className="profile-form-error" role="alert">{error}</p>}
      {loading && <p className="dash-muted">Loading…</p>}

      {!loading && (
        <div style={{ display: 'flex', gap: '1rem', minHeight: '400px' }}>
          <div style={{ flex: '0 0 260px', borderRight: '1px solid #eee', paddingRight: '1rem', overflowY: 'auto', maxHeight: '70vh' }}>
            {users.length === 0 && <p className="dash-muted">No users.</p>}
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelectedId(u.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.6rem',
                  marginBottom: '0.4rem',
                  border: selectedId === u.id ? '2px solid var(--dash-primary)' : '1px solid #eee',
                  borderRadius: '8px',
                  background: selectedId === u.id ? '#f0f9ff' : '#fff',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{u.alias || u.email || u.id?.slice(0, 8)}</span>
                <span style={{ display: 'block', fontSize: '0.8rem', color: '#666' }}>{u.email}</span>
              </button>
            ))}
          </div>

          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
            {!selectedId && <p className="dash-muted">Select a user.</p>}
            {selectedId && detailLoading && <p className="dash-muted">Loading…</p>}
            {selectedId && detail && !detailLoading && (
              <div style={{ paddingRight: '1rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Profile</h3>
                <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.35rem 1.5rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                  {Object.entries(detail.profile || {}).map(([k, v]) => (
                    <Fragment key={k}>
                      <dt style={{ color: '#666' }}>{k}</dt>
                      <dd style={{ margin: 0 }}>{v != null ? String(v) : '—'}</dd>
                    </Fragment>
                  ))}
                </dl>

                <h3 style={{ marginBottom: '0.5rem' }}>Balance</h3>
                <p style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>{formatEuros(detail.balance_cents)}€</p>

                <h3 style={{ marginBottom: '0.5rem' }}>Balance history (last 100)</h3>
                <div style={{ marginBottom: '1rem', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #eee' }}>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Date</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Type</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Ref</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.balance_transactions || []).slice(0, 50).map((tx) => (
                        <tr key={tx.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '6px 8px' }}>{formatDate(tx.created_at)}</td>
                          <td style={{ padding: '6px 8px' }}>{tx.type}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatEuros(tx.amount_cents)}€</td>
                          <td style={{ padding: '6px 8px', fontSize: '0.8rem', color: '#666' }}>{tx.reference_type} {tx.reference_id ? String(tx.reference_id).slice(0, 8) : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h3 style={{ marginBottom: '0.5rem' }}>Offers owned</h3>
                <ul style={{ marginBottom: '1rem', paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
                  {(detail.offers_owned || []).length === 0 && <li>None</li>}
                  {(detail.offers_owned || []).map((o) => (
                    <li key={o.id}>{o.service_name || o.service} — {o.plan} · {formatEuros(o.price ? Math.round(o.price * 100) : 0)}€ · {o.max_slots} slots</li>
                  ))}
                </ul>

                <h3 style={{ marginBottom: '0.5rem' }}>Slots joined</h3>
                <ul style={{ marginBottom: '1rem', paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
                  {(detail.slots_joined || []).length === 0 && <li>None</li>}
                  {(detail.slots_joined || []).map((s, i) => (
                    <li key={s.offer_id + '-' + s.slot_index}>{s.offer_id?.slice(0, 8)}… slot {s.slot_index} — {s.status}</li>
                  ))}
                </ul>

                <h3 style={{ marginBottom: '0.5rem' }}>Withdrawal requests</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #eee' }}>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Date</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.withdrawal_requests || []).length === 0 && <tr><td colSpan={3} style={{ padding: '8px' }}>None</td></tr>}
                      {(detail.withdrawal_requests || []).map((w) => (
                        <tr key={w.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '6px 8px' }}>{formatDate(w.created_at)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatEuros(w.amount_cents)}€</td>
                          <td style={{ padding: '6px 8px' }}>{w.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
