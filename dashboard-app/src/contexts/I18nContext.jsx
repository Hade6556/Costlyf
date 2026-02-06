import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const LOCALES = ['en', 'lt', 'lv', 'pl', 'es', 'de']
const LOCALE_NAMES = {
  en: 'English',
  lt: 'Lietuvių',
  lv: 'Latviešu',
  pl: 'Polski',
  es: 'Español',
  de: 'Deutsch',
}
const DEFAULT_LOCALE = 'en'
const COOKIE_NAME = 'NEXT_LOCALE'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function get(obj, key) {
  if (!key) return undefined
  const parts = String(key).split('.')
  for (let i = 0; i < parts.length; i++) {
    if (obj == null) return undefined
    obj = obj[parts[i]]
  }
  return obj
}

function setLocaleCookie(locale) {
  document.cookie = COOKIE_NAME + '=' + encodeURIComponent(locale) + '; path=/; max-age=' + COOKIE_MAX_AGE + '; SameSite=Lax'
}

const I18nContext = createContext(null)

export function useI18n() {
  const ctx = useContext(I18nContext)
  return ctx || {
    locale: DEFAULT_LOCALE,
    t: (k) => k,
    setLocale: () => {},
    LOCALES,
    LOCALE_NAMES,
    setLocaleCookie,
  }
}

// Get locale from the real browser path (e.g. /lt/profile -> lt). Router's location.pathname is relative to basename so it would be /profile.
function getLocaleFromWindow() {
  const path = typeof window !== 'undefined' ? window.location.pathname || '/' : '/'
  const segments = path.replace(/^\/+|\/+$/g, '').split('/')
  const first = segments[0]
  return first && LOCALES.includes(first) ? first : null
}

export function I18nProvider({ children }) {
  const localeFromPath = getLocaleFromWindow()
  const [locale, setLocaleState] = useState(localeFromPath || DEFAULT_LOCALE)
  const [messages, setMessages] = useState({})

  const effectiveLocale = localeFromPath || locale

  useEffect(() => {
    const loc = effectiveLocale || DEFAULT_LOCALE
    fetch('/messages/' + encodeURIComponent(loc) + '.json')
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => setMessages(data))
      .catch(() => setMessages({}))
  }, [effectiveLocale])

  const t = useCallback(
    (key, params) => {
      let value = get(messages, key)
      if (value == null) return key
      value = String(value)
      if (params && typeof params === 'object') {
        Object.keys(params).forEach((p) => {
          value = value.replace(new RegExp('\\{' + p + '\\}', 'g'), String(params[p]))
        })
      }
      return value
    },
    [messages]
  )

  const setLocale = useCallback((newLocale) => {
    if (!LOCALES.includes(newLocale)) return
    setLocaleCookie(newLocale)
    setLocaleState(newLocale)
    const path = typeof window !== 'undefined' ? window.location.pathname || '/' : '/'
    const segments = path.replace(/^\/+|\/+$/g, '').split('/')
    const rest = segments.slice(1).join('/') || ''
    const newPath = '/' + newLocale + (rest ? '/' + rest : '')
    window.location.href = newPath + (window.location.search || '') + (window.location.hash || '')
  }, [])

  const value = {
    locale: effectiveLocale,
    t,
    setLocale,
    LOCALES,
    LOCALE_NAMES,
    setLocaleCookie,
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
