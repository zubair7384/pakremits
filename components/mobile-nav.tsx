'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

/**
 * The header's nav below the lg breakpoint.
 *
 * A client component because a disclosure needs state. `<details>`/`<summary>`
 * would have kept the header JS-free, but every link in here is a same-page
 * hash: a hash link does not remount anything, so the panel would stay open
 * behind the section the reader just jumped to, and Escape does not close a
 * `<details>` in any browser.
 *
 * The links are passed in rather than fetched, so this ships no message
 * catalogue of its own.
 */
export function MobileNav({
  items,
  label,
  openLabel,
  closeLabel,
  footer,
}: {
  items: { href: string; label: string }[]
  label: string
  openLabel: string
  closeLabel: string
  /** Shown under the links at phone widths only, for controls (the theme
   *  switch) that the bar itself has room for from `sm` up. */
  footer?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  // Wraps both the toggle and the panel, so a tap on either is "inside".
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      // Focus has to come back to the trigger, or a keyboard reader who
      // dismisses the panel is returned to the top of the document.
      buttonRef.current?.focus()
    }

    // A tap anywhere else closes the panel, as the reader expects of a menu.
    // The tap still goes through to whatever it landed on.
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? closeLabel : openLabel}
        className="flex h-10 w-10 items-center justify-center rounded-[10px]
                   border border-line text-ink"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="none">
          {open ? (
            <path
              d="M4 4l10 10M14 4L4 14"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M2 4.5h14M2 9h14M2 13.5h14"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          )}
        </svg>
      </button>

      {/* Anchored to the header bar, not the button: full-bleed, so the panel
          reads as the bar growing downwards rather than as a floating card.
          top-[86px] matches the bar's fixed height. */}
      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-[86px] border-b border-line bg-header"
      >
        <nav aria-label={label} className="mx-auto max-w-[1120px] px-6 py-2">
          <ul className="grid">
            {items.map((item) => (
              <li key={item.href} className="border-b border-line-2 last:border-0">
                <Link
                  href={item.href}
                  // Hash links do not remount this component, so the panel has
                  // to be closed by hand on the way out.
                  onClick={() => setOpen(false)}
                  className="block py-3.5 text-[15px] text-ink no-underline hover:text-green"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          {footer && <div className="border-t border-line-2 py-3.5 sm:hidden">{footer}</div>}
        </nav>
      </div>
    </div>
  )
}
