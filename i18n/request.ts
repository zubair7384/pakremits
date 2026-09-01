import { getRequestConfig } from 'next-intl/server'
import { DEFAULT_LOCALE, isLocale } from './routing'
import { getMessagesSync } from './messages'

/**
 * next-intl request config.
 *
 * We do not use next-intl's routing middleware (see i18n/routing.ts for why),
 * so the locale is not inferred from a request — it comes from the `[locale]`
 * path segment, which the layout passes down. This hook exists to satisfy
 * next-intl's server API and to give server components access to messages.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = requested && isLocale(requested) ? requested : DEFAULT_LOCALE

  return {
    locale,
    messages: getMessagesSync(locale),
    // Rates are Pakistan-facing, and the capture timestamps on every quote are
    // shown in PKT, so the default zone matches what the copy says.
    timeZone: 'Asia/Karachi',
  }
})
