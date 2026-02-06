'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/navigation';

const LOCALE_NAMES: Record<string, string> = {
  en: 'English',
  lt: 'Lietuvių',
  lv: 'Latviešu',
  pl: 'Polski',
  es: 'Español',
  de: 'Deutsch',
};

const LOCALES = ['en', 'lt', 'lv', 'pl', 'es', 'de'];
const COOKIE_NAME = 'NEXT_LOCALE';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function setLocaleCookie(locale: string) {
  document.cookie = `${COOKIE_NAME}=${locale}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export default function LanguageSelector() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(newLocale: string) {
    setLocaleCookie(newLocale);
    router.replace(pathname, { locale: newLocale });
  }

  return (
    <select
      value={locale}
      onChange={(e) => handleChange(e.target.value)}
      aria-label="Select language"
      style={{
        padding: '0.4rem 0.75rem',
        fontSize: '1rem',
        borderRadius: '6px',
        border: '1px solid #ccc',
      }}
    >
      {LOCALES.map((loc) => (
        <option key={loc} value={loc}>
          {LOCALE_NAMES[loc]}
        </option>
      ))}
    </select>
  );
}
