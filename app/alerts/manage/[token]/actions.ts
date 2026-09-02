'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { rateAlerts } from '@/lib/db/schema'
import { isPlausibleToken } from '@/lib/alerts/tokens'

/**
 * Self-service actions on one alert.
 *
 * The token in the URL is the authorisation — there is no account — so every
 * action re-checks it rather than trusting a hidden form field.
 */
export async function deleteAlert(formData: FormData) {
  const token = String(formData.get('token') ?? '')
  if (!isPlausibleToken(token)) redirect('/?alert=invalid')

  await db.delete(rateAlerts).where(eq(rateAlerts.unsubscribeToken, token))
  redirect('/alerts/removed')
}

export async function setDigest(formData: FormData) {
  const token = String(formData.get('token') ?? '')
  const wantsDigest = formData.get('wantsDigest') === 'on'
  if (!isPlausibleToken(token)) redirect('/?alert=invalid')

  await db
    .update(rateAlerts)
    .set({ wantsDigest })
    .where(eq(rateAlerts.unsubscribeToken, token))

  revalidatePath(`/alerts/manage/${token}`)
}
