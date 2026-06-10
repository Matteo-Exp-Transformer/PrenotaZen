import { useState, useMemo } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useRooms } from '../hooks/useRooms'
import { useTables } from '../hooks/useServizioTables'
import { useServiceSlots } from '../hooks/useServiceSlots'
import {
  useAssignBookingToTable,
  useReleaseBookingAssignment,
  type BookingTableAssignment,
  type ReleaseBlockedReason,
  getTableStatus,
} from '../hooks/useTableAssignments'
import { bookingStartsInServiceSlot } from '../utils/serviceSlotBookingFilter'
import type { BookingRequest } from '@/types/booking'
import { cn } from '@/lib/utils'

interface Props {
  booking: BookingRequest
  date: string
  /** true = già assegnata, apre fase di conferma prima della selezione sala/tavolo */
  mode: 'assign' | 'reassign'
  tableAssignments: BookingTableAssignment[]
  onClose: () => void
}

export function QuickTableAssignModal({ booking, date, mode, tableAssignments, onClose }: Props) {
  const { data: rooms = [] } = useRooms()
  const { data: allTables = [] } = useTables()
  const { data: freshSlots = [] } = useServiceSlots()
  const assign = useAssignBookingToTable()
  const release = useReleaseBookingAssignment()

  // Fase del flusso reassign: 'confirm' → attende conferma; 'select' → mostra sala/tavolo
  const [reassignPhase, setReassignPhase] = useState<'confirm' | 'select'>(
    mode === 'reassign' ? 'confirm' : 'select',
  )
  const [blockedReason, setBlockedReason] = useState<ReleaseBlockedReason | null>(null)
  const [selectedRoomId, setSelectedRoomId] = useState<string>('')

  const derivedSlot = useMemo(
    () => freshSlots.find((s) => bookingStartsInServiceSlot(booking, s.start_time, s.end_time)) ?? null,
    [booking, freshSlots],
  )

  // Tavolo attualmente assegnato alla prenotazione (per mostrarlo nella fase confirm)
  const currentAssignment = useMemo(
    () =>
      tableAssignments.find(
        (a) =>
          a.booking_id === booking.id &&
          (derivedSlot ? a.service_slot_id === derivedSlot.id : true) &&
          a.date === date &&
          a.checked_out_at === null,
      ) ?? null,
    [tableAssignments, booking.id, derivedSlot, date],
  )

  const currentTableName = useMemo(() => {
    if (!currentAssignment) return null
    return allTables.find((t) => t.id === currentAssignment.table_id)?.name ?? null
  }, [currentAssignment, allTables])

  const tablesInRoom = useMemo(
    () => allTables.filter((t) => t.room_id === selectedRoomId),
    [allTables, selectedRoomId],
  )

  const noConfig = rooms.length === 0 || allTables.length === 0

  function handleConfirmReassign() {
    if (!derivedSlot) return
    release.mutate(
      { bookingId: booking.id, slotId: derivedSlot.id, date, assignments: tableAssignments },
      {
        onSuccess: (result) => {
          if (result?.blocked) {
            setBlockedReason(result.blocked)
          } else {
            setReassignPhase('select')
          }
        },
      },
    )
  }

  function handleAssign(tableId: string) {
    if (!derivedSlot) return
    assign.mutate(
      {
        bookingId: booking.id,
        tableId,
        slotId: derivedSlot.id,
        date,
        maxTurns: derivedSlot.max_turns,
        existingAssignments: tableAssignments,
      },
      { onSuccess: onClose },
    )
  }

  const title = mode === 'reassign' ? 'Modifica tavolo' : 'Assegna tavolo'

  return (
    <Modal isOpen onClose={onClose} title={title} size="md">
      {/* Fase blocco turni in coda (provvisorio) */}
      {blockedReason === 'waiting_next_turn' && (
        <div className="space-y-4 py-2">
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Questo tavolo ha turni successivi in attesa: gestisci la modifica da{' '}
            <strong>Servizio → Mappa</strong>.
          </p>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={onClose}>
              Chiudi
            </Button>
          </div>
        </div>
      )}

      {/* Fase conferma riassegnazione */}
      {!blockedReason && reassignPhase === 'confirm' && (
        <div className="space-y-4 py-2">
          <p className="text-sm text-primary-900">
            Vuoi modificare il tavolo assegnato a{' '}
            <strong>{booking.client_name}</strong>?
            {currentTableName && (
              <span className="text-(--color-text-muted)"> Ora è al tavolo {currentTableName}.</span>
            )}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={release.isPending}>
              Annulla
            </Button>
            <Button variant="primary" onClick={handleConfirmReassign} disabled={release.isPending}>
              {release.isPending ? 'Liberando…' : 'Conferma'}
            </Button>
          </div>
        </div>
      )}

      {/* Fase selezione sala e tavolo */}
      {!blockedReason && reassignPhase === 'select' && (
        <>
          {noConfig ? (
            <p className="py-4 text-sm text-(--color-text-muted)">
              Configura sale e tavoli nella pagina Servizio prima di usare questa funzione.
            </p>
          ) : (
            <div className="space-y-4">
              {!derivedSlot && (
                <p className="rounded-lg border border-(--color-border) bg-(--color-surface-2) px-3 py-2 text-sm text-(--color-text-muted)">
                  Orario della prenotazione non riconducibile a nessuna fascia configurata.
                </p>
              )}

              {/* Selezione sala */}
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-primary-900">Sala</p>
                <div className="flex flex-wrap gap-2">
                  {rooms.map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => setSelectedRoomId(room.id)}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                        selectedRoomId === room.id
                          ? 'border-primary-400 bg-primary-50 text-primary-900'
                          : 'border-(--color-border) bg-surface text-primary-900 hover:bg-primary-50',
                      )}
                    >
                      {room.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Griglia tavoli */}
              {selectedRoomId && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-primary-900">Tavolo</p>
                  {tablesInRoom.length === 0 ? (
                    <p className="text-sm text-(--color-text-muted)">Nessun tavolo in questa sala.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {tablesInRoom.map((table) => {
                        const status = derivedSlot
                          ? getTableStatus(table.id, tableAssignments, derivedSlot.id, date)
                          : 'free'
                        const occupied = status === 'assigned'
                        return (
                          <button
                            key={table.id}
                            type="button"
                            disabled={occupied || !derivedSlot || assign.isPending}
                            onClick={() => handleAssign(table.id)}
                            className={cn(
                              'rounded-xl border px-2 py-3 text-center text-sm font-medium transition-colors',
                              occupied
                                ? 'cursor-not-allowed border-(--color-border) bg-(--color-surface-2) text-(--color-text-muted) opacity-60'
                                : 'border-primary-200 bg-primary-50 text-primary-900 hover:bg-primary-100',
                            )}
                          >
                            <span className="block truncate">{table.name}</span>
                            <span className="block text-[11px] font-normal opacity-70">
                              {table.capacity} posti
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button variant="ghost" onClick={onClose}>
                  Annulla
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
