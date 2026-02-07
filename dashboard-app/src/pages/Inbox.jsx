import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useInboxUnread } from '../contexts/InboxUnreadContext'
import { useI18n } from '../contexts/I18nContext'

const SYSTEM_THREAD_ID = 'system'
const POLL_INTERVAL_MS = 5000
const HERO_AVATAR_COLORS = ['#a8e6cf', '#d4b5ff', '#a8d4f0', '#fff4b8', '#ffc8d4']

function getDefaultHeroIndex(seed) {
  if (seed == null || seed === '') return 1
  let h = 0
  const s = String(seed)
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0
  return (Math.abs(h) % 5) + 1
}

function formatTime(date) {
  const d = date instanceof Date ? date : new Date(date)
  const h = d.getHours()
  const m = d.getMinutes()
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m
}

export default function Inbox() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { fetchWithAuth, user, profile } = useAuth()
  const { refreshUnreadCount } = useInboxUnread()
  const [threads, setThreads] = useState([])
  const [systemUnreadCount, setSystemUnreadCount] = useState(0)
  const [hashThreadId, setHashThreadId] = useState(null)
  const messagesEndRef = useRef(null)

  const fetchThreads = useCallback(() => {
    fetchWithAuth('/api/chat/threads', {})
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setThreads(Array.isArray(data) ? data : []))
      .catch(() => setThreads([]))
  }, [fetchWithAuth])

  const fetchSystemUnread = useCallback(() => {
    fetchWithAuth('/api/chat/system-messages', {})
      .then((r) => (r.ok ? r.json() : { unread_count: 0 }))
      .then((data) => {
        setSystemUnreadCount(data.unread_count ?? 0)
        refreshUnreadCount()
      })
      .catch(() => setSystemUnreadCount(0))
  }, [fetchWithAuth, refreshUnreadCount])

  useEffect(() => {
    const readHash = () => {
      const hash = (window.location.hash || '').slice(1)
      if (hash === `thread-${SYSTEM_THREAD_ID}`) setHashThreadId(SYSTEM_THREAD_ID)
      else if (hash.startsWith('thread-')) setHashThreadId(hash.slice(7))
      else setHashThreadId(null)
    }
    readHash()
    window.addEventListener('hashchange', readHash)
    return () => window.removeEventListener('hashchange', readHash)
  }, [])

  useEffect(() => {
    fetchThreads()
    fetchSystemUnread()
  }, [fetchThreads, fetchSystemUnread, hashThreadId])

  useEffect(() => {
    const interval = setInterval(() => {
      fetchThreads()
      fetchSystemUnread()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchThreads, fetchSystemUnread])

  const currentThread = hashThreadId && hashThreadId !== SYSTEM_THREAD_ID ? threads.find((t) => t.id === hashThreadId) : null
  const showList = !hashThreadId
  const showSystemChat = hashThreadId === SYSTEM_THREAD_ID
  const showChat = hashThreadId && currentThread

  return (
    <main className="dashboard-main">
      <div className="inbox-page">
        {/* List view */}
        <div className="inbox-list-view" style={{ display: showList ? undefined : 'none' }}>
          <h1 className="inbox-title">{t('dashboard.inboxTitle')}</h1>
          <p className="inbox-hint">People you subscribe to or who joined your offers.</p>
          <div className="inbox-contacts">
            <Link to="/inbox#thread-system" className="inbox-contact-card" onClick={() => setHashThreadId(SYSTEM_THREAD_ID)}>
              <span className="inbox-contact-avatar inbox-contact-avatar--default" style={{ '--circle-color': '#ffc8d4' }} aria-hidden="true">
                <span className="inbox-avatar-circle"><img src="/media/hero-profiles/5.png" alt="" /></span>
              </span>
              <span className="inbox-contact-info">
                <span className="inbox-contact-name">{t('dashboard.costlyfTeam')}</span>
                <span className="inbox-contact-subscription">{t('dashboard.notificationsAndUpdates')}</span>
              </span>
              {systemUnreadCount > 0 && <span className="inbox-contact-unread">{systemUnreadCount > 99 ? '99+' : systemUnreadCount}</span>}
              <span className="inbox-contact-chevron">›</span>
            </Link>
            {threads.map((t) => (
              <Link key={t.id} to={`/inbox#thread-${t.id}`} className="inbox-contact-card" onClick={() => setHashThreadId(t.id)}>
                <ContactAvatar thread={t} />
                <span className="inbox-contact-info">
                  <span className="inbox-contact-name">{t.other_name || 'User'}</span>
                  {t.subscription_label && <span className="inbox-contact-subscription">{t.subscription_label}</span>}
                </span>
                {t.unread_count > 0 && <span className="inbox-contact-unread">{t.unread_count > 99 ? '99+' : t.unread_count}</span>}
                <span className="inbox-contact-chevron">›</span>
              </Link>
            ))}
          </div>
          {threads.length === 0 && systemUnreadCount === 0 && (
            <p className="inbox-empty">{t('dashboard.noConversationsFull')}</p>
          )}
        </div>

        {/* Chat view: user thread */}
        {showChat && (
          <ChatView
            thread={currentThread}
            threadId={hashThreadId}
            isSystem={false}
            fetchWithAuth={fetchWithAuth}
            myUserId={user?.id}
            myAvatarUrl={profile?.avatar_url}
            onBack={() => { window.location.hash = ''; setHashThreadId(null); }}
            onThreadsRefresh={() => {
              fetchThreads()
              refreshUnreadCount()
            }}
          />
        )}

        {/* Chat view: system */}
        {showSystemChat && (
          <SystemChatView
            fetchWithAuth={fetchWithAuth}
            onBack={() => { window.location.hash = ''; setHashThreadId(null); }}
            onUnreadChange={(count) => { setSystemUnreadCount(count); refreshUnreadCount(); }}
          />
        )}
      </div>
    </main>
  )
}

function ContactAvatar({ thread }) {
  const avatarUrl = thread?.other_avatar_url?.trim()
  const heroIndex = getDefaultHeroIndex(thread?.other_name)
  const color = HERO_AVATAR_COLORS[heroIndex - 1] || HERO_AVATAR_COLORS[0]
  if (avatarUrl) {
    return (
      <span className="inbox-contact-avatar inbox-contact-avatar--img" aria-hidden="true">
        <img src={avatarUrl} alt="" />
      </span>
    )
  }
  return (
    <span className="inbox-contact-avatar inbox-contact-avatar--default" aria-hidden="true" style={{ '--circle-color': color }}>
      <span className="inbox-avatar-circle"><img src={`/media/hero-profiles/${heroIndex}.png`} alt="" /></span>
    </span>
  )
}

function ChatHeaderAvatar({ thread, isSystem }) {
  const avatarUrl = thread?.other_avatar_url?.trim()
  const heroIndex = isSystem ? 5 : getDefaultHeroIndex(thread?.other_name)
  const color = HERO_AVATAR_COLORS[heroIndex - 1] || HERO_AVATAR_COLORS[0]
  if (avatarUrl) {
    return (
      <span className="inbox-chat-header-avatar inbox-chat-header-avatar--img">
        <img src={avatarUrl} alt="" />
      </span>
    )
  }
  return (
    <span className="inbox-chat-header-avatar inbox-chat-header-avatar--default" style={{ '--circle-color': color }}>
      <span className="inbox-avatar-circle"><img src={`/media/hero-profiles/${heroIndex}.png`} alt="" /></span>
    </span>
  )
}

function ChatView({ thread, threadId, isSystem, fetchWithAuth, myUserId, myAvatarUrl, onBack, onThreadsRefresh }) {
  const { t } = useI18n()
  const [messages, setMessages] = useState([])
  const [offer, setOffer] = useState(null)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)

  const fetchMessages = useCallback(() => {
    fetchWithAuth(`/api/chat/threads/${encodeURIComponent(threadId)}/messages`, {})
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setMessages(Array.isArray(data) ? data : []))
      .catch(() => setMessages([]))
  }, [threadId, fetchWithAuth])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  useEffect(() => {
    const interval = setInterval(fetchMessages, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchMessages])

  useEffect(() => {
    if (!thread?.offer_id) {
      setOffer(null)
      return
    }
    fetchWithAuth(`/api/offers/${encodeURIComponent(thread.offer_id)}`, {})
      .then((r) => (r.ok ? r.json() : null))
      .then(setOffer)
      .catch(() => setOffer(null))
  }, [thread?.offer_id, fetchWithAuth])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = (overrideText) => {
    const text = (overrideText !== undefined ? overrideText : input).trim()
    if (!text) return
    if (overrideText !== undefined) setInput('')
    fetchWithAuth(`/api/chat/threads/${encodeURIComponent(threadId)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d.error || 'Send failed') })
        return r.json()
      })
      .then(() => {
        if (overrideText === undefined) setInput('')
        fetchMessages()
        onThreadsRefresh()
      })
      .catch((e) => alert(e.message || 'Could not send message'))
  }

  const CONFIRM_CREDENTIALS_TEXT = 'I confirm I received the credentials and everything is working.'
  const hasUserConfirmedCredentials = () =>
    messages.some((m) => m.sender_id && String(m.sender_id) === String(myUserId) && (m.content || '').indexOf('I confirm I received the credentials') !== -1)

  const slots = offer?.slots || []
  const myId = myUserId != null ? String(myUserId) : ''
  const otherId = thread?.other_user_id != null ? String(thread.other_user_id) : ''
  const ownerId = offer?.owner_id != null ? String(offer.owner_id) : ''
  const isOwner = ownerId && myId && ownerId === myId
  const reservedSlotForOther = slots.find((s) => s.status === 'reserved' && s.user_id && String(s.user_id) === otherId)
  const mySlot = slots.find((s) => (s.status === 'reserved' || s.status === 'taken') && s.user_id && String(s.user_id) === myId)
  const slotBelongsToMe = !!mySlot
  const alreadyConfirmed = hasUserConfirmedCredentials()

  const handleAccept = () => {
    if (!reservedSlotForOther || !offer) return
    fetchWithAuth(`/api/offers/${encodeURIComponent(offer.id)}/slots/${reservedSlotForOther.slot_index}/accept`, { method: 'POST' })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d.error) })
      })
      .then(() => {
        fetchWithAuth(`/api/offers/${encodeURIComponent(thread.offer_id)}`, {}).then((res) => (res.ok ? res.json() : null)).then(setOffer)
        fetchMessages()
        onThreadsRefresh()
      })
      .catch((e) => alert(e.message))
  }

  const handleDecline = () => {
    if (!reservedSlotForOther || !offer) return
    fetchWithAuth(`/api/offers/${encodeURIComponent(offer.id)}/slots/${reservedSlotForOther.slot_index}/decline`, { method: 'POST' })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d.error) })
      })
      .then(() => {
        fetchWithAuth(`/api/offers/${encodeURIComponent(thread.offer_id)}`, {}).then((res) => (res.ok ? res.json() : null)).then(setOffer)
        onThreadsRefresh()
      })
      .catch((e) => alert(e.message))
  }

  const handleConfirm = () => {
    const doPostMessage = () =>
      fetchWithAuth(`/api/chat/threads/${encodeURIComponent(threadId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: CONFIRM_CREDENTIALS_TEXT }),
      }).then((r) => r.ok && fetchMessages())
    if (offer && mySlot && mySlot.status === 'taken') {
      fetchWithAuth(`/api/offers/${encodeURIComponent(offer.id)}/slots/${mySlot.slot_index}/confirm-details`, { method: 'POST' })
        .then((r) => {
          if (!r.ok) return r.json().then((d) => { throw new Error(d.error || 'Could not confirm') })
        })
        .then(doPostMessage)
        .catch((e) => alert(e.message))
    } else {
      doPostMessage()
    }
  }

  const showAcceptDecline = isOwner && reservedSlotForOther
  const showConfirm = !isOwner && slotBelongsToMe && !alreadyConfirmed
  const slotTakenByOther = slots.some((s) => s.status === 'taken' && s.user_id && String(s.user_id) === otherId)
  const chatInputDisabled = (isOwner && reservedSlotForOther) || (slotBelongsToMe && mySlot?.status === 'reserved')
  const showHostWaitingTip = isOwner && slotTakenByOther && !alreadyConfirmed
  const showSubscriberConfirmTip = showConfirm

  return (
    <div className="inbox-chat-view">
      <Link to="/inbox" className="subscription-back" onClick={(e) => { e.preventDefault(); onBack(); }}>‹ {t('dashboard.backToInbox')}</Link>
      <div className="subscription-chat-wrap inbox-chat-wrap">
        <div className="subscription-chat-header">
          <ChatHeaderAvatar thread={thread} isSystem={false} />
          <div>
            <span className="subscription-chat-with">{t('dashboard.chatWith', { name: thread?.other_name || '—' })}</span>
            {thread?.subscription_label && <p className="inbox-chat-subscription" style={{ margin: 0, fontSize: '0.875rem', color: 'var(--dash-text-muted)' }}>{thread.subscription_label}</p>}
          </div>
        </div>
        <div className="subscription-chat-messages">
          {messages.length === 0 && <p className="subscription-chat-placeholder">{t('dashboard.noMessagesYet')}</p>}
          {messages.map((m) => {
            const isSystemMsg = m.is_system || m.sender_id == null
            if (isSystemMsg) {
              return (
                <div key={m.id || m.created_at} className="subscription-chat-msg subscription-chat-msg--system">
                  <div className="subscription-chat-msg-content"><span className="subscription-chat-msg-text">{m.content || ''}</span></div>
                </div>
              )
            }
            const isMe = m.sender_id === myUserId
            const cls = isMe ? 'subscription-chat-msg subscription-chat-msg--me' : 'subscription-chat-msg subscription-chat-msg--owner'
            return (
              <div key={m.id || m.created_at} className={cls}>
                <MsgAvatar avatarUrl={isMe ? myAvatarUrl : thread?.other_avatar_url} seed={isMe ? myUserId : thread?.other_name} />
                <div className="subscription-chat-msg-content">
                  <span className="subscription-chat-msg-text">{m.content || ''}</span>
                  <span className="subscription-chat-msg-meta">
                    <span className="subscription-chat-msg-time">{formatTime(m.created_at)}</span>
                    {isMe && <span className="subscription-chat-msg-checks" aria-hidden="true"><span className={`subscription-chat-msg-check ${m.read_at ? 'subscription-chat-msg-check--seen' : ''}`}>{m.read_at ? '✓✓' : '✓'}</span></span>}
                  </span>
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>
        {(showAcceptDecline || showConfirm) && (
          <div className="inbox-chat-actions">
            {showAcceptDecline && (
              <>
                <p className="inbox-chat-actions-hint">Accept or decline the join request below. Chat is available after you accept.</p>
                <div className="inbox-chat-actions-buttons">
                  <button type="button" className="inbox-chat-action-btn inbox-chat-action-btn--primary" onClick={handleAccept}>Accept</button>
                  <button type="button" className="inbox-chat-action-btn inbox-chat-action-btn--danger" onClick={handleDecline}>Decline</button>
                </div>
              </>
            )}
            {showConfirm && (
              <>
                <p className="inbox-chat-actions-hint">Confirm once you&apos;ve received access and everything works.</p>
                <div className="inbox-chat-actions-buttons">
                  <button type="button" className="inbox-chat-action-btn inbox-chat-action-btn--primary" onClick={handleConfirm}>I confirm</button>
                  <Link to="/help" className="inbox-chat-action-btn inbox-chat-action-btn--secondary">Support</Link>
                </div>
              </>
            )}
          </div>
        )}
        {showHostWaitingTip && (
          <p className="inbox-chat-actions-hint" style={{ marginTop: 0, marginBottom: '0.5rem' }}>Waiting for subscriber&apos;s confirmation. Share login details in the chat when ready.</p>
        )}
        {chatInputDisabled ? (
          <div className="inbox-chat-input-bar" style={{ opacity: 0.8, pointerEvents: 'none' }}>
            <p className="inbox-chat-actions-hint" style={{ margin: 0, padding: '0.5rem 0', textAlign: 'center' }}>
              {isOwner && reservedSlotForOther ? 'Accept or decline below. Chat unlocks after you accept.' : "You can't send messages until the host accepts your request."}
            </p>
          </div>
        ) : (
          <div className="subscription-chat-input-bar">
            <button type="button" className="subscription-chat-attach" aria-label="Attach"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg></button>
            <div className="subscription-chat-input-wrap">
              <input type="text" className="subscription-chat-input" placeholder="Type a message…" autoComplete="off" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), sendMessage())} />
              <button type="button" className={`subscription-chat-send ${input.trim() ? '' : 'subscription-chat-send--hidden'}`} aria-label="Send" onClick={sendMessage}><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none"><path d="m12.594 23.258l-.012.002l-.071.035l-.02.004l-.014-.004l-.071-.036q-.016-.004-.024.006l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.016-.018m.264-.113l-.014.002l-.184.093l-.01.01l-.003.011l.018.43l.005.012l.008.008l.201.092q.019.005.029-.008l.004-.014l-.034-.614q-.005-.019-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.003-.011l.018-.43l-.003-.012l-.01-.01z"/><path fill="currentColor" d="M20.235 5.686c.432-1.195-.726-2.353-1.921-1.92L3.709 9.048c-1.199.434-1.344 2.07-.241 2.709l4.662 2.699l4.163-4.163a1 1 0 0 1 1.414 1.414L9.544 15.87l2.7 4.662c.638 1.103 2.274.957 2.708-.241z"/></g></svg></button>
            </div>
            <button type="button" className="subscription-chat-emoji" aria-label="Send OK" onClick={() => sendMessage('👌')}>👌</button>
          </div>
        )}
      </div>
    </div>
  )
}

