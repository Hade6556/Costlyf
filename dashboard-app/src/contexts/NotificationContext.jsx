import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'

const AUTO_DISMISS_MS = 3000

const NotificationContext = createContext(null)

export function useNotification() {
  const ctx = useContext(NotificationContext)
  return ctx || { showNotification: () => {}, hideNotification: () => {} }
}

export function NotificationProvider({ children }) {
  const [notification, setNotification] = useState(null)
  const dismissTimerRef = useRef(null)

  const hideNotification = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = null
    }
    setNotification(null)
  }, [])

  const showNotification = useCallback(({ title = 'Notification', message, type = 'error' }) => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = null
    }
    setNotification({ title, message, type })
  }, [])

  useEffect(() => {
    if (!notification) return
    dismissTimerRef.current = setTimeout(() => {
      dismissTimerRef.current = null
      setNotification(null)
    }, AUTO_DISMISS_MS)
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current)
        dismissTimerRef.current = null
      }
    }
  }, [notification])

  const value = { showNotification, hideNotification }

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {notification && (
        <div className="app-notification" role="alert">
          <div className={`app-notification__bar app-notification__bar--${notification.type}`} aria-hidden="true" />
          <div className="app-notification__content">
            <span className={`app-notification__icon app-notification__icon--${notification.type}`} aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </span>
            <div className="app-notification__text">
              <p className="app-notification__title">{notification.title}</p>
              <p className="app-notification__message">{notification.message}</p>
            </div>
          </div>
          <button
            type="button"
            className="app-notification__close"
            aria-label="Close"
            onClick={hideNotification}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </NotificationContext.Provider>
  )
}
