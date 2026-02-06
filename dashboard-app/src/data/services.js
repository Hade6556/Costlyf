/**
 * Single source of truth for all services: prices, max seats, plans, categories.
 * Used by Join, Share, and service detail pages across the app.
 */

// Category id must match usage in join (category) and share (cat)
export const CATEGORIES = [
  { id: 'movies', label: 'Movies & Series', emoji: '🎬' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'security', label: 'VPN / Security', emoji: '🔐' },
  { id: 'productivity', label: 'Productivity / AI', emoji: '💻' },
  { id: 'education', label: 'Delivery / News / Education', emoji: '🛍' },
  { id: 'cloud', label: 'Cloud Storage', emoji: '☁️' },
]

/**
 * @typedef {Object} ServiceInfo
 * @property {string} slug - URL/key (e.g. 'netflix', 'youtube-premium')
 * @property {string} name - Display name
 * @property {string} category - Category id
 * @property {number} seatPriceEur - Approx seat price in EUR (for sort/display)
 * @property {string} seatPriceDisplay - e.g. "~4.1 €/month" or "~4–6 €/month"
 * @property {string|number} maxSeats - e.g. "4", "2–4", "6 (Family)"
 * @property {number} [maxSeatsNumeric] - Optional numeric cap for validation
 * @property {string[]} plans - Plan names
 * @property {{ name: string, description?: string, planPriceEur: number, maxSeatsNumeric: number, seatPriceEur?: number, amountToOwnerEur?: number, operatingFeeEur?: number }[]} [planOptions] - Per-plan details (seatPriceEur = what subscriber pays; amountToOwnerEur/operatingFeeEur = price breakdown)
 * @property {number} [planPriceEur] - Total monthly plan price in EUR (for share flow; if missing, seatPriceEur * maxSeatsNumeric)
 * @property {string} [description] - Short description for service page
 * @property {string} logo - Filename in /media/brand-logos/
 * @property {string} [dot] - Share list dot color (red, blue, green, etc.)
 */

