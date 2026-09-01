import Link from 'next/link'

/** Shared nav and footer. Both are server components — no client JS. */

const NAV = [
  { href: '/#compare', label: 'Compare' },
  { href: '/#alerts', label: 'Rate alerts' },
  { href: '/#corridors', label: 'Corridors' },
  { href: '/how-we-rank', label: 'How we rank' },
  { href: '/#faq', label: 'FAQ' },
]

export function SiteHeader({ locale = 'en' }: { locale?: 'en' | 'ur' }) {
  return (
    <div className="bg-green text-mist">
      <div className="mx-auto flex h-[72px] max-w-[1120px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5 text-[22px] font-bold no-underline">
          Bhejo{' '}
          <span className="urdu pt-1.5 text-[19px] leading-none text-gold" lang="ur">
            بھیجو
          </span>
        </Link>

        <nav aria-label="Main">
          <ul className="hidden items-center gap-7 text-[15px] md:flex">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-[#C9D9D0] no-underline hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-3.5">
          <div
            className="hidden overflow-hidden rounded-full border border-green-3 text-[13px] sm:flex"
            aria-label="Language"
          >
            <Link
              href="/"
              aria-current={locale === 'en' ? 'true' : undefined}
              className={`px-3 py-1.5 no-underline ${
                locale === 'en' ? 'bg-green-3 text-white' : 'text-[#A9BFB4]'
              }`}
            >
              EN
            </Link>
            <Link
              href="/ur"
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
            href="/#alerts"
            className="flex h-10 items-center rounded-full border border-[#2A6B54] px-4
                       text-sm font-medium text-white no-underline hover:bg-green-3"
          >
            Set a rate alert
          </Link>
        </div>
      </div>
    </div>
  )
}

const FOOTER_COLUMNS = [
  {
    heading: 'Compare',
    links: [
      { href: '/send-money-from-uk-to-pakistan', label: 'UK to Pakistan' },
      { href: '/send-money-from-uae-to-pakistan', label: 'UAE to Pakistan' },
      { href: '/send-money-from-saudi-arabia-to-pakistan', label: 'Saudi Arabia to Pakistan' },
      { href: '/send-money-from-usa-to-pakistan', label: 'USA to Pakistan' },
      { href: '/send-money-to-jazzcash', label: 'Send to JazzCash' },
    ],
  },
  {
    heading: 'Rates',
    links: [
      { href: '/gbp-to-pkr', label: 'GBP to PKR' },
      { href: '/aed-to-pkr', label: 'AED to PKR' },
      { href: '/sar-to-pkr', label: 'SAR to PKR' },
      { href: '/usd-to-pkr', label: 'USD to PKR' },
      { href: '/#alerts', label: 'Rate alerts' },
    ],
  },
  {
    heading: 'Bhejo',
    links: [
      { href: '/how-we-rank', label: 'How we rank' },
      { href: '/providers', label: 'All providers' },
      { href: '/affiliate-disclosure', label: 'Affiliate disclosure' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/contact', label: 'Contact' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-green px-0 pt-14 pb-10 text-[#C9D9D0]">
      <div className="mx-auto max-w-[1120px] px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2.5 text-[22px] font-bold text-white no-underline">
              Bhejo{' '}
              <span className="urdu pt-1.5 text-[19px] leading-none text-gold" lang="ur">
                بھیجو
              </span>
            </Link>
            {/* Affiliate disclosure. Required on every page carrying provider
                links, so it lives in the footer rather than on one page. */}
            <p className="mt-4 max-w-[48ch] text-[13.5px] leading-relaxed">
              Bhejo is an independent comparison service. We earn a commission from some providers
              when you sign up through our links. This never affects the ranking, which is by amount
              received. We are not a money transfer service and never hold your funds.
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
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
          <span>
            © {new Date().getFullYear()} Bhejo. Rates are indicative and provided for comparison
            only.
          </span>
          <span>
            English ·{' '}
            <Link href="/ur" lang="ur" className="urdu no-underline hover:text-white">
              اردو
            </Link>
          </span>
        </div>
      </div>
    </footer>
  )
}
