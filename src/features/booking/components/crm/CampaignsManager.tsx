import type { FC } from 'react'
import { useState } from 'react'
import { Button, Modal } from '@/components/ui'
import { toast } from 'react-toastify'
import { CampaignEditor } from './CampaignEditor'
import {
  useEmailCampaigns,
  EMAIL_CAMPAIGNS_MAX,
  type EmailCampaign,
  parseCampaignLinks,
  parseCampaignRecipients,
} from '@/features/booking/hooks/useEmailCampaigns'
import { useSendCampaignEmail } from '@/features/booking/hooks/useSendCampaignEmail'
import { areEmailNotificationsEnabled } from '@/features/booking/hooks/useEmailNotifications'

const CADENCE_LABEL: Record<string, string> = {
  none: 'Solo manuale',
  weekly: 'Settimanale',
  monthly: 'Mensile',
  custom: 'Personalizzata',
}

export const CampaignsManager: FC = () => {
  const { data: campaigns = [], isLoading } = useEmailCampaigns()
  const [selected, setSelected] = useState<EmailCampaign | null | 'new'>(null)
  const [confirmCampaign, setConfirmCampaign] = useState<EmailCampaign | null>(null)

  const send = useSendCampaignEmail()
  const emailsEnabled = areEmailNotificationsEnabled()

  const handleSendNow = () => {
    if (!confirmCampaign) return
    const recipients = parseCampaignRecipients(confirmCampaign.recipient_emails)
    const links = parseCampaignLinks(confirmCampaign.links)
    setConfirmCampaign(null)
    send.mutate(
      {
        subject: confirmCampaign.subject,
        body: confirmCampaign.body,
        links,
        recipients,
        heading: confirmCampaign.heading ?? undefined,
      },
      {
        onSuccess: ({ sent, failed }) => {
          if (failed === 0) {
            toast.success(`${sent} email inviata${sent !== 1 ? 'e' : ''} con successo`)
          } else {
            toast.warn(`${sent} inviate, ${failed} fallite`)
          }
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  if (isLoading) {
    return <p className="text-sm text-slate-500">Caricamento campagne…</p>
  }

  // Editing / creazione
  if (selected !== null) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-800 mb-5">
          {selected === 'new' ? 'Nuova campagna' : selected.name}
        </h3>
        <CampaignEditor
          campaign={selected === 'new' ? undefined : selected}
          onClose={() => setSelected(null)}
        />
      </div>
    )
  }

  // Lista campagne
  const atLimit = campaigns.length >= EMAIL_CAMPAIGNS_MAX

  return (
    <div className="space-y-3">
      {campaigns.length === 0 && (
        <p className="text-sm text-slate-500">Nessuna campagna ancora. Creane una!</p>
      )}

      {campaigns.map((c) => {
        const recipients = parseCampaignRecipients(c.recipient_emails)
        const noRecipients = recipients.length === 0
        const sendDisabled = noRecipients || !emailsEnabled || send.isPending

        return (
          <div
            key={c.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelected(c)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setSelected(c)
            }}
            className="is-clickable w-full text-left rounded-xl border border-slate-200 bg-white p-4 hover:border-primary-300 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-slate-800 truncate">{c.name}</p>
                <p className="text-sm text-slate-500 truncate">{c.subject}</p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className="text-xs rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600">
                  {CADENCE_LABEL[c.cadence_type] ?? c.cadence_type}
                </span>
                {c.cadence_type === 'none' && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={sendDisabled}
                      title={noRecipients ? 'Nessun destinatario nel gruppo' : undefined}
                      onClick={() => setConfirmCampaign(c)}
                    >
                      Invia ora
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}

      <div className="pt-1">
        {atLimit ? (
          <p className="text-sm text-slate-500">
            Limite di {EMAIL_CAMPAIGNS_MAX} campagne raggiunto.
          </p>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setSelected('new')}
          >
            + Nuova campagna
          </Button>
        )}
      </div>

      {confirmCampaign && (
        <Modal
          isOpen
          onClose={() => setConfirmCampaign(null)}
          title="Conferma invio campagna"
        >
          <div className="space-y-4">
            <p className="text-slate-700">
              Inviare <em>«{confirmCampaign.name}»</em> a{' '}
              <strong>
                {parseCampaignRecipients(confirmCampaign.recipient_emails).length}
              </strong>{' '}
              contatti del gruppo?
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setConfirmCampaign(null)}
              >
                Annulla
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={handleSendNow}>
                Invia ora
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
