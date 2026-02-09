import { useState, useEffect } from 'react'
import { useI18n } from '../contexts/I18nContext'
import { useAuth } from '../contexts/AuthContext'

function formatDate(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString() } catch (e) { return iso }
}

export default function Help() {
  const { t } = useI18n()
  const { user, fetchWithAuth } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState(null)
  const [ticketDetail, setTicketDetail] = useState(null)
  const [reply, setReply] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    fetchWithAuth('/api/support/tickets', {})
      .then((r) => (r.ok ? r.json() : []))
      .then(setTickets)
      .catch(() => setTickets([]))
      .finally(() => setLoading(false))
  }, [user, fetchWithAuth])

  useEffect(() => {
    if (!selectedTicketId) { setTicketDetail(null); return }
    fetchWithAuth(`/api/support/tickets/${selectedTicketId}`, {})
      .then((r) => (r.ok ? r.json() : null))
      .then(setTicketDetail)
      .catch(() => setTicketDetail(null))
  }, [selectedTicketId, fetchWithAuth])

  const createTicket = (e) => {
    e.preventDefault()
    if (!subject.trim() || !content.trim()) return
    setSubmitting(true)
    fetchWithAuth('/api/support/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: subject.trim(), content: content.trim() }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d.error || 'Failed') })
        return r.json()
      })
      .then((newTicket) => {
        setTickets((prev) => [newTicket, ...prev])
        setSubject('')
        setContent('')
        setShowForm(false)
        setSelectedTicketId(newTicket.id)
        fetchWithAuth(`/api/support/tickets/${newTicket.id}`, {}).then((r) => r.ok ? r.json() : null).then(setTicketDetail)
      })
      .catch((e) => alert(e.message))
      .finally(() => setSubmitting(false))
  }

  const sendReply = () => {
    if (!reply.trim() || !selectedTicketId) return
    setSendingReply(true)
    fetchWithAuth(`/api/support/tickets/${selectedTicketId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: reply.trim() }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d.error || 'Failed') })
        return r.json()
      })
      .then((msg) => {
        setTicketDetail((prev) => prev ? { ...prev, messages: [...(prev.messages || []), msg] } : null)
        setReply('')
      })
      .catch((e) => alert(e.message))
      .finally(() => setSendingReply(false))
  }

  return (
    <div>
      <h1 className="dashboard-title">{t('dashboard.helpTitle')}</h1>
      <p className="dash-muted">{t('dashboard.helpSubtitle')}</p>

      {user && (
        <section style={{ marginTop: '1.5rem', maxWidth: '600px' }}>
          <h2 className="profile-main-title" style={{ fontSize: '1.25rem' }}>Support tickets</h2>
          <p className="profile-panel-desc">Having a problem (e.g. joining a subscription)? Open a ticket and we’ll get back to you.</p>
          {!showForm ? (
            <button type="button" className="profile-btn profile-btn--primary" onClick={() => setShowForm(true)}>New ticket</button>
          ) : (
            <form onSubmit={createTicket} style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Subject</label>
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Problem joining Netflix offer" className="subscription-chat-input" style={{ width: '100%', padding: '8px 12px', marginBottom: '0.75rem' }} required />
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Message</label>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Describe your issue…" className="subscription-chat-input" style={{ width: '100%', padding: '8px 12px', minHeight: '100px', marginBottom: '0.75rem' }} required />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="profile-btn profile-btn--primary" disabled={submitting}>{submitting ? '…' : 'Create ticket'}</button>
                <button type="button" className="profile-btn" onClick={() => { setShowForm(false); setSubject(''); setContent(''); }}>Cancel</button>
              </div>
            </form>
          )}

          {loading && <p className="dash-muted">Loading your tickets…</p>}
          {!loading && tickets.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Your tickets</p>
              {tickets.map((t) => (
                <button key={t.id} type="button" onClick={() => setSelectedTicketId(t.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem', marginBottom: '0.4rem', border: selectedTicketId === t.id ? '2px solid var(--dash-primary)' : '1px solid #eee', borderRadius: '8px', background: selectedTicketId === t.id ? '#f0f9ff' : '#fff', cursor: 'pointer' }}>
                  {t.subject} — {t.status} · {formatDate(t.updated_at)}
                </button>
              ))}
            </div>
          )}

          {ticketDetail && (
            <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #eee', borderRadius: '12px', background: '#fafafa' }}>
              <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{ticketDetail.subject} — {ticketDetail.status}</p>
              <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '0.75rem' }}>
                {(ticketDetail.messages || []).map((m) => (
                  <div key={m.id} style={{ marginBottom: '0.5rem', padding: '0.5rem', background: m.is_admin ? '#e0f2fe' : '#fff', borderRadius: '8px', border: '1px solid #eee' }}>
                    <span style={{ fontSize: '0.75rem', color: '#666' }}>{m.is_admin ? 'Support' : 'You'} · {formatDate(m.created_at)}</span>
                    <div style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>{m.content}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="text" placeholder="Reply…" value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), sendReply())} className="subscription-chat-input" style={{ flex: 1, padding: '8px 12px' }} />
                <button type="button" className="profile-btn profile-btn--primary" disabled={!reply.trim() || sendingReply} onClick={sendReply}>{sendingReply ? '…' : 'Send'}</button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