export const SERVICES = [
  // 🎬 Movies & Series
  {
    slug: 'netflix',
    name: 'Netflix',
    category: 'movies',
    seatPriceEur: 4.1,
    seatPriceDisplay: '~4.1 €/month',
    maxSeats: 'Standard → 2 users, Premium → 4 users',
    maxSeatsNumeric: 4,
    plans: ['Basic (no sharing)', 'Standard', 'Premium'],
    planOptions: [
      { name: 'Standard', description: 'Watch Netflix on 2 screens at once. HD available.', planPriceEur: 9.99, maxSeatsNumeric: 2, seatPriceEur: 6.24, amountToOwnerEur: 5, operatingFeeEur: 1.24 },
      { name: 'Premium', description: 'Watch Netflix on 4 screens at once. HD and Ultra HD available.', planPriceEur: 11.99, maxSeatsNumeric: 4, seatPriceEur: 4.1, amountToOwnerEur: 3, operatingFeeEur: 1.1 },
    ],
    description: 'Watch Netflix films & TV series online or stream right to your smart TV, game console, PC, Mac, mobile, tablet and more.',
    logo: 'netflix.svg',
    dot: 'black',
  },
  {
    slug: 'disney',
    name: 'Disney+',
    category: 'movies',
    seatPriceEur: 4.0,
    seatPriceDisplay: '~4.0 €/month',
    maxSeats: '4–7 profiles (varies by region)',
    maxSeatsNumeric: 7,
    plans: ['Standard', 'Premium'],
    description: 'Stream Disney, Pixar, Marvel, Star Wars and National Geographic. One subscription for your whole family.',
    logo: 'disney.svg',
    dot: 'blue',
  },
  {
    slug: 'hbo-max',
    name: 'HBO Max',
    category: 'movies',
    seatPriceEur: 3.6,
    seatPriceDisplay: '~3.6 €/month',
    maxSeats: 'Standard → 2 users, Premium → 4 users',
    maxSeatsNumeric: 4,
    plans: ['With Ads', 'Standard', 'Premium'],
    logo: 'hbo-max.svg',
    dot: 'dark',
  },
  {
    slug: 'apple-tv',
    name: 'Apple TV+',
    category: 'movies',
    seatPriceEur: 2.7,
    seatPriceDisplay: '~2.7 €/month',
    maxSeats: '6 via Family Sharing',
    maxSeatsNumeric: 6,
    plans: ['Single plan'],
    logo: 'apple-tv.svg',
    dot: 'grey',
  },
  {
    slug: 'hulu',
    name: 'Hulu',
    category: 'movies',
    seatPriceEur: 5,
    seatPriceDisplay: '~4–6 €/month',
    maxSeats: '2 (base), unlimited with add-on',
    maxSeatsNumeric: 2,
    plans: ['With Ads', 'No Ads'],
    logo: 'hulu.svg',
    dot: 'green',
  },
  {
    slug: 'prime-video',
    name: 'Prime Video',
    category: 'movies',
    seatPriceEur: 3.1,
    seatPriceDisplay: '~3.1 €/month',
    maxSeats: '3 simultaneous streams',
    maxSeatsNumeric: 3,
    plans: ['Included with Amazon Prime'],
    description: 'Watch movies and TV series with Prime Video. Included with Prime or standalone.',
    logo: 'prime-video.svg',
    dot: 'blue',
  },
  {
    slug: 'viaplay',
    name: 'Viaplay',
    category: 'movies',
    seatPriceEur: 5,
    seatPriceDisplay: '~4–6 €/month',
    maxSeats: '2–4 (plan dependent)',
    maxSeatsNumeric: 4,
    plans: ['Standard', 'Total'],
    logo: 'viaplay.svg',
    dot: 'red',
  },
  // 🎵 Music
  {
    slug: 'spotify',
    name: 'Spotify',
    category: 'music',
    seatPriceEur: 3.6,
    seatPriceDisplay: '~3.6 €/month',
    maxSeats: '6 (Family)',
    maxSeatsNumeric: 6,
    plans: ['Individual', 'Duo', 'Family'],
    description: 'Listen to millions of songs, podcasts, and playlists with Spotify. Stream anywhere, anytime.',
    logo: 'spotify.svg',
    dot: 'green',
  },
  {
    slug: 'apple-music',
    name: 'Apple Music',
    category: 'music',
    seatPriceEur: 3.7,
    seatPriceDisplay: '~3.7 €/month',
    maxSeats: '6 (Family)',
    maxSeatsNumeric: 6,
    plans: ['Individual', 'Family'],
    logo: 'apple-music.svg',
    dot: 'red',
  },
  {
    slug: 'youtube-premium',
    name: 'YouTube Premium',
    category: 'music',
    seatPriceEur: 4.5,
    seatPriceDisplay: '~4.5 €/month',
    maxSeats: '5–6 (Family)',
    maxSeatsNumeric: 6,
    plans: ['Individual', 'Family'],
    planPriceEur: 19.99,
    description: 'Enjoy ad-free videos, background play, and YouTube Music with a Premium membership.',
    logo: 'youtube.svg',
    dot: 'red',
  },
  {
    slug: 'deezer',
    name: 'Deezer',
    category: 'music',
    seatPriceEur: 4.2,
    seatPriceDisplay: '~4.2 €/month',
    maxSeats: '6 (Family)',
    maxSeatsNumeric: 6,
    plans: ['Premium', 'Family'],
    logo: 'deezer.svg',
    dot: 'orange',
  },
  // 🔐 VPN / Security
  {
    slug: 'nordvpn',
    name: 'NordVPN',
    category: 'security',
    seatPriceEur: 3.0,
    seatPriceDisplay: '~3.0 €/month',
    maxSeats: '6 devices',
    maxSeatsNumeric: 6,
    plans: ['Basic', 'Plus', 'Ultimate'],
    logo: 'nordvpn.svg',
    dot: 'blue',
  },
  {
    slug: 'purevpn',
    name: 'PureVPN',
    category: 'security',
    seatPriceEur: 1.4,
    seatPriceDisplay: '~1.4 €/month',
    maxSeats: '10 devices',
    maxSeatsNumeric: 10,
    plans: ['Standard', 'Plus'],
    logo: 'purevpn.png',
    dot: 'blue',
  },
  {
    slug: 'mozilla-vpn',
    name: 'Mozilla VPN',
    category: 'security',
    seatPriceEur: 2.0,
    seatPriceDisplay: '~2.0 €/month',
    maxSeats: '5 devices',
    maxSeatsNumeric: 5,
    plans: ['Single plan'],
    logo: 'mozilla-vpn.svg',
    dot: 'orange',
  },
  {
    slug: 'bitdefender',
    name: 'Bitdefender',
    category: 'security',
    seatPriceEur: 1.6,
    seatPriceDisplay: '~1.6 €/month',
    maxSeats: '5–10 devices',
    maxSeatsNumeric: 10,
    plans: ['Antivirus Plus', 'Internet Security', 'Total Security'],
    logo: 'bitdefender.svg',
    dot: 'green',
  },
  // 💻 Productivity / AI
  {
    slug: 'snapchat',
    name: 'Snapchat+',
    category: 'productivity',
    seatPriceEur: 3.1,
    seatPriceDisplay: '~3.1 €/month',
    maxSeats: '1 (no family)',
    maxSeatsNumeric: 1,
    plans: ['Single'],
    logo: 'snapchat.svg',
    dot: 'yellow',
  },
  {
    slug: 'gemini',
    name: 'Gemini',
    category: 'productivity',
    seatPriceEur: 1.8,
    seatPriceDisplay: '~1.8 €/month',
    maxSeats: '1',
    maxSeatsNumeric: 1,
    plans: ['Gemini Advanced (via Google One AI)'],
    logo: 'gemini.svg',
    dot: 'blue',
  },
  {
    slug: 'office365',
    name: 'Microsoft 365',
    category: 'productivity',
    seatPriceEur: 2.9,
    seatPriceDisplay: '~2.9 €/month',
    maxSeats: '6 (Family)',
    maxSeatsNumeric: 6,
    plans: ['Personal', 'Family'],
    logo: 'office365.svg',
    dot: 'blue',
  },
  // 🛍 Delivery / News / Education
  {
    slug: 'uber',
    name: 'Uber One',
    category: 'education',
    seatPriceEur: 3.6,
    seatPriceDisplay: '~3.6 €/month',
    maxSeats: '1 (some regions allow household)',
    maxSeatsNumeric: 1,
    plans: ['Single'],
    logo: 'uber.svg',
    dot: 'black',
  },
  {
    slug: 'delfi',
    name: 'Delfi',
    category: 'education',
    seatPriceEur: 2.1,
    seatPriceDisplay: '~2.1 €/month',
    maxSeats: '1',
    maxSeatsNumeric: 1,
    plans: ['Premium'],
    logo: 'delfi.svg',
    dot: 'blue',
  },
  {
    slug: 'duolingo',
    name: 'Duolingo',
    category: 'education',
    seatPriceEur: 2.8,
    seatPriceDisplay: '~2.8 €/month',
    maxSeats: '6 (Family)',
    maxSeatsNumeric: 6,
    plans: ['Super', 'Family'],
    logo: 'duolingo.svg',
    dot: 'green',
  },
  // ☁️ Cloud Storage
  {
    slug: 'dropbox',
    name: 'Dropbox',
    category: 'cloud',
    seatPriceEur: 4.0,
    seatPriceDisplay: '~4.0 €/month',
    maxSeats: '6 (Family)',
    maxSeatsNumeric: 6,
    plans: ['Plus', 'Family'],
    logo: 'dropbox.svg',
    dot: 'blue',
  },
  {
    slug: 'apple-one',
    name: 'Apple One',
    category: 'cloud',
    seatPriceEur: 4.5,
    seatPriceDisplay: '~4.5 €/month',
    maxSeats: '6',
    maxSeatsNumeric: 6,
    plans: ['Individual', 'Family', 'Premier'],
    logo: 'apple-one.svg',
    dot: 'grey',
  },
  {
    slug: 'google-one',
    name: 'Google One',
    category: 'cloud',
    seatPriceEur: 2.5,
    seatPriceDisplay: '~2.5 €/month',
    maxSeats: '5',
    maxSeatsNumeric: 5,
    plans: ['Basic', 'Standard', 'Premium'],
    logo: 'google-one.svg',
    dot: 'red',
  },
  {
    slug: 'icloud',
    name: 'iCloud',
    category: 'cloud',
    seatPriceEur: 1.5,
    seatPriceDisplay: '~1.5 €/month',
    maxSeats: '6 (Family Sharing)',
    maxSeatsNumeric: 6,
    plans: ['50GB', '200GB', '2TB+'],
    logo: 'icloud.svg',
    dot: 'grey',
  },
]

