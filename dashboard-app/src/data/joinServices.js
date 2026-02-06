import { CATEGORIES, SERVICES, getServiceBySlug } from './services'

// Re-export for consumers that need raw service info (max seats, plans, etc.)
export { SERVICES, getServiceBySlug, formatSeatPrice } from './services'

// Categories for Join page (from single source)
export const JOIN_CATEGORIES = CATEGORIES

// Join list: one row per service (slug, name, price string, logo, category)
export const JOIN_SERVICES = SERVICES.map((s) => ({
  slug: s.slug,
  name: s.name,
  price: String(s.seatPriceEur),
  logo: s.logo,
  category: s.category,
  seatPriceDisplay: s.seatPriceDisplay,
  maxSeats: s.maxSeats,
  maxSeatsNumeric: s.maxSeatsNumeric,
  plans: s.plans,
}))

// Service meta for detail page (join/:service): name + description
export const SERVICE_META = Object.fromEntries(
  SERVICES.filter((s) => s.description).map((s) => [s.slug, { name: s.name, description: s.description }])
)

export function getServiceMeta(slug) {
  const s = getServiceBySlug(slug)
  if (s) {
    return {
      name: s.name,
      description: s.description || 'Find co-subscribers and save on your subscription.',
      seatPriceDisplay: s.seatPriceDisplay,
      maxSeats: s.maxSeats,
      maxSeatsNumeric: s.maxSeatsNumeric,
      plans: s.plans,
    }
  }
  const name = (slug && String(slug).toLowerCase().replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())) || 'Service'
  return { name, description: 'Find co-subscribers and save on your subscription.' }
}