function MsgAvatar({ avatarUrl, seed }) {
  const heroIndex = getDefaultHeroIndex(seed)
  const color = HERO_AVATAR_COLORS[heroIndex - 1] || HERO_AVATAR_COLORS[0]
  if (avatarUrl?.trim()) {
    return (
      <span className="subscription-chat-msg-avatar subscription-chat-msg-avatar--img">
        <img src={avatarUrl} alt="" />
      </span>
    )
  }
  return (
    <span className="subscription-chat-msg-avatar subscription-chat-msg-avatar--default" style={{ '--circle-color': color }}>
      <span className="inbox-avatar-circle"><img src={`/media/hero-profiles/${heroIndex}.png`} alt="" /></span>
    </span>
  )
}

function SystemChatView({ fetchWithAuth, onBack, onUnreadChange }) {
  const { t } = useI18n()
  const [messages, setMessages] = useState([])
  const messagesEndRef = useRef(null)
  const didInitialLoad = useRef(false)

  const fetchMessages = useCallback((markRead = false) => {
    const qs = markRead ? '?mark_read=1' : ''
    fetchWithAuth(`/api/chat/system-messages${qs}`, {})
      .then((r) => (r.ok ? r.json() : { messages: [], unread_count: 0 }))
      .then((data) => {
        setMessages(data.messages || [])
        onUnreadChange(data.unread_count ?? 0)
      })
      .catch(() => setMessages([]))
  }, [fetchWithAuth, onUnreadChange])

  useEffect(() => {
    if (!didInitialLoad.current) {
      didInitialLoad.current = true
      fetchMessages(true)
    }
  }, [fetchMessages])

  useEffect(() => {
    const interval = setInterval(() => fetchMessages(false), POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="inbox-chat-view">
      <Link to="/inbox" className="subscription-back" onClick={(e) => { e.preventDefault(); onBack(); }}>‹ {t('dashboard.backToInbox')}</Link>
      <div className="subscription-chat-wrap inbox-chat-wrap">
        <div className="subscription-chat-header">
          <ChatHeaderAvatar thread={{ other_name: t('dashboard.costlyfTeam') }} isSystem />
          <div>
            <span className="subscription-chat-with">{t('dashboard.chatWith', { name: t('dashboard.costlyfTeam') })}</span>
          </div>
        </div>
        <div className="subscription-chat-messages">
          {messages.length === 0 && <p className="subscription-chat-placeholder">{t('dashboard.noSystemMessagesYet')}</p>}
          {messages.map((m) => (
            <div key={m.id || m.created_at} className="subscription-chat-msg subscription-chat-msg--system">
              <div className="subscription-chat-msg-content"><span className="subscription-chat-msg-text">{m.content || ''}</span></div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="subscription-chat-input-bar inbox-chat-input-bar--locked">
          <div className="subscription-chat-input-wrap">
            <input type="text" className="subscription-chat-input" placeholder={t('dashboard.cannotReplyToSystem')} disabled />
          </div>
        </div>
      </div>
    </div>
  )
}
