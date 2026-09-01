import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { type Locale, localePath } from '@/i18n/routing'
import { corridorPath, methodPath, ratePath, staticPath } from '@/lib/routes'

/**
 * Shared nav and footer. Both are server components — no client JS ships for
 * either — and both take the active locale so every link stays inside it.
 */

export async function SiteHeader({ locale = 'en' }: { locale?: Locale }) {
  const t = await getTranslations({ locale, namespace: 'nav' })

  const nav = [
    { href: `${localePath(locale, '/')}#compare`, label: t('compare') },
    { href: `${localePath(locale, '/')}#alerts`, label: t('alerts') },
    { href: `${localePath(locale, '/')}#corridors`, label: t('corridors') },
    { href: staticPath('how-we-rank', locale), label: t('howWeRank') },
    { href: `${localePath(locale, '/')}#faq`, label: t('faq') },
  ]

  return (
    <div className="bg-green text-mist">
      <div className="mx-auto flex h-[72px] max-w-[1120px] items-center justify-between px-6">
        <Link
          href={localePath(locale, '/')}
          className="flex items-center gap-2.5 text-[22px] font-bold no-underline"
        >
          Bhejo{' '}
          <span className="urdu pt-1.5 text-[19px] leading-none text-gold" lang="ur">
            بھیجو
          </span>
        </Link>

        <nav aria-label={t('main')}>
          <ul className="hidden items-center gap-7 text-[15px] md:flex">
            {nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-[#C9D9D0] no-underline hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-3.5">
          {/* Language switcher. Both links point at the same page in the other
              locale, which only works because every path goes through
              lib/routes rather than being concatenated inline. */}
          <div
            className="hidden overflow-hidden rounded-full border border-green-3 text-[13px] sm:flex"
            aria-label={t('language')}
          >
            <Link
              href="/"
              hrefLang="en-GB"
              aria-current={locale === 'en' ? 'true' : undefined}
              className={`px-3 py-1.5 no-underline ${
                locale === 'en' ? 'bg-green-3 text-white' : 'text-[#A9BFB4]'
              }`}
            >
              EN
            </Link>
            <Link
              href="/ur"
              hrefLang="ur-PK"
              lang="ur"
              aria-current={locale === 'ur' ? 'true' : undefined}
              className={`urdu px-3 pt-2 no-underline ${
                locale === 'ur' ? 'bg-green-3 text-white' : 'text-[#A9BFB4]'
              }`}
            >
              اردو
            </Link>
          </div>

          <Link
            href={`${localePath(locale, '/')}#alerts`}
            className="flex h-10 items-center rounded-full border border-[#2A6B54] px-4
                       text-sm font-medium text-white no-underline hover:bg-green-3"
          >
            {t('setAlert')}
          </Link>
        </div>
      </div>
    </div>
  )
}

export async function SiteFooter({ locale = 'en' }: { locale?: Locale }) {
  const t = await getTranslations({ locale, namespace: 'footer' })

  const columns = [
    {
      heading: t('compare'),
      links: [
        { href: corridorPath('uk', locale), label: 'UK to Pakistan' },
        { href: corridorPath('uae', locale), label: 'UAE to Pakistan' },
        { href: corridorPath('saudi-arabia', locale), label: 'Saudi Arabia to Pakistan' },
        { href: corridorPath('usa', locale), label: 'USA to Pakistan' },
        { href: methodPath('jazzcash', locale), label: 'Send to JazzCash' },
      ],
    },
    {
      heading: t('rates'),
      links: [
        { href: ratePath('gbp', locale), label: 'GBP to PKR' },
        { href: ratePath('aed', locale), label: 'AED to PKR' },
        { href: ratePath('sar', locale), label: 'SAR to PKR' },
        { href: ratePath('usd', locale), label: 'USD to PKR' },
        { href: `${localePath(locale, '/')}#alerts`, label: 'Rate alerts' },
      ],
    },
    {
      heading: t('bhejo'),
      links: [
        { href: staticPath('how-we-rank', locale), label: 'How we rank' },
        { href: staticPath('providers', locale), label: 'All providers' },
        { href: staticPath('affiliate-disclosure', locale), label: 'Affiliate disclosure' },
        { href: staticPath('privacy', locale), label: 'Privacy' },
        { href: staticPath('contact', locale), label: 'Contact' },
      ],
    },
  ]

  return (
    <footer className="mt-24 bg-green px-0 pt-14 pb-10 text-[#C9D9D0]">
      <div className="mx-auto max-w-[1120px] px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <Link
              href={localePath(locale, '/')}
              className="flex items-center gap-2.5 text-[22px] font-bold text-white no-underline"
            >
              Bhejo{' '}
              <span className="urdu pt-1.5 text-[19px] leading-none text-gold" lang="ur">
                بھیجو
              </span>
            </Link>
            {/* Affiliate disclosure. Required on every page carrying provider
                links, so it lives in the footer rather than on one page. */}
            <p className="mt-4 max-w-[48ch] text-[13.5px] leading-relaxed">{t('disclosure')}</p>
          </div>

          {columns.map((column) => (
            <div key={column.heading}>
              <h2 className="mb-3.5 text-[13px] font-medium text-[#7FA090]">{column.heading}</h2>
              <ul className="grid gap-2.5 text-[14.5px]">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="no-underline hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="mt-10 flex flex-wrap justify-between gap-4 border-t border-green-3 pt-5
                     text-[12.5px] text-[#7FA090]"
        >
          <span>{t('copyright', { year: new Date().getFullYear() })}</span>
          <span>
            <Link href="/" className="no-underline hover:text-white">
              English
            </Link>{' '}
            ·{' '}
            <Link href="/ur" lang="ur" className="urdu no-underline hover:text-white">
              اردو
            </Link>
          </span>
        </div>
      </div>
    </footer>
  )
}
