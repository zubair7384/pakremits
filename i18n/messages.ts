import type { Locale } from './routing'
import { en } from '@/messages/en'
import { ur } from '@/messages/ur'

/**
 * Message lookup.
 *
 * Static imports rather than dynamic ones: there are two locales and the
 * catalogues are small, so code-splitting them would cost a round trip to save
 * a few kilobytes. `ur` is typed as `Messages`, so a key added to English but
 * missing from Urdu is a compile error rather than a blank string in
 * production.
 */
const CATALOGUES = { en, ur } as const

export async function getMessages(locale: Locale) {
  return CATALOGUES[locale]
}

export function getMessagesSync(locale: Locale) {
  return CATALOGUES[locale]
}
