import React, { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { SpinnerGapIcon } from '@phosphor-icons/react/dist/csr/SpinnerGap'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import type { AutosaveFieldStatus } from '@/features/booking/hooks/useDebouncedSettingsAutosave'

const saveFooterShellClass =
  'restaurant-settings-save-footer admin-warm-surface sticky bottom-0 z-[85] ml-auto flex w-[50%] min-w-0 flex-col gap-2 rounded-tl-xl border border-b-0 border-slate-200/90 px-3 py-2.5 shadow-lg backdrop-blur-sm max-sm:bg-white/90 sm:px-4 sm:py-3 pb-[max(0.625rem,env(safe-area-inset-bottom))]'

/** Indicatore discreto sotto un campo con autosave. */
export function FieldAutosaveIndicator({ status }: { status: AutosaveFieldStatus }) {
  if (status === 'idle') return null
  return (
    <p
      className={cn(
        'mt-1 text-center text-[11px] font-medium leading-snug',
        status === 'error' ? 'text-red-600' : 'text-slate-500',
      )}
      aria-live="polite"
    >
      {status === 'pending' || status === 'saving' ? (
        <span className="inline-flex items-center justify-center gap-1">
          <SpinnerGapIcon weight="regular" className="h-3 w-3 animate-spin" aria-hidden />
          Salvataggio…
        </span>
      ) : status === 'saved' ? (
        'Salvato'
      ) : (
        'Errore salvataggio'
      )}
    </p>
  )
}

/** Salva / annulla sopra la card, allineati a destra con spazio sotto i pulsanti. */
export function FormSectionFloatingActions({
  actions,
  children,
}: {
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex w-full flex-col gap-3">
      {actions != null && <div className="flex w-full justify-end">{actions}</div>}
      {children}
    </div>
  )
}

const SectionSaveButton: React.FC<{
  onClick: () => void
  disabled?: boolean
  pending?: boolean
}> = ({ onClick, disabled, pending }) => (
  <Button
    type="button"
    size="sm"
    onClick={onClick}
    disabled={disabled || pending}
    className="border-2 border-primary-700 bg-primary-600 px-4 py-1.5 text-sm shadow-sm hover:bg-primary-500 hover:border-primary-600 disabled:opacity-60"
  >
    {pending ? (
      <span className="flex items-center gap-1.5">
        <SpinnerGapIcon weight="regular" className="h-3.5 w-3.5 animate-spin" />
        Salvataggio…
      </span>
    ) : (
      'Salva'
    )}
  </Button>
)

/** Annulla + Salva per una sola sezione (card/modulo). Editor sottotab: solo «Annulla» bozza; persist dal footer. */
export const SectionActionBar: React.FC<{
  onCancel: () => void
  onSave: () => void
  cancelDisabled?: boolean
  saveDisabled?: boolean
  pending?: boolean
}> = ({ onCancel, onSave, cancelDisabled, saveDisabled, pending }) => (
  <div className="flex flex-wrap items-center justify-end gap-2">
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onCancel}
      disabled={cancelDisabled || pending}
    >
      Annulla modifiche
    </Button>
    <SectionSaveButton onClick={onSave} disabled={saveDisabled} pending={pending} />
  </div>
)

export type SettingsSaveFooterProps = {
  onCancel: () => void
  onSave: () => void | Promise<void>
  pending?: boolean
  cancelDisabled?: boolean
  saveDisabled?: boolean
  className?: string
  /** Se true (default), «Annulla tutte» apre modale di conferma (FU-003). */
  confirmDiscard?: boolean
}

/** Footer compatto in basso a destra (~50% larghezza): modifiche non salvate + Salva / Annulla tutte. */
export function SettingsSaveFooter({
  onCancel,
  onSave,
  pending = false,
  cancelDisabled = false,
  saveDisabled = false,
  className,
  confirmDiscard = true,
}: SettingsSaveFooterProps) {
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)

  const handleCancelClick = () => {
    if (confirmDiscard) {
      setDiscardConfirmOpen(true)
      return
    }
    onCancel()
  }

  const handleConfirmDiscard = () => {
    setDiscardConfirmOpen(false)
    onCancel()
  }

  return (
    <>
      <div className={cn(saveFooterShellClass, className)} role="region" aria-label="Modifiche non salvate">
        <p
          className="text-center text-xs font-semibold leading-snug text-slate-800 sm:text-sm"
          style={{ color: 'var(--color-text)', WebkitTextFillColor: 'var(--color-text)' }}
        >
          Modifiche non salvate
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleCancelClick}
            disabled={cancelDisabled || pending}
            className="min-h-9 border-slate-300 px-3 font-semibold"
          >
            Annulla tutte
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void Promise.resolve(onSave())}
            disabled={saveDisabled || pending}
            className="min-h-9 border-2 border-primary-700 bg-primary-600 px-4 font-semibold shadow-sm hover:bg-primary-500 disabled:opacity-60"
          >
            {pending ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                Salvataggio…
              </span>
            ) : (
              'Salva modifiche'
            )}
          </Button>
        </div>
      </div>

      <Modal
        isOpen={discardConfirmOpen}
        onClose={() => setDiscardConfirmOpen(false)}
        title="Annullare tutte le modifiche?"
        size="md"
        showCloseButton
        closeOnOverlayClick
        closeOnEscape
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Le modifiche non salvate verranno perse. Vuoi continuare?
          </p>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" size="sm" onClick={() => setDiscardConfirmOpen(false)}>
              Resta qui
            </Button>
            <Button type="button" variant="danger" size="sm" onClick={handleConfirmDiscard}>
              Annulla tutte
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

