import type { FC, FormEvent } from 'react'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { AlertCircle } from 'lucide-react'
import { Modal, Button, Input } from '@/components/ui'
import { useCreateTable, useUpdateTable } from '@/features/booking/hooks/useServizioTables'
import type { Room } from '@/features/booking/hooks/useRooms'
import { DiscardChangesConfirmModal } from '@/features/booking/components/settings/SettingsSaveUi'
import { useUnsavedChangesGuard } from '@/contexts/UnsavedChangesContext'

const UNSAVED_SOURCE_ID = 'servizio-table-modal'

export interface TableFormModalProps {
  isOpen: boolean
  onClose: () => void
  rooms: Room[]
  /** Sala preselezionata alla apertura in modalità "aggiungi" (id della sala). */
  defaultRoomId?: string
  initial?: { id: string; name: string; capacity: number; room_id: string } | null
}

function normalizeTableDraft(input: { name: string; capacity: string; roomId: string }) {
  return {
    name: input.name.trim(),
    capacity: input.capacity,
    roomId: input.roomId,
  }
}

export const TableFormModal: FC<TableFormModalProps> = ({
  isOpen,
  onClose,
  rooms,
  defaultRoomId,
  initial,
}) => {
  const isEdit = Boolean(initial)

  const firstRoomId = rooms[0]?.id ?? ''

  const [name, setName] = useState(initial?.name ?? '')
  const [capacity, setCapacity] = useState(String(initial?.capacity ?? ''))
  const [roomId, setRoomId] = useState(initial?.room_id ?? defaultRoomId ?? firstRoomId)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [baseline, setBaseline] = useState(() =>
    normalizeTableDraft({ name: '', capacity: '', roomId: '' }),
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
      const next = normalizeTableDraft({
        name: initial?.name ?? '',
        capacity: String(initial?.capacity ?? ''),
        roomId: initial?.room_id ?? defaultRoomId ?? rooms[0]?.id ?? '',
      })
      setName(next.name)
      setCapacity(next.capacity)
      setRoomId(next.roomId)
      setBaseline(next)
      setValidationError(null)
      setDiscardConfirmOpen(false)
    }
  }, [isOpen, initial, defaultRoomId, rooms])

  const createTable = useCreateTable()
  const updateTable = useUpdateTable()

  const isPending = createTable.isPending || updateTable.isPending

  const isDirty = useMemo(
    () =>
      normalizeTableDraft({ name, capacity, roomId }).name !== baseline.name ||
      normalizeTableDraft({ name, capacity, roomId }).capacity !== baseline.capacity ||
      normalizeTableDraft({ name, capacity, roomId }).roomId !== baseline.roomId,
    [baseline, capacity, name, roomId],
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
    registerUnsavedSource(UNSAVED_SOURCE_ID, isEdit ? 'Modifica tavolo' : 'Aggiungi tavolo', true)
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
    if (!name.trim()) return 'Il nome del tavolo è obbligatorio.'
    const cap = Number(capacity)
    if (!capacity || isNaN(cap) || cap <= 0 || !Number.isInteger(cap))
      return 'La capienza deve essere un intero maggiore di zero.'
    if (rooms.length > 0 && !rooms.find((r) => r.id === roomId)) return 'Seleziona una sala valida.'
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

    const selectedRoom = rooms.find((r) => r.id === roomId)
    const input = {
      name: name.trim(),
      capacity: Number(capacity),
      placement: selectedRoom?.name ?? '',
      room_id: roomId,
    }

    if (isEdit && initial) {
      updateTable.mutate({ id: initial.id, input }, { onSuccess: onClose })
    } else {
      createTable.mutate(input, { onSuccess: onClose })
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={requestClose}
        title={isEdit ? 'Modifica tavolo' : 'Aggiungi tavolo'}
        size="sm"
        closeOnOverlayClick={!isPending}
        closeOnEscape={!isPending}
      >
        {rooms.length === 0 && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              Devi creare almeno una sala prima di aggiungere un tavolo. Vai nella tab <strong>Mappa</strong> e usa
              &quot;Nuova sala&quot;.
            </span>
          </div>
        )}

        <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="table-name" className="block text-sm font-medium text-primary-900">
              Nome tavolo
            </label>
            <Input
              id="table-name"
              type="text"
              placeholder="Es. Tavolo 1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="table-capacity" className="block text-sm font-medium text-primary-900">
              Capienza (posti)
            </label>
            <Input
              id="table-capacity"
              type="number"
              min={1}
              step={1}
              placeholder="Es. 4"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              disabled={isPending}
            />
          </div>

          {rooms.length > 0 && (
            <div className="space-y-1">
              <label htmlFor="table-room" className="block text-sm font-medium text-primary-900">
                Sala <span className="text-red-500">*</span>
              </label>
              <select
                id="table-room"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                disabled={isPending}
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {validationError && (
            <p className="text-sm text-red-600" role="alert">
              {validationError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={requestClose} disabled={isPending}>
              Annulla
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isPending || rooms.length === 0}>
              {isPending ? 'Salvataggio…' : isEdit ? 'Salva modifiche' : 'Aggiungi'}
            </Button>
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
