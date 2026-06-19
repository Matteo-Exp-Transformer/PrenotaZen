import type { FC } from 'react'
import { useCallback, useState } from 'react'
import { Button, Modal } from '@/components/ui'
import { toast } from 'react-toastify'
import { useUnsavedChangesGuard } from '@/contexts/UnsavedChangesContext'
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
  const { confirmNavigation } = useUnsavedChangesGuard()

  const send = useSendCampaignEmail()
  const emailsEnabled = areEmailNotificationsEnabled()

  const navigateToSelection = useCallback(
    (next: EmailCampaign | null | 'new') => {
      void confirmNavigation().then((ok) => {
        if (ok) setSelected(next)
      })
    },
    [confirmNavigation],
  )

  const handleRowClick = useCallback(
    (c: EmailCampaign) => {
      if (selected !== null && selected !== 'new' && selected.id === c.id) {
        navigateToSelection(null)
        return
      }
      if (selected !== null) {
        navigateToSelection(c)
        return
      }
      setSelected(c)
    },
    [navigateToSelection, selected],
  )

  const handleNewCampaign = useCallback(() => {
    if (selected !== null) {
      navigateToSelection('new')
      return
    }
    setSelected('new')
  }, [navigateToSelection, selected])

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

  const atLimit = campaigns.length >= EMAIL_CAMPAIGNS_MAX

  return (
    <div className="space-y-3">
      {campaigns.length === 0 && selected !== 'new' && (
        <p className="text-sm text-slate-500">Nessuna campagna ancora. Creane una!</p>
      )}

      {campaigns.map((c) => {
        const recipients = parseCampaignRecipients(c.recipient_emails)
        const noRecipients = recipients.length === 0
        const sendDisabled = noRecipients || !emailsEnabled || send.isPending
        const isOpen = selected !== null && selected !== 'new' && selected.id === c.id

        return (
          <div
            key={c.id}
            className={`rounded-xl border bg-white transition-colors ${
              isOpen ? 'border-primary-300' : 'border-slate-200'
            }`}
          >
            <div
              role="button"
              tabIndex={0}
              aria-expanded={isOpen}
              onClick={() => handleRowClick(c)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleRowClick(c)
              }}
              className={`is-clickable w-full text-left p-4 transition-colors ${
                isOpen ? 'hover:bg-slate-50' : 'hover:border-primary-300 hover:bg-slate-50'
              }`}
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

            {isOpen && (
              <div className="border-t border-slate-200 px-4 pb-4 pt-3">
                <CampaignEditor campaign={c} onClose={() => setSelected(null)} />
              </div>
            )}
          </div>
        )
      })}

      {selected === 'new' && (
        <div className="rounded-xl border border-primary-300 bg-white p-5">
          <h3 className="font-semibold text-slate-800 mb-5">Nuova campagna</h3>
          <CampaignEditor onClose={() => setSelected(null)} />
        </div>
      )}

      <div className="pt-1">
        {atLimit ? (
          <p className="text-sm text-slate-500">
            Limite di {EMAIL_CAMPAIGNS_MAX} campagne raggiunto.
          </p>
        ) : (
          <Button type="button" variant="secondary" size="sm" onClick={handleNewCampaign}>
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
