import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { MobileNav } from '@/components/mobile-nav'
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
    /* Sticky and fully opaque — green-2 on a green-3 rule, the same pairing the
       rate panel in the hero uses, so the bar reads as one of the site's
       surfaces rather than a tint of whatever scrolls beneath it. */
    <div className="sticky top-0 z-50 border-b border-green-3 bg-green-2 text-mist">
      <div className="mx-auto flex h-[72px] max-w-[1120px] items-center justify-between px-6">
        <Link href={localePath(locale, '/')} className="flex items-center no-underline">
          {/* Dark variant: the supplied logo is inked in #0B3D2E, which is the
              --color-green this bar sits on. See public/pakremits-logo-*.svg.

              Plain <img>, not next/image: the source is a static SVG, which the
              image optimiser passes through untouched anyway and only serves
              behind `dangerouslyAllowSVG`. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/pakremits-logo-dark.svg"
            alt="PakRemits"
            width={176}
            height={50}
            className="h-10 w-auto sm:h-[50px]"
          />
        </Link>

        {/* Hidden on the landmark, not the list: leaving an empty <nav> with
            this label in the mobile DOM would give the page two "Main"
            navigation landmarks, one of them empty. */}
        <nav aria-label={t('main')} className="hidden md:block">
          <ul className="flex items-center gap-7 text-[15px]">
            {nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-[#C9D9D0] no-underline hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <Link
            href={`${localePath(locale, '/')}#alerts`}
            className="flex h-10 items-center rounded-full border border-[#2A6B54] px-3.5
                       text-sm font-medium whitespace-nowrap text-white no-underline
                       hover:bg-green-3 sm:px-4"
          >
            {t('setAlert')}
          </Link>

          <MobileNav
            items={nav}
            label={t('main')}
            openLabel={t('openMenu')}
            closeLabel={t('closeMenu')}
          />
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
      heading: t('brand'),
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
            <Link href={localePath(locale, '/')} className="flex items-center no-underline">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/pakremits-logo-dark.svg"
                alt="PakRemits"
                width={176}
                height={50}
                className="h-[50px] w-auto"
              />
            </Link>
            {/* Affiliate disclosure. Required on every page carrying provider
                links, so it lives in the footer rather than on one page. */}
            <p className="mt-4 max-w-[48ch] text-[13.5px] leading-relaxed">{t('disclosure')}</p>
          </div>

          {columns.map((column) => (
            <div key={column.heading}>
              <h2 className="mb-3.5 text-[13px] font-medium text-[#99B3A6]">{column.heading}</h2>
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
          className="mt-10 border-t border-green-3 pt-5 text-[12.5px] text-[#99B3A6]"
        >
          <span>{t('copyright', { year: new Date().getFullYear() })}</span>
        </div>
      </div>
    </footer>
  )
}
