'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

export interface IconSelectOption {
  value: string
  label: string
  /** Optional compact label used only while the option is selected. */
  selectedLabel?: string
  icon: ReactNode
}

interface IconSelectProps {
  id: string
  label: string
  value: string
  options: readonly IconSelectOption[]
  onChange: (value: string) => void
  className?: string
}

/**
 * A compact visual select for options that need an icon. Native select options
 * cannot reliably render SVG content, so this preserves the expected listbox
 * keyboard controls while keeping icons decorative for screen readers.
 */
export function IconSelect({
  id,
  label,
  value,
  options,
  onChange,
  className = '',
}: IconSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value))
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(selectedIndex)
  const selected = options[selectedIndex]

  useEffect(() => {
    if (!open) return

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [open])

  function openList() {
    setActiveIndex(selectedIndex)
    setOpen(true)
  }

  function choose(index: number) {
    const option = options[index]
    if (!option) return
    onChange(option.value)
    setActiveIndex(index)
    setOpen(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape') {
      if (open) event.preventDefault()
      setOpen(false)
      return
    }

    if (event.key === 'Tab') {
      setOpen(false)
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (open) choose(activeIndex)
      else openList()
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        openList()
        return
      }
      const direction = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((current) => (current + direction + options.length) % options.length)
      return
    }

    if (open && (event.key === 'Home' || event.key === 'End')) {
      event.preventDefault()
      setActiveIndex(event.key === 'Home' ? 0 : options.length - 1)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open ? `${listboxId}-${activeIndex}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
        className={`${className} flex items-center gap-3 text-left`}
      >
        <span className="flex shrink-0 items-center" aria-hidden="true">
          {selected?.icon}
        </span>
        <span className="min-w-0 flex-1 truncate">{selected?.selectedLabel ?? selected?.label}</span>
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={label}
          className="absolute z-40 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border
                     border-line bg-white p-1.5 shadow-[0_18px_45px_rgba(11,61,46,.18)]"
        >
          {options.map((option, index) => (
            <li
              id={`${listboxId}-${index}`}
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              onPointerEnter={() => setActiveIndex(index)}
              onPointerDown={(event) => {
                event.preventDefault()
                choose(index)
              }}
              className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-[15px]
                          ${index === activeIndex ? 'bg-mist text-ink' : 'text-muted'}
                          ${option.value === value ? 'font-medium' : ''}`}
            >
              <span className="flex shrink-0 items-center" aria-hidden="true">
                {option.icon}
              </span>
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {option.value === value && (
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4 shrink-0 text-leaf"
                  aria-hidden="true"
                >
                  <path d="m3 8 3 3 7-7" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
