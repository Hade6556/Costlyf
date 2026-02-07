import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function formatEuros(cents) {
  if (cents == null) return '0'
  return (cents / 100).toFixed(2)
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleString()
  } catch (e) {
    return iso
  }
}

export default function AdminWithdrawals() {
  const { fetchWithAuth } = useAuth()
  const navigate = useNavigate()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [updatingId, setUpdatingId] = useState(null)
  const [stripePayoutId, setStripePayoutId] = useState('')

  useEffect(() => {
    setLoading(true)
    setError(null)
    const q = statusFilter === 'all' ? '' : `?status=${statusFilter}`
    fetchWithAuth(`/api/admin/withdrawal-requests${q}`, {})
      .then((r) => {
        if (r.status === 403) throw new Error('Forbidden')
        return r.ok ? r.json() : null
      })
      .then((data) => setList((data && data.withdrawal_requests) || []))
      .catch((e) => {
        setError(e.message || 'Failed to load')
        if (e.message === 'Forbidden') navigate('/home', { replace: true })
      })
      .finally(() => setLoading(false))
  }, [fetchWithAuth, statusFilter, navigate])

  const markPaid = (id, stripeId) => {
    setUpdatingId(id)
    fetchWithAuth(`/api/admin/withdrawal-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paid', stripe_payout_id: stripeId || undefined }),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        if (ok) {
          setList((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'paid', stripe_payout_id: stripeId || null } : r)))
          setStripePayoutId('') // clear so next "Mark paid" doesn't reuse it
        } else setError(data?.error || 'Update failed')
      })
      .catch((e) => setError(e.message || 'Update failed'))
      .finally(() => setUpdatingId(null))
  }

  return (
    <main className="dashboard-main">
      <Link to="/home" className="profile-nav-item" style={{ display: 'inline-flex', marginBottom: '1rem' }}>
        <span className="profile-nav-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg></span>
        <span>Back</span>
      </Link>

      <h1 className="profile-main-title">Withdrawal requests (admin)</h1>
      <p className="profile-panel-desc">Confirm payouts to IBAN (e.g. send via Stripe Dashboard or bank, then mark as paid).</p>

      <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
        <label>
          Status:{' '}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="subscription-chat-input" style={{ padding: '6px 10px' }}>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="all">All</option>
          </select>
        </label>
        <label>
          Optional Stripe payout ID when marking paid:{' '}
          <input
            type="text"
            placeholder="e.g. po_xxx"
            value={stripePayoutId}
            onChange={(e) => setStripePayoutId(e.target.value)}
            className="subscription-chat-input"
            style={{ padding: '6px 10px', width: '200px' }}
          />
        </label>
      </div>

      {error && <p className="profile-form-error" role="alert">{error}</p>}
      {loading && <p className="dash-muted">Loading…</p>}
      {!loading && list.length === 0 && <p className="dash-muted">No withdrawal requests.</p>}
      {!loading && list.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e5e5', textAlign: 'left' }}>
                <th style={{ padding: '8px' }}>Date</th>
                <th style={{ padding: '8px' }}>User</th>
                <th style={{ padding: '8px' }}>Amount</th>
                <th style={{ padding: '8px' }}>IBAN</th>
                <th style={{ padding: '8px' }}>Account holder</th>
                <th style={{ padding: '8px' }}>Status</th>
                <th style={{ padding: '8px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px' }}>{formatDate(r.created_at)}</td>
                  <td style={{ padding: '8px' }}>{r.user_alias || r.user_email || r.user_id}</td>
                  <td style={{ padding: '8px' }}>{formatEuros(r.amount_cents)}€</td>
                  <td style={{ padding: '8px', fontFamily: 'monospace' }}>{r.iban_snapshot}</td>
                  <td style={{ padding: '8px' }}>{r.account_holder_snapshot || '—'}</td>
                  <td style={{ padding: '8px' }}>{r.status}</td>
                  <td style={{ padding: '8px' }}>
                    {r.status === 'pending' && (
                      <button
                        type="button"
                        className="profile-btn profile-btn--primary"
                        style={{ padding: '4px 12px', fontSize: '0.85rem' }}
                        disabled={updatingId === r.id}
                        onClick={() => markPaid(r.id, stripePayoutId)}
                      >
                        {updatingId === r.id ? '…' : 'Mark paid'}
                      </button>
                    )}
                    {r.status === 'paid' && r.stripe_payout_id && <span title={r.stripe_payout_id}>Stripe: {r.stripe_payout_id.slice(0, 12)}…</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
