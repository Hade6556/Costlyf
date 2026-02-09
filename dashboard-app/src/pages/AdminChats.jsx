import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function formatTime(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString()
  } catch (e) {
    return iso
  }
}

export default function AdminChats() {
  const { fetchWithAuth } = useAuth()
  const navigate = useNavigate()
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedThreadId, setSelectedThreadId] = useState(null)
  const [threadDetail, setThreadDetail] = useState(null)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const q = search ? `?q=${encodeURIComponent(search)}` : ''
    fetchWithAuth(`/api/admin/chat/threads${q}`, {})
      .then((r) => {
        if (r.status === 403) throw new Error('Forbidden')
        return r.ok ? r.json() : []
      })
      .then(setThreads)
      .catch((e) => {
        setError(e.message || 'Failed to load')
        if (e.message === 'Forbidden') navigate('/home', { replace: true })
      })
      .finally(() => setLoading(false))
  }, [fetchWithAuth, search, navigate])

  useEffect(() => {
    if (!selectedThreadId) {
      setThreadDetail(null)
      return
    }
    setMessagesLoading(true)
    fetchWithAuth(`/api/admin/chat/threads/${selectedThreadId}/messages`, {})
      .then((r) => (r.ok ? r.json() : null))
      .then(setThreadDetail)
      .catch(() => setThreadDetail(null))
      .finally(() => setMessagesLoading(false))
  }, [selectedThreadId, fetchWithAuth])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [threadDetail?.messages])

  const sendSupportMessage = () => {
    const text = reply.trim()
    if (!text || !selectedThreadId) return
    setSending(true)
    fetchWithAuth(`/api/admin/chat/threads/${selectedThreadId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d.error || 'Send failed') })
        return r.json()
      })
      .then((msg) => {
        setThreadDetail((prev) => prev ? { ...prev, messages: [...(prev.messages || []), msg] } : null)
        setReply('')
      })
      .catch((e) => setError(e.message))
      .finally(() => setSending(false))
  }

  const selectedThread = threads.find((t) => t.id === selectedThreadId)

  return (
    <>
      <h2 className="profile-main-title">All chats</h2>
      <p className="profile-panel-desc">View any user chat and reply as Support to resolve issues.</p>

      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="Search by user name, email or subscription…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="subscription-chat-input"
          style={{ padding: '8px 12px', width: '280px', maxWidth: '100%' }}
        />
      </div>

      {error && <p className="profile-form-error" role="alert">{error}</p>}
      {loading && <p className="dash-muted">Loading threads…</p>}

      {!loading && (
        <div style={{ display: 'flex', gap: '1rem', minHeight: '400px' }}>
          <div style={{ flex: '0 0 280px', borderRight: '1px solid #eee', paddingRight: '1rem', overflowY: 'auto', maxHeight: '70vh' }}>
            {threads.length === 0 && <p className="dash-muted">No threads.</p>}
            {threads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedThreadId(t.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.75rem',
                  marginBottom: '0.5rem',
                  border: selectedThreadId === t.id ? '2px solid var(--dash-primary)' : '1px solid #eee',
                  borderRadius: '8px',
                  background: selectedThreadId === t.id ? '#f0f9ff' : '#fff',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t.user1_name} ↔ {t.user2_name}</span>
                <span style={{ display: 'block', fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>{t.subscription_label}</span>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#999', marginTop: '0.2rem' }}>{formatTime(t.updated_at)}</span>
              </button>
            ))}
          </div>

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {!selectedThreadId && <p className="dash-muted">Select a thread.</p>}
            {selectedThreadId && messagesLoading && <p className="dash-muted">Loading messages…</p>}
            {selectedThreadId && threadDetail && !messagesLoading && (
              <>
                <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                  <strong>{threadDetail.thread?.user1_name} ↔ {threadDetail.thread?.user2_name}</strong>
                  <span style={{ marginLeft: '0.5rem', color: '#666', fontSize: '0.9rem' }}>{threadDetail.thread?.subscription_label}</span>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: '400px', padding: '0.5rem 0', marginBottom: '0.75rem' }}>
                  {(threadDetail.messages || []).map((m) => (
                    <div
                      key={m.id}
                      style={{
                        marginBottom: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        background: m.is_system ? '#fef3c7' : (m.sender_id ? '#f5f5f5' : '#e0f2fe'),
                        maxWidth: '85%',
                        marginLeft: m.is_system || !m.sender_id ? 0 : 'auto',
                        marginRight: m.is_system || !m.sender_id ? 'auto' : 0,
                      }}
                    >
                      <span style={{ fontSize: '0.75rem', color: '#666' }}>
                        {m.is_system || !m.sender_id ? 'Support' : 'User'} · {formatTime(m.created_at)}
                      </span>
                      <div style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {(m.content || '').startsWith('[img]') ? <img src={(m.content || '').slice(5)} alt="Attached" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '6px' }} /> : m.content}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Reply as Support…"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), sendSupportMessage())}
                    className="subscription-chat-input"
                    style={{ flex: 1, padding: '8px 12px' }}
                  />
                  <button type="button" className="profile-btn profile-btn--primary" disabled={!reply.trim() || sending} onClick={sendSupportMessage}>
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
