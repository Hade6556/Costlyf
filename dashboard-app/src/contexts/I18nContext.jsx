import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const DEFAULT_LOCALE = 'en'

function get(obj, key) {
  if (!key) return undefined
  const parts = String(key).split('.')
  for (let i = 0; i < parts.length; i++) {
    if (obj == null) return undefined
    obj = obj[parts[i]]
  }
  return obj
}

const I18nContext = createContext(null)

export function useI18n() {
  const ctx = useContext(I18nContext)
  return ctx || {
    locale: DEFAULT_LOCALE,
    t: (k) => k,
    setLocale: () => {},
    LOCALES: ['en'],
    LOCALE_NAMES: { en: 'English' },
  }
}

export function I18nProvider({ children }) {
  const [messages, setMessages] = useState({})

  useEffect(() => {
    fetch('/messages/en.json')
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => setMessages(data))
      .catch(() => setMessages({}))
  }, [])

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

  const value = {
    locale: DEFAULT_LOCALE,
    t,
    setLocale: () => {},
    LOCALES: ['en'],
    LOCALE_NAMES: { en: 'English' },
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
