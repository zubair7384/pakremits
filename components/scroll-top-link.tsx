'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ComponentProps, MouseEvent } from 'react'

/**
 * A link that always lands at the top of its page.
 *
 * - Same page (the logo on home, "Compare" on /compare): scrolls back up
 *   instead of doing nothing, and drops any stale #section from the URL.
 * - Another page: scrolls up itself, then navigates. Next only scrolls a new
 *   page if its first element is off-screen, and our sticky header never is,
 *   so a reader arriving from halfway down /compare stayed halfway down.
 *
 * Section links (#alerts) keep their normal behaviour.
 */
export function ScrollTopLink({
  href,
  onClick,
  ...rest
}: ComponentProps<typeof Link> & { href: string }) {
  const router = useRouter()

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.button !== 0
    ) {
      return
    }

    const target = new URL(href, window.location.href)
    if (target.hash) return

    event.preventDefault()

    if (target.pathname === window.location.pathname) {
      // Keep the query, which on /compare is the reader's search.
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname + window.location.search,
      )
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    window.scrollTo({ top: 0 })
    router.push(href, { scroll: false })
  }

  return <Link href={href} onClick={handleClick} {...rest} />
}
