/**
 * Affiliate template validation.
 *
 * Pure, so the rules are testable without a form or a database. Getting a
 * template wrong is silent — the redirect still works, the user still reaches
 * the provider, and the commission simply never arrives — so the checks are
 * strict and the messages say what is actually wrong.
 */
export type TemplateCheck = { ok: true } | { ok: false; message: string }

/** Placeholders the redirect substitutes. */
export const CLICK_ID_PLACEHOLDER = '{clickId}'
export const DESTINATION_PLACEHOLDER = '{destination}'

export function validateAffiliateTemplate(template: string): TemplateCheck {
  const trimmed = template.trim()

  // Empty is legitimate: it is the correct state before a programme is
  // approved, and the redirect falls back to the provider's homepage.
  if (trimmed === '') return { ok: true }

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return { ok: false, message: 'The template must be a full URL starting with https://' }
  }

  if (url.protocol !== 'https:') {
    return { ok: false, message: 'The template must use https.' }
  }

  if (!trimmed.includes(CLICK_ID_PLACEHOLDER)) {
    return {
      ok: false,
      message:
        'The template has no {clickId} placeholder, so conversions could not be attributed. ' +
        'Add it to the network sub-id parameter.',
    }
  }

  return { ok: true }
}

/**
 * Build the outbound URL for a click.
 *
 * `{destination}` is URL-encoded because it is carried as a query parameter or
 * path segment inside the network's own URL — leaving it raw would truncate
 * the redirect at the first `?` or `&`.
 */
export function buildAffiliateUrl(options: {
  template: string | null
  homepageUrl: string
  clickId: string
}): string {
  const { template, homepageUrl, clickId } = options
  if (!template) return homepageUrl

  return template
    .replaceAll(CLICK_ID_PLACEHOLDER, encodeURIComponent(clickId))
    .replaceAll(DESTINATION_PLACEHOLDER, encodeURIComponent(homepageUrl))
}
