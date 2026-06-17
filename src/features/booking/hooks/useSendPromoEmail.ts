import { useMutation } from '@tanstack/react-query'
import { useTenantContext } from '@/contexts/TenantContext'
import { sendAndLogEmail } from '@/lib/email'
import { getPromoEmail } from '@/lib/emailTemplates'
import { areEmailNotificationsEnabled } from './useEmailNotifications'
import { logger } from '@/lib/logger'

export interface SendPromoEmailInput {
  subject: string
  body: string
  recipients: string[]
}

export interface SendPromoEmailResult {
  sent: number
  failed: number
  errors: string[]
}

const INTER_SEND_DELAY_MS = 300

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export function useSendPromoEmail() {
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async (input: SendPromoEmailInput): Promise<SendPromoEmailResult> => {
      if (!areEmailNotificationsEnabled()) {
        throw new Error(
          'Invio email non abilitato. Configura VITE_ENABLE_SEND_EMAIL=true in .env.local.',
        )
      }

      if (!tenantId) throw new Error('Tenant non disponibile')

      if (!input.subject.trim()) throw new Error('Oggetto obbligatorio')
      if (!input.body.trim()) throw new Error('Corpo email obbligatorio')
      if (input.recipients.length === 0) throw new Error('Nessun destinatario selezionato')

      const { html } = getPromoEmail({ subject: input.subject, body: input.body })

      let sent = 0
      let failed = 0
      const errors: string[] = []

      for (let i = 0; i < input.recipients.length; i++) {
        const to = input.recipients[i]

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
            logger.warn('[PromoEmail] Fallito per', to, result.error)
          }
        } catch (err) {
          failed++
          const msg = err instanceof Error ? err.message : String(err)
          errors.push(`${to}: ${msg}`)
          logger.warn('[PromoEmail] Eccezione per', to, msg)
        }

        // Piccolo delay tra gli invii per non saturare l'edge
        if (i < input.recipients.length - 1) {
          await delay(INTER_SEND_DELAY_MS)
        }
      }

      return { sent, failed, errors }
    },
  })
}
