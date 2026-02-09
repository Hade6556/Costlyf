import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../contexts/I18nContext'
import { useAuth } from '../contexts/AuthContext'

const TICKET_POLL_MS = 5000

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

  const fetchTickets = () => {
    if (!user) return
    fetchWithAuth('/api/support/tickets', {})
      .then((r) => (r.ok ? r.json() : []))
      .then(setTickets)
      .catch(() => setTickets([]))
  }

  const fetchTicketDetail = (id) => {
    if (!id) return
    fetchWithAuth(`/api/support/tickets/${id}`, {})
      .then((r) => (r.ok ? r.json() : null))
      .then(setTicketDetail)
      .catch(() => setTicketDetail(null))
  }

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
    fetchTicketDetail(selectedTicketId)
  }, [selectedTicketId, fetchWithAuth])

  // Poll ticket list and open ticket so new admin replies appear without refresh
  useEffect(() => {
    if (!user || !fetchWithAuth) return
    const interval = setInterval(() => {
      fetchTickets()
      if (selectedTicketId) fetchTicketDetail(selectedTicketId)
    }, TICKET_POLL_MS)
    return () => clearInterval(interval)
  }, [user, fetchWithAuth, selectedTicketId])

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

  // Ticket conversation as separate “page” with back button
  if (user && selectedTicketId && ticketDetail) {
    return (
      <div className="help-page">
        <Link to="/help" className="help-back" onClick={(e) => { e.preventDefault(); setSelectedTicketId(null); setTicketDetail(null); setReply(''); }}>
          <span className="profile-nav-icon" aria-hidden><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg></span>
          <span>Back to tickets</span>
        </Link>
        <div className="help-ticket-view">
          <h2 className="help-ticket-subject">{ticketDetail.subject}</h2>
          <span className={`help-ticket-status help-ticket-status--${(ticketDetail.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{ticketDetail.status}</span>
          <div className="help-ticket-messages">
            {(ticketDetail.messages || []).map((m) => (
              <div key={m.id} className={`help-ticket-msg ${m.is_admin ? 'help-ticket-msg--support' : 'help-ticket-msg--you'}`}>
                <span className="help-ticket-msg-meta">{m.is_admin ? 'Support' : 'You'} · {formatDate(m.created_at)}</span>
                <div className="help-ticket-msg-body">{m.content}</div>
              </div>
            ))}
          </div>
          <div className="help-ticket-reply-bar">
            <input type="text" placeholder="Reply…" value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), sendReply())} className="subscription-chat-input help-ticket-input" />
            <button type="button" className="profile-btn profile-btn--primary" disabled={!reply.trim() || sendingReply} onClick={sendReply}>{sendingReply ? '…' : 'Send'}</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="help-page">
      <Link to="/home" className="help-back">
        <span className="profile-nav-icon" aria-hidden><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg></span>
        <span>Back</span>
      </Link>

      {user && (
        <section className="help-section">
          <h2 className="profile-main-title">Support tickets</h2>
          <p className="profile-panel-desc">Having a problem (e.g. joining a subscription)? Open a ticket and we’ll get back to you.</p>
          {!showForm ? (
            <button type="button" className="profile-btn profile-btn--primary" onClick={() => setShowForm(true)}>New ticket</button>
          ) : (
            <form onSubmit={createTicket} className="help-new-ticket-form">
              <label className="help-form-label">Subject</label>
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Problem joining Netflix offer" className="subscription-chat-input help-form-input" required />
              <label className="help-form-label">Message</label>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Describe your issue…" className="subscription-chat-input help-form-textarea" required />
              <div className="help-form-actions">
                <button type="submit" className="profile-btn profile-btn--primary" disabled={submitting}>{submitting ? '…' : 'Create ticket'}</button>
                <button type="button" className="profile-btn" onClick={() => { setShowForm(false); setSubject(''); setContent(''); }}>Cancel</button>
              </div>
            </form>
          )}

          {loading && <p className="dash-muted">Loading your tickets…</p>}
          {!loading && tickets.length > 0 && (
            <div className="help-ticket-list">
              <p className="help-ticket-list-title">Your tickets</p>
              {tickets.map((t) => (
                <button key={t.id} type="button" className="help-ticket-card" onClick={() => setSelectedTicketId(t.id)}>
                  <span className="help-ticket-card-subject">{t.subject}</span>
                  <span className={`help-ticket-card-status help-ticket-card-status--${(t.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{t.status}</span>
                  <span className="help-ticket-card-date">{formatDate(t.updated_at)}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
