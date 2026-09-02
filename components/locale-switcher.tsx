'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type Locale, DEFAULT_LOCALE, localePath } from '@/i18n/routing'

/**
 * Language switcher.
 *
 * A client component purely so it can read the current path: the header is
 * rendered by every page and has no other way to know where it is. Previously
 * both links were hard-coded to "/" and "/ur", so a reader on a corridor page
 * who switched to Urdu was dumped on the Urdu home page — and the header
 * disagreed with the page's own hreflang, which correctly pointed at the Urdu
 * version of that same page.
 *
 * Note this operates on the *public* path. usePathname returns the URL the
 * reader sees, not the internal rewrite target, which is what we want: the
 * equivalent of /gbp-to-pkr is /ur/gbp-to-pkr, not /ur/rate/gbp.
 */
/** Route trees that exist only in English. */
const UNLOCALISED_PREFIXES = ['/alerts', '/admin', '/go']

export function LocaleSwitcher({
  locale,
  label,
  className = 'flex',
}: {
  locale: Locale
  label: string
  /** Display and visibility classes. The header hides it below md, where the
      mobile menu renders its own copy; the default is a plain visible row. */
  className?: string
}) {
  const pathname = usePathname() || '/'

  // Strip the locale prefix to get the shared, locale-free path.
  const stripped =
    pathname === '/ur' ? '/' : pathname.startsWith('/ur/') ? pathname.slice(3) : pathname

  /**
   * Not every page lives under [locale]. The alert pages are reached from a
   * emailed token and exist once, in English, so offering /ur/alerts/... would
   * be a 404. For those, both links go to that locale's home instead of a
   * path that does not exist.
   */
  const localised = !UNLOCALISED_PREFIXES.some(
    (prefix) => stripped === prefix || stripped.startsWith(`${prefix}/`),
  )
  const bare = localised ? stripped : '/'

  const targets: Record<Locale, string> = {
    en: localePath(DEFAULT_LOCALE, bare),
    ur: localePath('ur', bare),
  }

  return (
    <div
      className={`overflow-hidden rounded-full border border-green-3 text-[13px] ${className}`}
      aria-label={label}
    >
      <Link
        href={targets.en}
        hrefLang="en-GB"
        aria-current={locale === 'en' ? 'true' : undefined}
        className={`px-3 py-1.5 no-underline ${
          locale === 'en' ? 'bg-green-3 text-white' : 'text-[#B2C6BC]'
        }`}
      >
        EN
      </Link>
      <Link
        href={targets.ur}
        hrefLang="ur-PK"
        lang="ur"
        aria-current={locale === 'ur' ? 'true' : undefined}
        className={`${locale === 'ur' ? 'urdu' : 'urdu-fixed'} px-3 pt-2 no-underline ${
          locale === 'ur' ? 'bg-green-3 text-white' : 'text-[#B2C6BC]'
        }`}
      >
        اردو
      </Link>
    </div>
  )
}