export type DiscardChangesConfirmModalProps = {
  isOpen: boolean
  onStay: () => void
  onDiscard: () => void
  title?: string
  message?: string
  stayLabel?: string
  discardLabel?: string
}

/** Conferma perdita modifiche (chiusura modale / overlay con draft aperto). */
export function DiscardChangesConfirmModal({
  isOpen,
  onStay,
  onDiscard,
  title = 'Annullare le modifiche?',
  message = 'Le modifiche non salvate verranno perse. Vuoi continuare?',
  stayLabel = 'Resta qui',
  discardLabel = 'Annulla modifiche',
}: DiscardChangesConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onStay}
      title={title}
      size="md"
      showCloseButton
      closeOnOverlayClick
      closeOnEscape
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{message}</p>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" size="sm" onClick={onStay}>
            {stayLabel}
          </Button>
          <Button type="button" variant="danger" size="sm" onClick={onDiscard}>
            {discardLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export type PublicDataSaveConfirmModalProps = {
  isOpen: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  pending?: boolean
}

/**
 * Modale di conferma prima di salvare dati visibili in Pagina Prenota (FU-005).
 * Appare quando il footer «Salva modifiche» viene premuto su campi pubblici.
 */
export function PublicDataSaveConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  pending = false,
}: PublicDataSaveConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={pending ? () => undefined : onCancel}
      title="Salva modifiche pubbliche?"
      size="md"
      showCloseButton={!pending}
      closeOnOverlayClick={!pending}
      closeOnEscape={!pending}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Le modifiche che stai salvando saranno{' '}
          <strong className="font-semibold text-slate-800">immediatamente visibili ai clienti</strong>{' '}
          nella Pagina Prenota pubblica.
        </p>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onCancel}>
            Annulla
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => void Promise.resolve(onConfirm())}
          >
            {pending ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Salvataggio…
              </span>
            ) : (
              'Salva'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export type DestructiveActionConfirmModalProps = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: React.ReactNode
  cancelLabel?: string
  confirmLabel?: string
  pending?: boolean
  size?: 'sm' | 'md'
}

/** Conferma azioni distruttive in Impostazioni (delete card, promo, fascia oraria, …). */
export function DestructiveActionConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  cancelLabel = 'Annulla',
  confirmLabel = 'Elimina',
  pending = false,
  size = 'sm',
}: DestructiveActionConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={pending ? () => undefined : onClose}
      title={title}
      size={size}
      showCloseButton={!pending}
      closeOnOverlayClick={!pending}
      closeOnEscape={!pending}
    >
      <div className="space-y-4">
        <div className="text-sm text-slate-700">{message}</div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="danger" size="sm" disabled={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export type UnsavedNavigationGuardModalProps = {
  isOpen: boolean
  dirtyLabels: string[]
  pending: boolean
  onStay: () => void
  onSaveAndContinue: () => void
  onDiscardAndContinue: () => void
}

/** Modale guard navigazione: Resta qui | Salva e continua | Annulla e continua. */
export function UnsavedNavigationGuardModal({
  isOpen,
  dirtyLabels,
  pending,
  onStay,
  onSaveAndContinue,
  onDiscardAndContinue,
}: UnsavedNavigationGuardModalProps) {
  const sectionHint =
    dirtyLabels.length > 0 ? ` Sezioni: ${dirtyLabels.join(', ')}.` : ''

  return (
    <Modal
      isOpen={isOpen}
      onClose={pending ? () => undefined : onStay}
      title="Modifiche non salvate"
      size="md"
      showCloseButton={!pending}
      closeOnOverlayClick={!pending}
      closeOnEscape={!pending}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Hai modifiche non salvate.{sectionHint} Cosa vuoi fare prima di cambiare schermata?
        </p>
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onStay}>
            Resta qui
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={pending}
            onClick={onSaveAndContinue}
          >
            {pending ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Salvataggio…
              </span>
            ) : (
              'Salva e continua'
            )}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={onDiscardAndContinue}
          >
            Annulla e continua
          </Button>
        </div>
      </div>
    </Modal>
  )
}
