import type { FC } from 'react'
import { useState } from 'react'
import { CollapsibleCard } from '@/components/ui'
import { EmailTemplateEditor } from './EmailTemplateEditor'
import { CampaignsManager } from './CampaignsManager'
import { useEmailTemplates } from '@/features/booking/hooks/useEmailTemplates'
import { useUnsavedChangesGuard } from '@/contexts/UnsavedChangesContext'
import {
  DEFAULT_ACCEPTED_SUBJECT,
  DEFAULT_ACCEPTED_INTRO,
  DEFAULT_ACCEPTED_CLOSING,
  DEFAULT_REJECTED_SUBJECT,
  DEFAULT_REJECTED_INTRO,
  DEFAULT_REJECTED_CLOSING,
} from '@/lib/emailTemplates'

export const EmailTemplatesTab: FC = () => {
  const { data: templates = [], isLoading } = useEmailTemplates()
  const { confirmNavigation } = useUnsavedChangesGuard()

  // Stato controllato: la card resta aperta indipendentemente da re-render/refetch
  const [acceptedExpanded, setAcceptedExpanded] = useState(false)
  const [rejectedExpanded, setRejectedExpanded] = useState(false)
  const [acceptedDirty, setAcceptedDirty] = useState(false)
  const [rejectedDirty, setRejectedDirty] = useState(false)

  const savedAccepted = templates.find((t) => t.template_key === 'booking_accepted')
  const savedRejected = templates.find((t) => t.template_key === 'booking_rejected')

  // Chiudere la card con modifiche non salvate passa per il guard (Salva/Annulla/Esci).
  // Card pulita o apertura: nessuna conferma. Dopo "Salva" la card si chiude (onSaved).
  const makeToggle =
    (dirty: boolean, setExpanded: (v: boolean) => void) => (next: boolean) => {
      if (next || !dirty) {
        setExpanded(next)
        return
      }
      void confirmNavigation().then((ok) => {
        if (ok) setExpanded(false)
      })
    }

  if (isLoading) {
    return <p className="text-body text-(--color-text-muted)">Caricamento template…</p>
  }

  return (
    <div className="space-y-8">
      {/* ── Email automatiche ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Email automatiche
        </h2>

        <CollapsibleCard
          title="Accetta prenotazione"
          expanded={acceptedExpanded}
          onExpandedChange={makeToggle(acceptedDirty, setAcceptedExpanded)}
          contentClassName="p-5"
        >
          <EmailTemplateEditor
            templateKey="booking_accepted"
            saved={savedAccepted}
            defaultSubject={DEFAULT_ACCEPTED_SUBJECT}
            defaultIntro={DEFAULT_ACCEPTED_INTRO}
            defaultClosing={DEFAULT_ACCEPTED_CLOSING}
            label="Accetta prenotazione"
            bare
            onSaved={() => setAcceptedExpanded(false)}
            onDirtyChange={setAcceptedDirty}
          />
        </CollapsibleCard>

        <CollapsibleCard
          title="Rifiuta prenotazione"
          expanded={rejectedExpanded}
          onExpandedChange={makeToggle(rejectedDirty, setRejectedExpanded)}
          contentClassName="p-5"
        >
          <EmailTemplateEditor
            templateKey="booking_rejected"
            saved={savedRejected}
            defaultSubject={DEFAULT_REJECTED_SUBJECT}
            defaultIntro={DEFAULT_REJECTED_INTRO}
            defaultClosing={DEFAULT_REJECTED_CLOSING}
            label="Rifiuta prenotazione"
            bare
            onSaved={() => setRejectedExpanded(false)}
            onDirtyChange={setRejectedDirty}
          />
        </CollapsibleCard>
      </section>

      <hr className="border-slate-200" />

      {/* ── Email personalizzate ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Email personalizzate
        </h2>
        <CampaignsManager />
      </section>
    </div>
  )
}
