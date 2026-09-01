import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { fonts } from '@/lib/fonts'
import { LOCALES, LOCALE_DIR, LOCALE_TAG, isLocale } from '@/i18n/routing'
import { getMessages } from '@/i18n/messages'
import '../globals.css'

export const metadata: Metadata = {
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

  const messages = await getMessages(locale)

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
