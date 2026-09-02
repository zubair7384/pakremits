import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { fonts } from '@/lib/fonts'
import { LOCALES, LOCALE_DIR, LOCALE_TAG, isLocale } from '@/i18n/routing'
import { getMessages } from '@/i18n/messages'
import '../globals.css'

export const metadata: Metadata = {
  /**
   * Without this, Next emits `<link rel="canonical" href="/">` and relative
   * hreflang hrefs. Lighthouse flags both — search engines want absolute URLs,
   * and a relative hreflang is simply ignored, which silently undoes the whole
   * bilingual setup.
   */
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'Bhejo — compare rates before you send money to Pakistan',
  description:
    'Compare every major service sending money to Pakistan, ranked by the exact amount that ' +
    'lands in the account. Not by rate, not by fee, not by who pays us.',
}

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // Validate before narrowing, not after. An unknown locale segment must 404
  // rather than falling back to English — otherwise /anything would serve the
  // home page and the site would sprout infinite duplicate URLs.
  if (!isLocale(locale)) notFound()

  // Required for static rendering. Without it, next-intl's server APIs read
  // from headers and silently opt every page into dynamic rendering — the
  // whole route tree drops from prerendered to server-rendered-on-demand.
  setRequestLocale(locale)

  const all = await getMessages(locale)

  /**
   * Only the namespaces client components actually read.
   *
   * NextIntlClientProvider serialises whatever it is given into the RSC payload
   * on every page, so passing the whole catalogue shipped `home`, `footer`,
   * `nav` and `common` — all rendered on the server — to the browser as dead
   * weight. Measured at 4.6kB of the 7.2kB catalogue.
   *
   * If a new client component needs a namespace, add it here; `useTranslations`
   * will throw a clear error naming the missing one rather than rendering the
   * key.
   */
  const messages = {
    panel: all.panel,
    methods: all.methods,
    alerts: all.alerts,
  }

  return (
    <html
      lang={LOCALE_TAG[locale]}
      dir={LOCALE_DIR[locale]}
      className={fonts}
      // Urdu needs the larger line-height Nastaliq requires; setting it here
      // rather than per-component keeps it out of every layout calculation.
      data-locale={locale}
    >
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
