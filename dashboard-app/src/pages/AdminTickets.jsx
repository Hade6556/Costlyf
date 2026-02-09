import { useEffect, useState } from 'react'
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

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

export default function AdminTickets() {
  const { fetchWithAuth } = useAuth()
  const navigate = useNavigate()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (statusFilter) qs.set('status', statusFilter)
    if (search) qs.set('q', search)
    fetchWithAuth(`/api/admin/tickets?${qs}`, {})
      .then((r) => {
        if (r.status === 403) throw new Error('Forbidden')
        return r.ok ? r.json() : []
      })
      .then(setTickets)
      .catch((e) => {
        setError(e.message || 'Failed to load')
        if (e.message === 'Forbidden') navigate('/home', { replace: true })
      })
      .finally(() => setLoading(false))
  }, [statusFilter, search, fetchWithAuth, navigate])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    setDetailLoading(true)
    fetchWithAuth(`/api/admin/tickets/${selectedId}`, {})
      .then((r) => (r.ok ? r.json() : null))
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false))
  }, [selectedId, fetchWithAuth])

  const setStatus = (id, status) => {
    setUpdatingStatus(true)
    fetchWithAuth(`/api/admin/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d.error || 'Update failed') })
        setDetail((prev) => prev ? { ...prev, status } : null)
        setTickets((prev) => prev.map((t) => t.id === id ? { ...t, status } : t))
      })
      .catch((e) => setError(e.message))
      .finally(() => setUpdatingStatus(false))
  }

  const sendReply = () => {
    const text = reply.trim()
    if (!text || !selectedId) return
    setSending(true)
    fetchWithAuth(`/api/admin/tickets/${selectedId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d.error || 'Send failed') })
        return r.json()
      })
      .then((msg) => {
        setDetail((prev) => prev ? { ...prev, messages: [...(prev.messages || []), msg] } : null)
        setReply('')
      })
      .catch((e) => setError(e.message))
      .finally(() => setSending(false))
  }

  return (
    <>
      <h2 className="profile-main-title">Support tickets</h2>
      <p className="profile-panel-desc">View and respond to user tickets. Update status as you work on them.</p>

      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <label>
          Status:{' '}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="subscription-chat-input" style={{ padding: '6px 10px' }}>
            <option value="">All</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <input
          type="search"
          placeholder="Search by subject or user…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="subscription-chat-input"
          style={{ padding: '6px 10px', width: '220px' }}
        />
      </div>

      {error && <p className="profile-form-error" role="alert">{error}</p>}
      {loading && <p className="dash-muted">Loading…</p>}

      {!loading && (
        <div style={{ display: 'flex', gap: '1rem', minHeight: '400px' }}>
          <div style={{ flex: '0 0 260px', borderRight: '1px solid #eee', paddingRight: '1rem', overflowY: 'auto', maxHeight: '70vh' }}>
            {tickets.length === 0 && <p className="dash-muted">No tickets.</p>}
            {tickets.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.6rem',
                  marginBottom: '0.4rem',
                  border: selectedId === t.id ? '2px solid var(--dash-primary)' : '1px solid #eee',
                  borderRadius: '8px',
                  background: selectedId === t.id ? '#f0f9ff' : '#fff',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{t.subject}</span>
                <span style={{ display: 'block', fontSize: '0.8rem', color: '#666', marginTop: '0.2rem' }}>{t.user_name || t.user_email}</span>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#999', marginTop: '0.2rem' }}>{t.status} · {formatDate(t.updated_at)}</span>
              </button>
            ))}
          </div>

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {!selectedId && <p className="dash-muted">Select a ticket.</p>}
            {selectedId && detailLoading && <p className="dash-muted">Loading…</p>}
            {selectedId && detail && !detailLoading && (
              <>
                <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid #eee', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                  <strong>{detail.subject}</strong>
                  <span style={{ color: '#666', fontSize: '0.9rem' }}>{detail.user_name} ({detail.user_email})</span>
                  <select
                    value={detail.status}
                    onChange={(e) => setStatus(detail.id, e.target.value)}
                    disabled={updatingStatus}
                    className="subscription-chat-input"
                    style={{ padding: '4px 8px', fontSize: '0.85rem', marginLeft: 'auto' }}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: '320px', padding: '0.5rem 0', marginBottom: '0.75rem' }}>
                  {(detail.messages || []).map((m) => (
                    <div
                      key={m.id}
                      style={{
                        marginBottom: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        background: m.is_admin ? '#e0f2fe' : '#f5f5f5',
                        maxWidth: '90%',
                        marginLeft: m.is_admin ? 'auto' : 0,
                        marginRight: m.is_admin ? 0 : 'auto',
                      }}
                    >
                      <span style={{ fontSize: '0.75rem', color: '#666' }}>
                        {m.is_admin ? 'Admin' : 'User'} · {formatDate(m.created_at)}
                      </span>
                      <div style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Reply as admin…"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), sendReply())}
                    className="subscription-chat-input"
                    style={{ flex: 1, padding: '8px 12px' }}
                  />
                  <button type="button" className="profile-btn profile-btn--primary" disabled={!reply.trim() || sending} onClick={sendReply}>
                    {sending ? '…' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
