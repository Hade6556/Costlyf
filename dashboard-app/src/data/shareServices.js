import { CATEGORIES, SERVICES } from './services'

// Share categories: Popular + same categories as Join (from single source)
export const SHARE_CATEGORIES = [
  { id: 'popular', label: 'Popular' },
  ...CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
]

// Share service list: id (slug), name, cat, dot (from single source)
export const SHARE_SERVICES = SERVICES.map((s) => ({
  id: s.slug,
  name: s.name,
  cat: s.category,
  dot: s.dot || 'blue',
}))
