'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'

/**
 * The header's nav below the md breakpoint.
 *
 * A client component because a disclosure needs state. `<details>`/`<summary>`
 * would have kept the header JS-free, but every link in here is a same-page
 * hash: a hash link does not remount anything, so the panel would stay open
 * behind the section the reader just jumped to, and Escape does not close a
 * `<details>` in any browser.
 *
 * The links and the language switcher are passed in rather than fetched, so
 * this ships no message catalogue of its own.
 */
export function MobileNav({
  items,
  label,
  openLabel,
  closeLabel,
  children,
}: {
  items: { href: string; label: string }[]
  label: string
  openLabel: string
  closeLabel: string
  /** The language switcher, rendered by the server component that owns it. */
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      // Focus has to come back to the trigger, or a keyboard reader who
      // dismisses the panel is returned to the top of the document.
      buttonRef.current?.focus()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? closeLabel : openLabel}
        className="flex h-10 w-10 items-center justify-center rounded-full
                   border border-green-3 text-white"
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
          top-[72px] matches the bar's fixed height. */}
      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-[72px] border-b border-green-3 bg-green-2"
      >
        <nav aria-label={label} className="mx-auto max-w-[1120px] px-6 py-2">
          <ul className="grid">
            {items.map((item) => (
              <li key={item.href} className="border-b border-green-3/60 last:border-0">
                <Link
                  href={item.href}
                  // Hash links do not remount this component, so the panel has
                  // to be closed by hand on the way out.
                  onClick={() => setOpen(false)}
                  className="block py-3.5 text-[15px] text-[#C9D9D0] no-underline hover:text-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex justify-start py-3.5">{children}</div>
        </nav>
      </div>
    </div>
  )
}
