import { defineRouting } from 'next-intl/routing';

export const locales = ['en', 'lt', 'lv', 'pl', 'es', 'de'] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales: [...locales],
  defaultLocale: 'en',
  localePrefix: 'always',
  localeCookie: {
    name: 'NEXT_LOCALE',
    maxAge: 60 * 60 * 24 * 365,
  },
});
