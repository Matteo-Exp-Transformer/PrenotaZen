import type { FC } from 'react'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Button, Input, Textarea, Label } from '@/components/ui'
import { toast } from 'react-toastify'
import { useUpsertEmailTemplate } from '@/features/booking/hooks/useEmailTemplateMutations'
import { useDeleteEmailTemplate } from '@/features/booking/hooks/useEmailTemplateMutations'
import type { EmailTemplateKey } from '@/features/booking/hooks/useEmailTemplates'
import type { EmailTemplate } from '@/features/booking/hooks/useEmailTemplates'
import { useUnsavedChangesGuard } from '@/contexts/UnsavedChangesContext'

interface Props {
  templateKey: EmailTemplateKey
  saved: EmailTemplate | undefined
  defaultSubject: string
  defaultIntro: string
  defaultClosing: string
  /** Se true, nasconde il campo "closing" (usato per promo). */
  hideClosing?: boolean
  /** Etichetta del blocco (es. "Accetta prenotazione") */
  label: string
  /** Componente anteprima (opzionale). */
  preview?: React.ReactNode
  /** Se true, omette wrapper esterno e titolo h3 — usato dentro CollapsibleCard. */
  bare?: boolean
  /** Chiamato dopo un salvataggio/ripristino riuscito (es. per chiudere la card). */
  onSaved?: () => void
  /** Notifica il parent dello stato dirty (per intercettare la chiusura della card). */
  onDirtyChange?: (dirty: boolean) => void
}

export const EmailTemplateEditor: FC<Props> = ({
  templateKey,
  saved,
  defaultSubject,
  defaultIntro,
  defaultClosing,
  hideClosing = false,
  label,
  preview,
  bare = false,
  onSaved,
  onDirtyChange,
}) => {
  const upsert = useUpsertEmailTemplate()
  const remove = useDeleteEmailTemplate()
  const { registerUnsavedSource, registerUnsavedHandlers, clearUnsavedSource } = useUnsavedChangesGuard()

  const [subject, setSubject] = useState(saved?.subject ?? '')
  const [intro, setIntro] = useState(saved?.intro ?? '')
  const [closing, setClosing] = useState(saved?.closing ?? '')

  // Sincronizza quando arriva il dato dal server
  useEffect(() => {
    setSubject(saved?.subject ?? '')
    setIntro(saved?.intro ?? '')
    setClosing(saved?.closing ?? '')
  }, [saved?.subject, saved?.intro, saved?.closing])

  const dirty = useMemo(
    () =>
      subject !== (saved?.subject ?? '') ||
      intro !== (saved?.intro ?? '') ||
      (!hideClosing && closing !== (saved?.closing ?? '')),
    [subject, intro, closing, saved?.subject, saved?.intro, saved?.closing, hideClosing],
  )

  const guardId = `email-template-${templateKey}`

  const handleSave = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      upsert.mutate(
        {
          template_key: templateKey,
          subject: subject.trim() || null,
          intro: intro.trim() || null,
          closing: hideClosing ? null : closing.trim() || null,
        },
        {
          onSuccess: () => { toast.success(`"${label}" salvato`); resolve(); onSaved?.() },
          onError: (e) => { toast.error(`Errore salvataggio: ${e.message}`); reject(e) },
        },
      )
    })
  }, [upsert, templateKey, subject, intro, closing, hideClosing, label, onSaved])

  const handleDiscard = useCallback(() => {
    setSubject(saved?.subject ?? '')
    setIntro(saved?.intro ?? '')
    setClosing(saved?.closing ?? '')
  }, [saved?.subject, saved?.intro, saved?.closing])

  useEffect(() => {
    registerUnsavedSource(guardId, label, dirty)
    return () => clearUnsavedSource(guardId)
  }, [dirty, guardId, label, registerUnsavedSource, clearUnsavedSource])

  useEffect(() => {
    registerUnsavedHandlers(guardId, { saveAll: handleSave, discardAll: handleDiscard })
    return () => registerUnsavedHandlers(guardId, null)
  }, [guardId, handleSave, handleDiscard, registerUnsavedHandlers])

  // Notifica il parent dello stato dirty (per intercettare la chiusura della card)
  // e azzera alla smontaggio della card collassata.
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  const handleReset = () => {
    remove.mutate(templateKey, {
      onSuccess: () => {
        setSubject('')
        setIntro('')
        setClosing('')
        toast.success(`"${label}" ripristinato ai valori predefiniti`)
        onSaved?.()
      },
      onError: (e) => toast.error(`Errore ripristino: ${e.message}`),
    })
  }

  const fields = (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor={`${templateKey}-subject`}>Oggetto email</Label>
        <Input
          id={`${templateKey}-subject`}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={defaultSubject}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${templateKey}-intro`}>Apertura (dopo "Ciao nome,")</Label>
        <Textarea
          id={`${templateKey}-intro`}
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          placeholder={defaultIntro}
          rows={3}
        />
      </div>

      {!hideClosing && (
        <div className="space-y-1">
          <Label htmlFor={`${templateKey}-closing`}>Chiusura (prima della firma)</Label>
          <Textarea
            id={`${templateKey}-closing`}
            value={closing}
            onChange={(e) => setClosing(e.target.value)}
            placeholder={defaultClosing}
            rows={3}
          />
        </div>
      )}

      {preview && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Anteprima</p>
          {preview}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => void handleSave()}
          disabled={upsert.isPending}
        >
          {upsert.isPending ? 'Salvataggio…' : 'Salva'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleReset}
          disabled={remove.isPending || !saved}
        >
          Ripristina predefinito
        </Button>
      </div>
    </div>
  )

  if (bare) return fields

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="font-semibold text-slate-800 mb-4">{label}</h3>
      {fields}
    </div>
  )
}
