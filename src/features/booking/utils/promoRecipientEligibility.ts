import { normalizeCustomerEmail } from '@/lib/customerEmail'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { CustomerProfile } from '@/types/customer'

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
