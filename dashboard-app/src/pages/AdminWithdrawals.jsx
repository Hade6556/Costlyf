import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const [editingNotesId, setEditingNotesId] = useState(null)
  const [notesDraft, setNotesDraft] = useState('')

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

  const updateRequest = (id, payload) => {
    setUpdatingId(id)
    fetchWithAuth(`/api/admin/withdrawal-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        if (ok) {
          setList((prev) => prev.map((r) => {
            if (r.id !== id) return r
            return { ...r, ...payload, admin_notes: payload.admin_notes !== undefined ? payload.admin_notes : r.admin_notes, status: payload.status !== undefined ? payload.status : r.status, stripe_payout_id: payload.stripe_payout_id !== undefined ? payload.stripe_payout_id : r.stripe_payout_id }
          }))
          if (payload.admin_notes !== undefined) setEditingNotesId(null)
          if (payload.status === 'paid') setStripePayoutId('')
        } else setError(data?.error || 'Update failed')
      })
      .catch((e) => setError(e.message || 'Update failed'))
      .finally(() => setUpdatingId(null))
  }

  const saveNotes = (id, notes) => {
    updateRequest(id, { admin_notes: notes })
  }

  return (
    <>
      <h2 className="profile-main-title">Withdrawal requests</h2>
      <p className="profile-panel-desc">Confirm payouts to IBAN (e.g. send via Stripe Dashboard or bank). Add notes and set status to Paid or Cancelled.</p>

      <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
        <label>
          Status:{' '}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="subscription-chat-input" style={{ padding: '6px 10px' }}>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All</option>
          </select>
        </label>
        <label>
          Stripe payout ID (when marking paid):{' '}
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
                <th style={{ padding: '8px' }}>Notes</th>
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
                  <td style={{ padding: '8px', maxWidth: '180px' }}>
                    {editingNotesId === r.id ? (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
                        <input
                          type="text"
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          placeholder="Admin notes"
                          className="subscription-chat-input"
                          style={{ flex: 1, padding: '4px 8px', fontSize: '0.85rem' }}
                        />
                        <button type="button" className="profile-btn profile-btn--primary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => saveNotes(r.id, notesDraft)}>Save</button>
                        <button type="button" className="profile-btn" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => { setEditingNotesId(null); setNotesDraft(''); }}>Cancel</button>
                      </div>
                    ) : (
                      <span title={r.admin_notes || ''} style={{ cursor: 'pointer' }} onClick={() => { setEditingNotesId(r.id); setNotesDraft(r.admin_notes || ''); }}>
                        {r.admin_notes ? (r.admin_notes.slice(0, 20) + (r.admin_notes.length > 20 ? '…' : '')) : '—'}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '8px' }}>
                    {r.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          className="profile-btn profile-btn--primary"
                          style={{ padding: '4px 10px', fontSize: '0.85rem', marginRight: '6px' }}
                          disabled={updatingId === r.id}
                          onClick={() => updateRequest(r.id, { status: 'paid', stripe_payout_id: stripePayoutId || undefined })}
                        >
                          {updatingId === r.id ? '…' : 'Mark paid'}
                        </button>
                        <button
                          type="button"
                          className="profile-btn"
                          style={{ padding: '4px 10px', fontSize: '0.85rem' }}
                          disabled={updatingId === r.id}
                          onClick={() => updateRequest(r.id, { status: 'cancelled' })}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {r.status === 'paid' && r.stripe_payout_id && <span title={r.stripe_payout_id}>Stripe: {r.stripe_payout_id.slice(0, 12)}…</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
