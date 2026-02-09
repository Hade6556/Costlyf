import { useState, useRef, useEffect } from 'react'
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../contexts/I18nContext'
import { JoinOfferModal } from './JoinService'
import { JOIN_CATEGORIES, JOIN_SERVICES } from '../data/joinServices'

function ServiceCard({ service, t }) {
  return (
    <Link to={`/join/${service.slug}`} className="service-card">
      <div className="service-card-logo">
        <img src={`/media/brand-logos/${service.logo}`} alt={service.name} />
      </div>
      <p className="service-card-name">{service.name}</p>
      <p className="service-card-from">{t('dashboard.from')}</p>
      <p className="service-card-price">
        <span className="service-card-amount">{(Number(service.price) || 0).toFixed(2)}€</span>
        <span className="service-card-period">{t('dashboard.perMonth')}</span>
      </p>
    </Link>
  )
}

const REPEAT = 9
const CARD_WIDTH_PX = 200
const CARD_GAP_PX = 12

function Carousel({ children }) {
  const scrollRef = useRef(null)
  const innerRef = useRef(null)
  const childArray = Array.isArray(children) ? children : [children]
  const total = childArray.length
  const repeated = Array(REPEAT).fill(null).flatMap(() => childArray)
  const singleBlockWidth = total * (CARD_WIDTH_PX + CARD_GAP_PX) - CARD_GAP_PX
  const startScroll = singleBlockWidth * Math.floor(REPEAT / 2)

  useEffect(() => {
    const el = scrollRef.current
    const inner = innerRef.current
    if (!el || !inner) return
    const run = () => {
      const spacer = inner.firstElementChild
      const spacerWidth = spacer ? spacer.offsetWidth : 0
      const viewportWidth = el.clientWidth
      const firstCardOfBlockLeft = spacerWidth + startScroll
      el.scrollLeft = firstCardOfBlockLeft - viewportWidth / 2 + CARD_WIDTH_PX / 2
    }
    requestAnimationFrame(run)
  }, [startScroll])

  const scrollBy = (delta) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: delta, behavior: 'smooth' })
  }

  const step = CARD_WIDTH_PX + CARD_GAP_PX

  return (
    <div className="card-carousel card-carousel--centered">
      <button type="button" className="carousel-btn carousel-btn--prev" aria-label="Previous" onClick={() => scrollBy(-step)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <div className="card-scroll card-scroll--centered" ref={scrollRef}>
        <div className="card-scroll-inner" ref={innerRef}>
          <div className="card-scroll-spacer" aria-hidden="true" />
          {repeated.map((child, i) => (
            <div key={i} className="card-scroll-item">
              {child}
            </div>
          ))}
          <div className="card-scroll-spacer" aria-hidden="true" />
        </div>
      </div>
      <button type="button" className="carousel-btn carousel-btn--next" aria-label="Next" onClick={() => scrollBy(step)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
      </button>
    </div>
  )
}

export default function Join() {
  const { t } = useI18n()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, fetchWithAuth, loading: authLoading } = useAuth()
  const offerIdFromUrl = searchParams.get('offer')
  const tokenFromUrl = searchParams.get('token')
  const [offerForModal, setOfferForModal] = useState(null)
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!offerIdFromUrl) return
    if (authLoading) return
    if (!user) {
      const redirect = `${location.pathname}${location.search}`
      navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true })
      return
    }
    const qs = tokenFromUrl ? `?token=${encodeURIComponent(tokenFromUrl)}` : ''
    fetchWithAuth(`/api/offers/${encodeURIComponent(offerIdFromUrl)}${qs}`, {})
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return
        const available = (data.slots || []).filter((s) => s.status === 'available')
        if (available.length > 0) setOfferForModal(data)
      })
      .catch(() => {})
  }, [offerIdFromUrl, tokenFromUrl, user, authLoading, location.pathname, location.search, navigate, fetchWithAuth])

  const query = searchQuery.trim().toLowerCase()

  const servicesByCategory = JOIN_CATEGORIES.map((cat) => {
    const services = JOIN_SERVICES.filter(
      (s) => s.category === cat.id && (!query || s.name.toLowerCase().includes(query))
    )
    return { ...cat, services }
  })

  const visibleSections = servicesByCategory.filter((cat) => {
    if (cat.services.length === 0) return false
    return filter === 'all' || cat.id === filter
  })

  return (
    <>
      {offerForModal && (
        <JoinOfferModal
          offer={offerForModal}
          serviceName={offerForModal.service_name || offerForModal.service || 'Offer'}
          serviceSlug={offerForModal.service || 'netflix'}
          onClose={() => setOfferForModal(null)}
          onSuccess={(offerId) => {
            setOfferForModal(null)
            navigate(`/offer?id=${encodeURIComponent(offerId)}`)
          }}
          fetchWithAuth={fetchWithAuth}
        />
      )}
      <header className="dashboard-header">
        <div className="search-wrap">
          <span className="search-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          </span>
          <input
            type="search"
            className="search-input"
            placeholder={t('dashboard.searchPlaceholder')}
            aria-label={t('dashboard.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <nav className="filter-nav">
          <button
            type="button"
            className={`filter-pill ${filter === 'all' ? 'filter-pill--active' : ''}`}
            onClick={() => setFilter('all')}
            data-filter="all"
          >
            {t('dashboard.all')}
          </button>
          {JOIN_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`filter-pill ${filter === cat.id ? 'filter-pill--active' : ''}`}
              onClick={() => setFilter(cat.id)}
              data-filter={cat.id}
            >
              {t('dashboard.cat_' + cat.id)}
            </button>
          ))}
        </nav>
      </header>

      <main className="dashboard-main">
        {visibleSections.map((section) => (
          <section
            key={section.id}
            className="category-section"
            data-category={section.id}
          >
            <div className="category-head">
              <h2 className="category-title">
                <span className="category-emoji">{section.emoji}</span> {t('dashboard.cat_' + section.id)}
              </h2>
            </div>
            <Carousel t={t}>
              {section.services.map((service) => (
                <ServiceCard key={`${service.slug}-${service.category}`} service={service} t={t} />
              ))}
            </Carousel>
          </section>
        ))}
        {visibleSections.length === 0 && (
          <p className="dash-muted" style={{ padding: '1rem' }}>{t('dashboard.noServicesMatch')}</p>
        )}
      </main>
    </>
  )
}
