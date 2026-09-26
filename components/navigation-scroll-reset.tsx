'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'

/**
 * Lands every client-side navigation at the top of the new page.
 *
 * Next's own scroll-on-navigate skips the sticky header, then checks whether
 * the next element is below `scroll-padding-top`. Every page's first block
 * starts right under the bar, so that check decided the page was "off-screen"
 * and scrolled it into view — leaving a new page (or a fresh /compare search)
 * part-way down, with the search bar hidden under the header. Taking the
 * decision here makes it the same on every page.
 *
 * Left alone: the first load (the browser restores it), links to a #section,
 * and back/forward, where the browser's restored position is what people expect.
 */
export function NavigationScrollReset() {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const isFirstRender = useRef(true)
  const isHistoryNavigation = useRef(false)

  useEffect(() => {
    function onPopState() {
      isHistoryNavigation.current = true
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (isHistoryNavigation.current) {
      isHistoryNavigation.current = false
      return
    }
    if (window.location.hash) return
    // `instant`: the html element's smooth scrolling is for in-page jumps.
    const toTop = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    toTop()
    // Again next frame, in case Next's own scroll lands after this effect.
    const frame = requestAnimationFrame(toTop)
    return () => cancelAnimationFrame(frame)
  }, [pathname, search])

  return null
}
