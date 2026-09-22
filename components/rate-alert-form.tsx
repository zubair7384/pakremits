'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { SEND_CURRENCIES } from '@/lib/db/schema'
import { TurnstileWidget } from './turnstile-widget'

/**
 * The rate alert form from the design.
 *
 * Email is the supported launch channel. The response surfaces validation
 * errors beside the field so the user can correct them.
 */
type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'ok'; needsConfirmation: boolean } | { kind: 'error'; message: string }

export function RateAlertForm({ defaultRate, turnstileSiteKey }: { defaultRate?: number; turnstileSiteKey: string }) {
  const t = useTranslations('alerts')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [resetNonce, setResetNonce] = useState(0)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!turnstileToken) return
    const form = new FormData(event.currentTarget)
    setStatus({ kind: 'sending' })

    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          channel: 'email',
          contact: form.get('contact'),
          fromCurrency: form.get('fromCurrency'),
          targetRate: form.get('targetRate'),
          // The form no longer asks. Every alert is a "rises above" alert —
          // the API still requires the field, and the whole delivery pipeline
          // (decide.ts, messages.ts) branches on it, so it is pinned here
          // rather than dropped from the contract.
          direction: 'above',
          wantsDigest: form.get('wantsDigest') === 'on',
          turnstileToken,
        }),
      })

      const payload = (await response.json()) as {
        ok?: boolean
        error?: string
        needsConfirmation?: boolean
      }

      if (!response.ok || !payload.ok) {
        setTurnstileToken(null)
        setResetNonce((value) => value + 1)
        setStatus({ kind: 'error', message: payload.error ?? t('genericError') })
        return
      }

      setStatus({ kind: 'ok', needsConfirmation: Boolean(payload.needsConfirmation) })
    } catch {
      setTurnstileToken(null)
      setResetNonce((value) => value + 1)
      setStatus({ kind: 'error', message: t('genericError') })
    }
  }

  const fieldClass =
    'h-[54px] w-full appearance-none rounded-[12px] border-[1.5px] border-green-3 bg-green ' +
    'px-4 text-base text-mist focus:border-gold focus:outline-none focus:ring-4 focus:ring-gold/20'

  if (status.kind === 'ok') {
    return (
      <div className="rounded-panel border border-green-3 bg-green-2 p-6" role="status">
        <h3 className="font-display text-xl font-semibold text-mist">
          {status.needsConfirmation ? t('checkInbox') : t('alertSet')}
        </h3>
        <p className="mt-2.5 text-[15px] text-[#C9D9D0]">
          {status.needsConfirmation ? t('checkInboxBody') : t('alertSetBody')}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="rounded-panel border border-green-3 bg-green-2 p-6">
      <div>
        <label htmlFor="alert-pair" className="mb-1.5 block text-[13px] text-[#B2C6BC]">
          {t('pair')}
        </label>
        <select id="alert-pair" name="fromCurrency" className={fieldClass} defaultValue="GBP">
          {SEND_CURRENCIES.map((currency) => (
            <option key={currency} value={currency}>
              {currency} → PKR
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3.5">
        <label htmlFor="alert-rate" className="mb-1.5 block text-[13px] text-[#B2C6BC]">
          {t('targetRate')}
        </label>
        <input
          id="alert-rate"
          name="targetRate"
          inputMode="decimal"
          required
          defaultValue={defaultRate ? defaultRate.toFixed(2) : ''}
          className={`${fieldClass} font-display text-[22px] font-semibold tabular-nums`}
        />
      </div>

      <div className="mt-3.5">
        <label htmlFor="alert-contact" className="mb-1.5 block text-[13px] text-[#B2C6BC]">
          {t('emailAddress')}
        </label>
        <input
          id="alert-contact"
          name="contact"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={fieldClass}
        />
      </div>

      <label className="mt-3.5 flex items-start gap-2.5 text-[14px] text-[#C9D9D0]">
        <input type="checkbox" name="wantsDigest" className="mt-1 h-4 w-4 accent-[#E9B44C]" />
        {t('digestOptIn')}
      </label>

      {turnstileSiteKey ? (
        <TurnstileWidget siteKey={turnstileSiteKey} onToken={setTurnstileToken} resetNonce={resetNonce} />
      ) : <p className="mt-3 text-sm text-[#F5A3A3]">Alerts are temporarily unavailable.</p>}

      <button
        type="submit"
        disabled={status.kind === 'sending' || !turnstileToken}
        className="mt-4.5 flex h-[54px] w-full items-center justify-center rounded-[12px] bg-gold
                   px-6 font-medium text-[#4A3608] hover:bg-[#D9A43E] disabled:opacity-60"
      >
        {status.kind === 'sending' ? t('creating') : t('createAlert')}
      </button>

      <p aria-live="polite" className="mt-3 min-h-[1.25rem] text-center text-[13px]">
        {status.kind === 'error' ? (
          <span className="text-[#F5A3A3]">{status.message}</span>
        ) : (
          <span className="text-[#99B3A6]">{t('fineprint')}</span>
        )}
      </p>
    </form>
  )
}
