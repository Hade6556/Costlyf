import { useState } from 'react'

/**
 * Renders a chat image from [img]url content.
 * - Resolves relative URLs (e.g. /uploads/chat/...) to absolute so they work after refresh.
 * - On load error, shows a placeholder instead of broken image / "Attached" alt text.
 */
export function ChatImage({ url, alt = 'Attached', className, style, loading = 'lazy' }) {
  const [failed, setFailed] = useState(false)
  const resolved =
    typeof window !== 'undefined' && url && String(url).trim().startsWith('/')
      ? window.location.origin + url
      : (url || '').trim()
  if (failed || !resolved) {
    return (
      <span className={className} style={{ ...style, display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#666', fontSize: '0.9rem' }}>
        <span style={{ opacity: 0.7 }} aria-hidden>🖼</span>
        Image
      </span>
    )
  }
  return (
    <img
      src={resolved}
      alt={alt}
      loading={loading}
      onError={() => setFailed(true)}
      className={className}
      style={style}
    />
  )
}
