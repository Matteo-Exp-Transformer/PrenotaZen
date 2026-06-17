import type { FC } from 'react'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Button, Input, Textarea, Label, Modal } from '@/components/ui'
import { toast } from 'react-toastify'
import { CampaignLinksEditor } from './CampaignLinksEditor'
import { CampaignCadenceSelector } from './CampaignCadenceSelector'
import { PromoRecipientPicker } from './PromoRecipientPicker'
import {
  useCreateCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
  type CadenceType,
  type CadenceConfig,
} from '@/features/booking/hooks/useEmailCampaignMutations'
import { getCampaignEmail, DEFAULT_CAMPAIGN_HEADING, type CampaignLink } from '@/lib/emailTemplates'
import {
  parseCampaignLinks,
  parseCampaignRecipients,
  type EmailCampaign,
} from '@/features/booking/hooks/useEmailCampaigns'
import { useUnsavedChangesGuard } from '@/contexts/UnsavedChangesContext'

interface Props {
  campaign?: EmailCampaign
  onClose: () => void
}

export const CampaignEditor: FC<Props> = ({ campaign, onClose }) => {
  const isNew = !campaign

  const [name, setName] = useState(campaign?.name ?? '')
  const [subject, setSubject] = useState(campaign?.subject ?? '')
  const [body, setBody] = useState(campaign?.body ?? '')
  const [heading, setHeading] = useState(campaign?.heading ?? '')
  const [links, setLinks] = useState<CampaignLink[]>(
    campaign ? parseCampaignLinks(campaign.links) : [],
  )
  const [recipients, setRecipients] = useState<string[]>(
    campaign ? parseCampaignRecipients(campaign.recipient_emails) : [],
  )
  const [cadenceType, setCadenceType] = useState<CadenceType>(
    (campaign?.cadence_type as CadenceType) ?? 'none',
  )
  const [cadenceConfig, setCadenceConfig] = useState<CadenceConfig | null>(
    (campaign?.cadence_config as CadenceConfig | null) ?? null,
  )

  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const { registerUnsavedSource, registerUnsavedHandlers, clearUnsavedSource } = useUnsavedChangesGuard()

  const loadedCampaignIdRef = useRef<string | null>(campaign?.id ?? null)

  // Sincronizza solo al cambio campagna (id), non su refetch con stesso id — preserva draft locale
  // (inclusi destinatari confermati nel picker ma non ancora salvati su DB).
  useEffect(() => {
    if (!campaign) {
      loadedCampaignIdRef.current = null
      return
    }
    if (loadedCampaignIdRef.current === campaign.id) return
    loadedCampaignIdRef.current = campaign.id
    setName(campaign.name)
    setSubject(campaign.subject)
    setBody(campaign.body)
    setHeading(campaign.heading ?? '')
    setLinks(parseCampaignLinks(campaign.links))
    setRecipients(parseCampaignRecipients(campaign.recipient_emails))
    setCadenceType((campaign.cadence_type as CadenceType) ?? 'none')
    setCadenceConfig((campaign.cadence_config as CadenceConfig | null) ?? null)
  }, [campaign])

  const create = useCreateCampaign()
  const update = useUpdateCampaign()
  const remove = useDeleteCampaign()

  const dirty = useMemo(() => {
    if (isNew) {
      return !!(name || subject || body || heading || links.length || recipients.length || cadenceType !== 'none')
    }
    return (
      name !== (campaign?.name ?? '') ||
      subject !== (campaign?.subject ?? '') ||
      body !== (campaign?.body ?? '') ||
      heading !== (campaign?.heading ?? '') ||
      JSON.stringify(links) !== JSON.stringify(parseCampaignLinks(campaign!.links)) ||
      JSON.stringify(recipients) !== JSON.stringify(parseCampaignRecipients(campaign!.recipient_emails)) ||
      cadenceType !== ((campaign?.cadence_type as CadenceType) ?? 'none') ||
      JSON.stringify(cadenceConfig) !== JSON.stringify((campaign?.cadence_config as CadenceConfig | null) ?? null)
    )
  }, [isNew, name, subject, body, heading, links, recipients, cadenceType, cadenceConfig, campaign])

  const guardId = `campaign-editor-${campaign?.id ?? 'new'}`
  const guardLabel = isNew ? 'Nuova campagna' : `Email personalizzata: ${campaign!.name}`

  const handleCadenceChange = (type: CadenceType, config: CadenceConfig | null) => {
    setCadenceType(type)
    setCadenceConfig(config)
  }

  const handleSave = useCallback((): Promise<void> => {
    if (!name.trim()) { toast.error('Il nome è obbligatorio'); return Promise.reject(new Error('nome mancante')) }
    if (!subject.trim()) { toast.error("L'oggetto è obbligatorio"); return Promise.reject(new Error('oggetto mancante')) }
    if (!body.trim()) { toast.error('Il corpo è obbligatorio'); return Promise.reject(new Error('corpo mancante')) }

    const payload = {
      name: name.trim(),
      subject: subject.trim(),
      body: body.trim(),
      heading: heading.trim() || null,
      links,
      recipient_emails: recipients,
      cadence_type: cadenceType,
      cadence_config: cadenceType !== 'none' ? cadenceConfig : null,
    }

    return new Promise((resolve, reject) => {
      if (isNew) {
        create.mutate(payload, {
          onSuccess: () => { toast.success('Campagna creata'); resolve(); onClose() },
          onError: (e) => { toast.error(e.message); reject(e) },
        })
      } else {
        update.mutate(
          { id: campaign!.id, ...payload },
          {
            onSuccess: () => { toast.success('Campagna aggiornata'); resolve() },
            onError: (e) => { toast.error(e.message); reject(e) },
          },
        )
      }
    })
  }, [name, subject, body, heading, links, recipients, cadenceType, cadenceConfig, isNew, create, update, campaign, onClose])

  const handleDiscard = useCallback(() => {
    setName(campaign?.name ?? '')
    setSubject(campaign?.subject ?? '')
    setBody(campaign?.body ?? '')
    setHeading(campaign?.heading ?? '')
    setLinks(campaign ? parseCampaignLinks(campaign.links) : [])
    setRecipients(campaign ? parseCampaignRecipients(campaign.recipient_emails) : [])
    setCadenceType((campaign?.cadence_type as CadenceType) ?? 'none')
    setCadenceConfig((campaign?.cadence_config as CadenceConfig | null) ?? null)
  }, [campaign])

  useEffect(() => {
    registerUnsavedSource(guardId, guardLabel, dirty)
    return () => clearUnsavedSource(guardId)
  }, [dirty, guardId, guardLabel, registerUnsavedSource, clearUnsavedSource])

  useEffect(() => {
    registerUnsavedHandlers(guardId, { saveAll: handleSave, discardAll: handleDiscard })
    return () => registerUnsavedHandlers(guardId, null)
  }, [guardId, handleSave, handleDiscard, registerUnsavedHandlers])

  const handleDelete = () => {
    setConfirmDeleteOpen(false)
    remove.mutate(campaign!.id, {
      onSuccess: () => { toast.success('Campagna eliminata'); onClose() },
      onError: (e) => toast.error(e.message),
    })
  }

  const previewHtml = showPreview
    ? getCampaignEmail({ subject: subject || '(oggetto)', body: body || '(corpo)', links, heading: heading.trim() || undefined }).html
    : ''

  const isSaving = create.isPending || update.isPending

  return (
    <div className="space-y-5">
      {/* Nome campagna */}
      <div className="space-y-1">
        <Label htmlFor="camp-name">Nome campagna</Label>
        <Input
          id="camp-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Es: Offerta fine settimana"
        />
      </div>

      {/* Oggetto */}
      <div className="space-y-1">
        <Label htmlFor="camp-subject">Oggetto email</Label>
        <Input
          id="camp-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Es: Speciale estate — prenota ora!"
        />
      </div>

      {/* Titolo email */}
      <div className="space-y-1">
        <Label htmlFor="camp-heading">Titolo in cima all'email</Label>
        <Input
          id="camp-heading"
          value={heading}
          onChange={(e) => setHeading(e.target.value)}
          placeholder={DEFAULT_CAMPAIGN_HEADING}
        />
      </div>

      {/* Corpo */}
      <div className="space-y-1">
        <Label htmlFor="camp-body">Corpo del messaggio</Label>
        <Textarea
          id="camp-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Scrivi il messaggio… Gli URL (https://…) diventano link cliccabili in automatico."
          rows={6}
        />
      </div>

      {/* Link strutturati */}
      <CampaignLinksEditor links={links} onChange={setLinks} />

      {/* Cadenza */}
      <CampaignCadenceSelector
        cadenceType={cadenceType}
        cadenceConfig={cadenceConfig}
        onChange={handleCadenceChange}
      />

      {/* Gruppo destinatari */}
      <div className="space-y-2">
        <Label>Gruppo destinatari salvato</Label>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-slate-600">
            {recipients.length > 0
              ? `${recipients.length} contatt${recipients.length === 1 ? 'o' : 'i'} salvat${recipients.length === 1 ? 'o' : 'i'}`
              : 'Nessun destinatario salvato'}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setPickerOpen(true)}
          >
            {recipients.length > 0 ? 'Modifica gruppo…' : 'Scegli gruppo…'}
          </Button>
        </div>
        {recipients.length > 0 && (
          <p className="text-xs text-slate-400">
            Nota: il gruppo è fisso alla creazione e non si aggiorna con i nuovi clienti.
          </p>
        )}
      </div>

      {/* Anteprima */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="text-sm text-primary-600 underline hover:no-underline cursor-pointer"
        >
          {showPreview ? 'Nascondi anteprima' : 'Mostra anteprima email'}
        </button>
        {showPreview && (
          <iframe
            srcDoc={previewHtml}
            sandbox="allow-same-origin"
            className="w-full rounded-lg border border-slate-200"
            style={{ height: 400 }}
            title="Anteprima email campagna"
          />
        )}
      </div>

      {/* Azioni */}
      <div className="flex gap-2 flex-wrap pt-1">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => void handleSave()}
          disabled={isSaving}
        >
          {isSaving ? 'Salvataggio…' : isNew ? 'Crea campagna' : 'Salva'}
        </Button>

        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          Annulla
        </Button>

        {!isNew && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={remove.isPending}
            className="ml-auto text-red-600 border-red-200 hover:bg-red-50"
          >
            Elimina
          </Button>
        )}
      </div>

      {/* Picker destinatari */}
      <PromoRecipientPicker
        isOpen={pickerOpen}
        initialRecipients={recipients}
        onClose={() => setPickerOpen(false)}
        onConfirm={(selected) => setRecipients(selected)}
      />

      {/* Modale conferma eliminazione */}
      <Modal
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title="Elimina campagna"
      >
        <div className="space-y-4">
          <p className="text-slate-700">
            Vuoi davvero eliminare la campagna <strong>{campaign?.name}</strong>? L'operazione non è
            reversibile.
          </p>
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setConfirmDeleteOpen(false)}
            >
              Annulla
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Elimina
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