/** Get service by slug (case-insensitive). */
export function getServiceBySlug(slug) {
  const s = slug && String(slug).toLowerCase().trim()
  return SERVICES.find((svc) => svc.slug === s) || null
}

/** Get all services in a category. */
export function getServicesByCategory(categoryId) {
  return SERVICES.filter((s) => s.category === categoryId)
}

/** Format seat price for display (fallback if seatPriceDisplay missing). */
export function formatSeatPrice(service) {
  return service.seatPriceDisplay || `~${service.seatPriceEur} €/month`
}

/** Total monthly plan price for share flow (used when creating an offer). */
export function getPlanPriceTotal(service) {
  if (service.planPriceEur != null) return Number(service.planPriceEur)
  const max = service.maxSeatsNumeric ?? 6
  return Math.round((service.seatPriceEur * max) * 100) / 100
}

/** Default ratio (Premium): 3 to owner, 1.1 fee per 4.1 seat price. */
const DEFAULT_OWNER_RATIO = 3 / 4.1
const DEFAULT_FEE_RATIO = 1.1 / 4.1

/**
 * Get price breakdown (amount to owner, operating fee) for the join modal and elsewhere.
 * @param {string} [serviceSlug] - e.g. 'netflix'
 * @param {string} [planName] - e.g. 'Standard', 'Premium'
 * @param {number} seatPriceEur - What the subscriber pays per month (offer.contribution_per_month)
 * @returns {{ amountToOwner: number, operatingFee: number }}
 */
export function getPriceBreakdown(serviceSlug, planName, seatPriceEur) {
  const total = Number(seatPriceEur) || 0
  if (total <= 0) return { amountToOwner: 0, operatingFee: 0 }
  const service = serviceSlug ? getServiceBySlug(serviceSlug) : null
  const plan = (planName || '').trim().toLowerCase()
  if (service?.planOptions?.length && plan) {
    const option = service.planOptions.find(
      (o) => o.name.trim().toLowerCase() === plan
    )
    if (option && option.amountToOwnerEur != null && option.operatingFeeEur != null) {
      return {
        amountToOwner: Number(option.amountToOwnerEur),
        operatingFee: Number(option.operatingFeeEur),
      }
    }
  }
  return {
    amountToOwner: Math.round(total * DEFAULT_OWNER_RATIO * 100) / 100,
    operatingFee: Math.round(total * DEFAULT_FEE_RATIO * 100) / 100,
  }
}
