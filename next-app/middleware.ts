import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const LOCALES = routing.locales;
const DEFAULT_LOCALE = routing.defaultLocale;
const LOCALE_COOKIE = routing.localeCookie?.name ?? 'NEXT_LOCALE';

function getBestLocaleFromAcceptLanguage(acceptLanguage: string | null): string {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const parts = acceptLanguage.split(',').map((p) => {
    const [code, q = 'q=1'] = p.trim().split(';');
    const quality = q.startsWith('q=') ? parseFloat(q.slice(2)) : 1;
    return { code: code.split('-')[0].toLowerCase(), quality };
  });
  parts.sort((a, b) => b.quality - a.quality);
  for (const { code } of parts) {
    if (LOCALES.includes(code)) return code;
  }
  return DEFAULT_LOCALE;
}

function getLocaleFromPathname(pathname: string): string | null {
  const segment = pathname.slice(1).split('/')[0];
  if (segment && LOCALES.includes(segment)) return segment;
  return null;
}

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const pathnameLocale = getLocaleFromPathname(pathname);

  if (!pathnameLocale) {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    const locale =
      cookieLocale && LOCALES.includes(cookieLocale)
        ? cookieLocale
        : getBestLocaleFromAcceptLanguage(request.headers.get('accept-language'));

    const newUrl = new URL(`/${locale}${pathname === '/' ? '' : pathname}`, request.url);
    newUrl.search = request.nextUrl.search;
    return NextResponse.redirect(newUrl);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
