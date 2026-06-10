import type { FC, FormEvent } from 'react'
import { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { Modal, Button, Input } from '@/components/ui'
import { useCreateTable, useUpdateTable } from '@/features/booking/hooks/useServizioTables'
import type { Room } from '@/features/booking/hooks/useRooms'

export interface TableFormModalProps {
  isOpen: boolean
  onClose: () => void
  rooms: Room[]
  /** Sala preselezionata alla apertura in modalità "aggiungi" (id della sala). */
  defaultRoomId?: string
  initial?: { id: string; name: string; capacity: number; room_id: string } | null
}

export const TableFormModal: FC<TableFormModalProps> = ({ isOpen, onClose, rooms, defaultRoomId, initial }) => {
  const isEdit = Boolean(initial)

  const firstRoomId = rooms[0]?.id ?? ''

  const [name, setName] = useState(initial?.name ?? '')
  const [capacity, setCapacity] = useState(String(initial?.capacity ?? ''))
  const [roomId, setRoomId] = useState(initial?.room_id ?? defaultRoomId ?? firstRoomId)
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setName(initial?.name ?? '')
      setCapacity(String(initial?.capacity ?? ''))
      setRoomId(initial?.room_id ?? defaultRoomId ?? rooms[0]?.id ?? '')
      setValidationError(null)
    }
  }, [isOpen, initial, defaultRoomId, rooms])

  const createTable = useCreateTable()
  const updateTable = useUpdateTable()

  const isPending = createTable.isPending || updateTable.isPending

  function validate(): string | null {
    if (!name.trim()) return 'Il nome del tavolo è obbligatorio.'
    const cap = Number(capacity)
    if (!capacity || isNaN(cap) || cap <= 0 || !Number.isInteger(cap)) return 'La capienza deve essere un intero maggiore di zero.'
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
      updateTable.mutate(
        { id: initial.id, input },
        { onSuccess: onClose },
      )
    } else {
      createTable.mutate(input, { onSuccess: onClose })
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Modifica tavolo' : 'Aggiungi tavolo'}
      size="sm"
    >
      {rooms.length === 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Devi creare almeno una sala prima di aggiungere un tavolo. Vai nella tab <strong>Mappa</strong> e usa "Nuova sala".
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Nome tavolo */}
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

        {/* Capienza */}
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

        {/* Sala — obbligatoria */}
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

        {/* Errore validazione */}
        {validationError && (
          <p className="text-sm text-red-600" role="alert">
            {validationError}
          </p>
        )}

        {/* Azioni */}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Annulla
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={isPending || rooms.length === 0}>
            {isPending ? 'Salvataggio…' : isEdit ? 'Salva modifiche' : 'Aggiungi'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
