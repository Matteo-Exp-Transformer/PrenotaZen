import type { FC, FormEvent } from 'react'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Modal, Button, Input } from '@/components/ui'
import { useCreateRoom, useUpdateRoom, useDeleteRoom } from '@/features/booking/hooks/useRooms'
import type { Room } from '@/features/booking/hooks/useRooms'
import { DiscardChangesConfirmModal } from '@/features/booking/components/settings/SettingsSaveUi'
import { useUnsavedChangesGuard } from '@/contexts/UnsavedChangesContext'

const UNSAVED_SOURCE_ID = 'servizio-room-modal'

interface RoomConfigModalProps {
  isOpen: boolean
  onClose: () => void
  /** Sala da modificare. Null = modalità creazione. */
  initial?: Room | null
  /** Numero di tavoli attivi assegnati alla sala corrente (per soft-block eliminazione). */
  tableCount?: number
}

function normalizeRoomDraft(input: {
  name: string
  width: string
  height: string
  displayOrder: string
}) {
  return {
    name: input.name.trim(),
    width: input.width,
    height: input.height,
    displayOrder: input.displayOrder,
  }
}

export const RoomConfigModal: FC<RoomConfigModalProps> = ({
  isOpen,
  onClose,
  initial,
  tableCount = 0,
}) => {
  const isEdit = Boolean(initial)

  const [name, setName] = useState(initial?.name ?? '')
  const [width, setWidth] = useState(String(initial?.width ?? 800))
  const [height, setHeight] = useState(String(initial?.height ?? 600))
  const [displayOrder, setDisplayOrder] = useState(String(initial?.display_order ?? 0))
  const [validationError, setValidationError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [baseline, setBaseline] = useState(() =>
    normalizeRoomDraft({ name: '', width: '800', height: '600', displayOrder: '0' }),
  )
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const {
    registerUnsavedSource,
    registerUnsavedHandlers,
    clearUnsavedSource,
  } = useUnsavedChangesGuard()

  useEffect(() => {
    if (isOpen) {
      const next = normalizeRoomDraft({
        name: initial?.name ?? '',
        width: String(initial?.width ?? 800),
        height: String(initial?.height ?? 600),
        displayOrder: String(initial?.display_order ?? 0),
      })
      setName(next.name)
      setWidth(next.width)
      setHeight(next.height)
      setDisplayOrder(next.displayOrder)
      setBaseline(next)
      setValidationError(null)
      setConfirmDelete(false)
      setDiscardConfirmOpen(false)
    }
  }, [isOpen, initial])

  const createRoom = useCreateRoom()
  const updateRoom = useUpdateRoom()
  const deleteRoom = useDeleteRoom()

  const isPending = createRoom.isPending || updateRoom.isPending || deleteRoom.isPending

  const isDirty = useMemo(
    () =>
      normalizeRoomDraft({ name, width, height, displayOrder }).name !== baseline.name ||
      normalizeRoomDraft({ name, width, height, displayOrder }).width !== baseline.width ||
      normalizeRoomDraft({ name, width, height, displayOrder }).height !== baseline.height ||
      normalizeRoomDraft({ name, width, height, displayOrder }).displayOrder !== baseline.displayOrder,
    [baseline, displayOrder, height, name, width],
  )

  const confirmDiscardClose = useCallback(() => {
    setDiscardConfirmOpen(false)
    clearUnsavedSource(UNSAVED_SOURCE_ID)
    onClose()
  }, [clearUnsavedSource, onClose])

  const requestClose = useCallback(() => {
    if (isPending) return
    if (isDirty) {
      setDiscardConfirmOpen(true)
      return
    }
    onClose()
  }, [isDirty, isPending, onClose])

  useEffect(() => {
    if (!isOpen || !isDirty) {
      clearUnsavedSource(UNSAVED_SOURCE_ID)
      return
    }
    registerUnsavedSource(UNSAVED_SOURCE_ID, isEdit ? 'Configura sala' : 'Nuova sala', true)
    return () => clearUnsavedSource(UNSAVED_SOURCE_ID)
  }, [clearUnsavedSource, isDirty, isEdit, isOpen, registerUnsavedSource])

  useEffect(() => {
    if (!isOpen || !isDirty) {
      registerUnsavedHandlers(UNSAVED_SOURCE_ID, null)
      return
    }
    registerUnsavedHandlers(UNSAVED_SOURCE_ID, {
      saveAll: () => {
        formRef.current?.requestSubmit()
      },
      discardAll: confirmDiscardClose,
    })
    return () => registerUnsavedHandlers(UNSAVED_SOURCE_ID, null)
  }, [confirmDiscardClose, isDirty, isOpen, registerUnsavedHandlers])

  function validate(): string | null {
    if (!name.trim()) return 'Il nome della sala è obbligatorio.'
    const w = Number(width)
    const h = Number(height)
    if (isNaN(w) || w < 200) return 'La larghezza deve essere almeno 200.'
    if (isNaN(h) || h < 200) return "L'altezza deve essere almeno 200."
    if (w > 2000) return 'La larghezza non può superare 2000.'
    if (h > 2000) return "L'altezza non può superare 2000."
    return null
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const err = validate()
    if (err) {
      setValidationError(err)
      return
    }
    setValidationError(null)

    const input = {
      name: name.trim(),
      width: Number(width),
      height: Number(height),
      display_order: Number(displayOrder),
    }

    if (isEdit && initial) {
      updateRoom.mutate({ id: initial.id, input }, { onSuccess: onClose })
    } else {
      createRoom.mutate(input, { onSuccess: onClose })
    }
  }

  function handleDelete() {
    if (!initial) return
    // Soft-block: se ci sono tavoli assegnati, non eliminare
    if (tableCount > 0) {
      setValidationError(
        `Impossibile eliminare: ${tableCount} tavol${tableCount === 1 ? 'o ancora assegnato' : 'i ancora assegnati'} a questa sala. Rimuovi o riassegna i tavoli prima di eliminare.`,
      )
      setConfirmDelete(false)
      return
    }
    deleteRoom.mutate(initial.id, { onSuccess: onClose })
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={requestClose}
        title={isEdit ? 'Configura sala' : 'Nuova sala'}
        size="sm"
        closeOnOverlayClick={!isPending}
        closeOnEscape={!isPending}
      >
        <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="room-name" className="block text-sm font-medium text-primary-900">
              Nome sala
            </label>
            <Input
              id="room-name"
              type="text"
              placeholder="Es. Sala interna"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="room-width" className="block text-sm font-medium text-primary-900">
                Larghezza (px)
              </label>
              <Input
                id="room-width"
                type="number"
                min={200}
                max={2000}
                step={1}
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="room-height" className="block text-sm font-medium text-primary-900">
                Altezza (px)
              </label>
              <Input
                id="room-height"
                type="number"
                min={200}
                max={2000}
                step={1}
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="room-order" className="block text-sm font-medium text-primary-900">
              Ordine visualizzazione
            </label>
            <Input
              id="room-order"
              type="number"
              min={0}
              step={1}
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              disabled={isPending}
            />
          </div>

          {validationError && (
            <p className="text-sm text-red-600" role="alert">
              {validationError}
            </p>
          )}

          <div className="flex justify-between gap-2 pt-1">
            <div>
              {isEdit && !confirmDelete && (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={isPending}
                  onClick={() => setConfirmDelete(true)}
                >
                  Elimina sala
                </Button>
              )}
              {isEdit && confirmDelete && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600">Eliminare?</span>
                  <Button type="button" variant="danger" size="sm" disabled={isPending} onClick={handleDelete}>
                    Sì
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                    No
                  </Button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={requestClose} disabled={isPending}>
                Annulla
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={isPending}>
                {isPending ? 'Salvataggio…' : isEdit ? 'Salva' : 'Crea sala'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      <DiscardChangesConfirmModal
        isOpen={discardConfirmOpen}
        onStay={() => setDiscardConfirmOpen(false)}
        onDiscard={confirmDiscardClose}
      />
    </>
  )
}
