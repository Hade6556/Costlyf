# Next.js app with next-intl (i18n)

## Setup

```bash
cd next-app
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to `/<locale>` (e.g. `/en`) based on:

1. **NEXT_LOCALE** cookie (if set and valid)
2. **Accept-Language** header (best match)
3. Fallback **en**

## Locales

- **en** – English  
- **lt** – Lietuvių (Lithuanian)  
- **lv** – Latviešu (Latvian)  
- **pl** – Polski (Polish)  
- **es** – Español (Spanish)  
- **de** – Deutsch (German)

## Usage

- **Translations:** Use `useTranslations('namespace')` in client components and `getTranslations('namespace')` in server components. Example: `t('home.title')`.
- **Locale-aware navigation:** Use `Link`, `useRouter`, `usePathname` from `@/navigation` so routes keep the locale prefix.
- **Language selector:** The header includes `<LanguageSelector />`; it sets the `NEXT_LOCALE` cookie and navigates to the same path with the selected locale.

## Files

- `i18n/routing.ts` – Locales and routing config (cookie name, prefix, etc.)
- `i18n/request.ts` – Per-request config (messages, timeZone)
- `middleware.ts` – Redirects `/` to `/<detected-locale>`, then next-intl middleware
- `messages/*.json` – Translation keys per locale
- `app/[locale]/layout.tsx` – Wraps app with `NextIntlClientProvider`
- `components/LanguageSelector.tsx` – Dropdown to change locale (cookie + navigate)
