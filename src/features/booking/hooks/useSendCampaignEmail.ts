import { useMutation } from '@tanstack/react-query'
import { useTenantContext } from '@/contexts/TenantContext'
import { supabase } from '@/lib/supabase'
import { sendAndLogEmail } from '@/lib/email'
import { getCampaignEmail, type CampaignLink, type TenantInfo } from '@/lib/emailTemplates'
import { areEmailNotificationsEnabled } from './useEmailNotifications'
import { filterEmailsWithMarketingConsent } from '@/features/booking/utils/promoRecipientEligibility'
import { logger } from '@/lib/logger'

export interface SendCampaignEmailInput {
  subject: string
  body: string
  links: CampaignLink[]
  recipients: string[]
  heading?: string
}

export interface SendCampaignEmailResult {
  sent: number
  failed: number
  errors: string[]
}

const INTER_SEND_DELAY_MS = 300

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export function useSendCampaignEmail() {
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async (input: SendCampaignEmailInput): Promise<SendCampaignEmailResult> => {
      if (!areEmailNotificationsEnabled()) {
        throw new Error(
          'Invio email non abilitato. Configura VITE_ENABLE_SEND_EMAIL=true in .env.local.',
        )
      }

      if (!tenantId) throw new Error('Tenant non disponibile')

      if (!input.subject.trim()) throw new Error('Oggetto obbligatorio')
      if (!input.body.trim()) throw new Error('Corpo email obbligatorio')
      if (input.recipients.length === 0) throw new Error('Nessun destinatario selezionato')

      const { allowed: recipients, skipped } = await filterEmailsWithMarketingConsent(
        tenantId,
        input.recipients,
      )
      if (recipients.length === 0) {
        throw new Error(
          skipped > 0
            ? 'Nessun destinatario con consenso marketing valido'
            : 'Nessun destinatario selezionato',
        )
      }

      const { data: settingsRows } = await supabase
        .from('restaurant_settings')
        .select('setting_key, setting_value')
        .eq('tenant_id', tenantId)
        .in('setting_key', ['restaurant_name', 'contact_phone', 'contact_email'])

      const map: Record<string, unknown> = {}
      for (const row of settingsRows ?? []) {
        map[row.setting_key] = row.setting_value
      }

      const tenantInfo: TenantInfo = {
        name: typeof map.restaurant_name === 'string' ? map.restaurant_name.trim() : undefined,
        phone: typeof map.contact_phone === 'string' ? map.contact_phone.trim() : undefined,
        email: typeof map.contact_email === 'string' ? map.contact_email.trim() : undefined,
      }

      const { html } = getCampaignEmail(
        { subject: input.subject, body: input.body, links: input.links, heading: input.heading },
        tenantInfo,
      )

      let sent = 0
      let failed = 0
      const errors: string[] = []

      for (let i = 0; i < recipients.length; i++) {
        const to = recipients[i]

        try {
          const result = await sendAndLogEmail(
            { tenantId, to, subject: input.subject, html },
            'promo',
          )

          if (result.success) {
            sent++
          } else {
            failed++
            errors.push(`${to}: ${result.error ?? 'errore sconosciuto'}`)
            logger.warn('[CampaignEmail] Fallito per', to, result.error)
          }
        } catch (err) {
          failed++
          const msg = err instanceof Error ? err.message : String(err)
          errors.push(`${to}: ${msg}`)
          logger.warn('[CampaignEmail] Eccezione per', to, msg)
        }

        if (i < recipients.length - 1) {
          await delay(INTER_SEND_DELAY_MS)
        }
      }

      return { sent, failed, errors }
    },
  })
}
