import { normalizeCustomerEmail } from '@/lib/customerEmail'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { CustomerProfile } from '@/types/customer'

/** Una riga per email — per picker campagne (rubrica può avere più nomi stessa email). */
export function dedupeProfilesByEmail(profiles: CustomerProfile[]): CustomerProfile[] {
  const byEmail = new Map<string, CustomerProfile>()
  for (const p of profiles) {
    const existing = byEmail.get(p.email)
    if (!existing) {
      byEmail.set(p.email, p)
      continue
    }
    const existingDate = existing.last_booking_date ?? ''
    const nextDate = p.last_booking_date ?? ''
    if (nextDate.localeCompare(existingDate) > 0) {
      byEmail.set(p.email, p)
    }
  }
  return Array.from(byEmail.values())
}

/** Intersezione sincrona: solo email ancora eleggibili (consenso marketing + picker). */
export function filterRecipientsToEligible(
  emails: readonly string[],
  eligibleEmails: ReadonlySet<string>,
): string[] {
  return emails.filter((email) => eligibleEmails.has(email))
}

/** Conteggio destinatari eleggibili — allinea lista visibile e contatori UI. */
export function countEligibleRecipients(
  emails: readonly string[] | ReadonlySet<string>,
  eligibleEmails: ReadonlySet<string>,
): number {
  const list = Array.from(emails as Iterable<string>)
  return filterRecipientsToEligible(list, eligibleEmails).length
}

/** Destinatario ammissibile per email personalizzate / campagne CRM. */
export function isEligiblePromoRecipient(c: CustomerProfile): boolean {
  return (
    c.source === 'booking' &&
    !!c.email &&
    c.email.includes('@') &&
    c.marketing_consent === true
  )
}

/**
 * Guard invio campagne: scarta email senza `customers.marketing_consent = true`.
 * Difesa server-side anche se il payload contiene indirizzi non presenti nel picker.
 */
export async function filterEmailsWithMarketingConsent(
  tenantId: string,
  emails: string[],
): Promise<{ allowed: string[]; skipped: number }> {
  if (emails.length === 0) return { allowed: [], skipped: 0 }

  const normalized = [
    ...new Set(emails.map((e) => normalizeCustomerEmail(e)).filter((e): e is string => e !== null)),
  ]

  const { data, error } = await supabase
    .from('customers')
    .select('email')
    .eq('tenant_id', tenantId)
    .eq('marketing_consent', true)
    .in('email', normalized)

  if (error) throw new Error(error.message)

  const consented = new Set(
    (data ?? [])
      .map((r) => normalizeCustomerEmail(r.email))
      .filter((e): e is string => e !== null),
  )

  const allowed = emails.filter((e) => {
    const key = normalizeCustomerEmail(e)
    return key !== null && consented.has(key)
  })

  const skipped = emails.length - allowed.length
  if (skipped > 0) {
    logger.warn(`[CampaignEmail] ${skipped} destinatari scartati: assente consenso marketing`)
  }

  return { allowed, skipped }
}
