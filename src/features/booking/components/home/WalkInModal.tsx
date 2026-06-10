import type { FC, FormEvent } from 'react'
import { useState, useMemo } from 'react'
import { Modal, Button, Input } from '@/components/ui'
import { useWalkInMutation } from '@/features/booking/hooks/useWalkInMutation'
import { useTables } from '@/features/booking/hooks/useServizioTables'
import { useRooms } from '@/features/booking/hooks/useRooms'
import { useAcceptedBookings } from '@/features/booking/hooks/useBookingQueries'
import { useRestaurantSetting } from '@/features/booking/hooks/useRestaurantSetting'

interface WalkInModalProps {
  isOpen: boolean
  onClose: () => void
}

/** Verifica se un tavolo è occupato ora: almeno una prenotazione accepted con confirmed_start ≤ now < confirmed_end */
function isBusy(tableId: string, acceptedBookings: { placement?: string | null; confirmed_start?: string | null; confirmed_end?: string | null }[]): boolean {
  const now = new Date()
  return acceptedBookings.some((b) => {
    if (b.placement !== tableId) return false
    if (!b.confirmed_start || !b.confirmed_end) return false
    return new Date(b.confirmed_start) <= now && now < new Date(b.confirmed_end)
  })
}

export const WalkInModal: FC<WalkInModalProps> = ({ isOpen, onClose }) => {
  const [clientName, setClientName] = useState('')
  const [numGuests, setNumGuests] = useState('')
  const [selectedRoomId, setSelectedRoomId] = useState<string>('')
  const [selectedTableId, setSelectedTableId] = useState<string>('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const walkIn = useWalkInMutation()
  const { data: tables = [] } = useTables()
  const { data: rooms = [] } = useRooms()
  const { data: acceptedBookings = [] } = useAcceptedBookings()
  const { data: maxGuests = 20 } = useRestaurantSetting('walk_in_max_guests')

  const tablesInRoom = useMemo(() => {
    if (!selectedRoomId) return []
    return tables.filter((t) => t.room_id === selectedRoomId)
  }, [tables, selectedRoomId])

  const tableOptions = useMemo(() => {
    return tablesInRoom.map((t) => ({
      ...t,
      busy: isBusy(t.id, acceptedBookings),
    }))
  }, [tablesInRoom, acceptedBookings])

  function resetForm() {
    setClientName('')
    setNumGuests('')
    setSelectedRoomId('')
    setSelectedTableId('')
    setValidationError(null)
  }

  function validate(): string | null {
    const n = Number(numGuests)
    if (!numGuests || isNaN(n) || n < 1 || n > maxGuests || !Number.isInteger(n)) {
      return `Il numero di coperti deve essere un intero tra 1 e ${maxGuests}.`
    }
    if (rooms.length > 0 && !selectedRoomId) {
      return 'Seleziona una sala.'
    }
    if (selectedRoomId && tablesInRoom.length > 0 && !selectedTableId) {
      return 'Seleziona un tavolo.'
    }
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

    const selectedTable = tables.find((t) => t.id === selectedTableId)
    walkIn.mutate(
      {
        client_name: clientName,
        num_guests: Number(numGuests),
        table_id: selectedTableId || null,
        placement: selectedTable?.name ?? undefined,
      },
      {
        onSuccess: () => {
          resetForm()
          onClose()
        },
      },
    )
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Aggiungi walk-in" size="sm">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Nome cliente */}
        <div className="space-y-1">
          <label htmlFor="walkin-name" className="block text-sm font-medium text-primary-900">
            Nome cliente <span className="text-(--color-text-muted)">(opzionale)</span>
          </label>
          <Input
            id="walkin-name"
            type="text"
            placeholder="Es. Rossi"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            disabled={walkIn.isPending}
            autoFocus
          />
        </div>

        {/* Numero coperti */}
        <div className="space-y-1">
          <label htmlFor="walkin-guests" className="block text-sm font-medium text-primary-900">
            Numero coperti <span className="text-red-500">*</span>
          </label>
          <Input
            id="walkin-guests"
            type="number"
            min={1}
            max={maxGuests}
            step={1}
            placeholder="Es. 2"
            value={numGuests}
            onChange={(e) => setNumGuests(e.target.value)}
            disabled={walkIn.isPending}
          />
        </div>

        {/* Sala */}
        {rooms.length > 0 && (
          <div className="space-y-1">
            <label htmlFor="walkin-room" className="block text-sm font-medium text-primary-900">
              Sala <span className="text-red-500">*</span>
            </label>
            <select
              id="walkin-room"
              value={selectedRoomId}
              onChange={(e) => {
                setSelectedRoomId(e.target.value)
                setSelectedTableId('')
              }}
              disabled={walkIn.isPending}
              className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="">— Seleziona sala —</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Tavolo — mostrato solo se sala selezionata e ha tavoli */}
        {selectedRoomId && tablesInRoom.length > 0 && (
          <div className="space-y-1">
            <label htmlFor="walkin-table" className="block text-sm font-medium text-primary-900">
              Tavolo <span className="text-red-500">*</span>
            </label>
            <select
              id="walkin-table"
              value={selectedTableId}
              onChange={(e) => setSelectedTableId(e.target.value)}
              disabled={walkIn.isPending}
              className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="">— Seleziona tavolo —</option>
              {tableOptions.map((t) => (
                <option key={t.id} value={t.id} disabled={t.busy}>
                  {t.name} ({t.capacity} posti){t.busy ? ' — occupato' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedRoomId && tablesInRoom.length === 0 && (
          <p className="text-sm text-amber-700 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            Nessun tavolo configurato in questa sala.
          </p>
        )}

        {validationError && (
          <p className="text-sm text-red-600" role="alert">
            {validationError}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={walkIn.isPending}>
            Annulla
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={walkIn.isPending}>
            {walkIn.isPending ? 'Aggiunta…' : 'Aggiungi walk-in'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
