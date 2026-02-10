import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../contexts/I18nContext'
import { useAuth } from '../contexts/AuthContext'

const TICKET_POLL_MS = 5000

function formatDate(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString() } catch (e) { return iso }
}

function formatTime(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const h = d.getHours()
    const m = d.getMinutes()
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m
  } catch (e) { return iso }
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
    const messages = ticketDetail.messages || []
    return (
      <div className="help-page help-ticket-chat">
        <div className="subscription-chat-wrap help-ticket-chat-wrap">
          <div className="subscription-chat-header">
            <Link to="/help" className="inbox-chat-back" onClick={(e) => { e.preventDefault(); setSelectedTicketId(null); setTicketDetail(null); setReply(''); }} aria-label="Back to tickets">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
            </Link>
            <span className="inbox-chat-header-avatar inbox-chat-header-avatar--default" style={{ background: '#f59e0b', color: '#fff' }} aria-hidden>
              <span style={{ fontSize: '1rem', fontWeight: 700 }}>!</span>
            </span>
            <div>
              <span className="subscription-chat-with">{ticketDetail.subject}</span>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--dash-text-muted)' }}>
                <span className={`help-ticket-status-inline help-ticket-status--${(ticketDetail.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{ticketDetail.status}</span>
              </p>
            </div>
          </div>
          <div className="subscription-chat-messages">
            {messages.length === 0 && <p className="subscription-chat-placeholder">No messages yet. Send a reply below.</p>}
            {messages.map((m) => {
              const isMe = !m.is_admin
              const cls = isMe ? 'subscription-chat-msg subscription-chat-msg--me' : 'subscription-chat-msg subscription-chat-msg--owner'
              return (
                <div key={m.id} className={cls}>
                  {isMe ? (
                    <span className="subscription-chat-msg-avatar subscription-chat-msg-avatar--default" style={{ '--circle-color': '#a8d4f0' }}>
                      <span className="inbox-avatar-circle"><span style={{ fontSize: '0.875rem', fontWeight: 600 }}>You</span></span>
                    </span>
                  ) : (
                    <span className="subscription-chat-msg-avatar" style={{ background: '#f59e0b', color: '#fff', fontSize: '0.9rem', fontWeight: 700 }} title="Support">!</span>
                  )}
                  <div className="subscription-chat-msg-content">
                    <span className="subscription-chat-msg-text">{m.content}</span>
                    <span className="subscription-chat-msg-meta">{formatTime(m.created_at)}</span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="subscription-chat-input-bar">
            <div className="subscription-chat-input-wrap">
              <input
                type="text"
                className="subscription-chat-input"
                placeholder="Type a message…"
                autoComplete="off"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), sendReply())}
              />
              <button
                type="button"
                className={`subscription-chat-send ${reply.trim() ? '' : 'subscription-chat-send--empty'}`}
                aria-label="Send"
                disabled={!reply.trim() || sendingReply}
                onClick={sendReply}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none"><path d="m12.594 23.258l-.012.002l-.071.035l-.02.004l-.014-.004l-.071-.036q-.016-.004-.024.006l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.016-.018m.264-.113l-.014.002l-.184.093l-.01.01l-.003.011l.018.43l.005.012l.008.008l.201.092q.019.005.029-.008l.004-.014l-.034-.614q-.005-.019-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.003-.011l.018-.43l-.003-.012l-.01-.01z"/><path fill="currentColor" d="M20.235 5.686c.432-1.195-.726-2.353-1.921-1.92L3.709 9.048c-1.199.434-1.344 2.07-.241 2.709l4.662 2.699l4.163-4.163a1 1 0 0 1 1.414 1.414L9.544 15.87l2.7 4.662c.638 1.103 2.274.957 2.708-.241z"/></g></svg>
              </button>
            </div>
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
                <button type="submit" className="profile-btn profile-btn--primary" disabled={submitting || !subject.trim() || !content.trim()}>{submitting ? '…' : 'Create ticket'}</button>
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
