const TOKEN_KEY = 'costlyf_access_token'
const REFRESH_KEY = 'costlyf_refresh_token'

function refreshToken() {
  const refresh = typeof localStorage !== 'undefined' ? localStorage.getItem(REFRESH_KEY) : null
  if (!refresh) return Promise.resolve(null)
  return fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  })
    .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
    .then((result) => {
      if (result.ok && result.data.access_token) {
        localStorage.setItem(TOKEN_KEY, result.data.access_token)
        if (result.data.refresh_token) localStorage.setItem(REFRESH_KEY, result.data.refresh_token)
        return result.data.access_token
      }
      return null
    })
    .catch(() => null)
}

export function getToken() {
  return typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null
}

export function setSession(accessToken, refresh) {
  if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken)
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

export function isLoggedIn() {
  return !!(typeof localStorage !== 'undefined' && (localStorage.getItem(TOKEN_KEY) || localStorage.getItem(REFRESH_KEY)))
}

export function fetchWithAuth(url, options = {}) {
  const headers = { ...options.headers }
  const token = getToken()
  if (token) headers.Authorization = 'Bearer ' + token
  const opts = { ...options, headers }
  return fetch(url, opts).then((response) => {
    if (response.status === 401 && getToken()) {
      return refreshToken().then((newToken) => {
        if (newToken) {
          const next = { ...options, headers: { ...options.headers, Authorization: 'Bearer ' + newToken } }
          return fetch(url, next)
        }
        return response
      })
    }
    return response
  })
}
