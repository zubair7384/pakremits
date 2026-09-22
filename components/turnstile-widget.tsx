'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'

type TurnstileApi = {
  render: (element: HTMLElement, options: {
    sitekey: string
    appearance: 'interaction-only'
    theme: 'dark'
    callback: (token: string) => void
    'expired-callback': () => void
    'error-callback': () => void
  }) => string
  reset: (id: string) => void
  remove: (id: string) => void
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

export function TurnstileWidget({ siteKey, onToken, resetNonce }: {
  siteKey: string
  onToken: (token: string | null) => void
  resetNonce: number
}) {
  const container = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const callback = useRef(onToken)
  const [ready, setReady] = useState(false)
  useEffect(() => { callback.current = onToken }, [onToken])

  useEffect(() => {
    if (!ready || !container.current || !window.turnstile || widgetId.current) return
    widgetId.current = window.turnstile.render(container.current, {
      sitekey: siteKey,
      appearance: 'interaction-only',
      theme: 'dark',
      callback: (token) => callback.current(token),
      'expired-callback': () => callback.current(null),
      'error-callback': () => callback.current(null),
    })
    return () => {
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current)
      widgetId.current = null
    }
  }, [ready, siteKey])

  useEffect(() => {
    if (resetNonce && widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current)
  }, [resetNonce])

  return <>
    <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setReady(true)} />
    <div ref={container} aria-label="Bot protection" />
  </>
}
