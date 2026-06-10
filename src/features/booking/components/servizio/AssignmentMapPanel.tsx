import type { FC } from 'react'
import { useMemo, useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { Users, LogOut, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui'
import { useServiceSlots } from '@/features/booking/hooks/useServiceSlots'
import {
  useTableAssignments,
  useUnassignedBookings,
  useAcceptedBookingsForDate,
  useAssignBookingToTable,
  useCheckoutTable,
  getTableStatus,
  type TableStatus,
} from '@/features/booking/hooks/useTableAssignments'
import { getAccurateStartTime, trimTimeToHHmm } from '@/features/booking/utils/dateUtils'
import type { RestaurantTable } from '@/features/booking/hooks/useServizioTables'
import type { Room } from '@/features/booking/hooks/useRooms'
import type { BookingRequest } from '@/types/booking'

// ─────────────────────────────────────────────
// Colori stato tavolo
// ─────────────────────────────────────────────

const STATUS_CLASSES: Record<TableStatus, string> = {
  free: 'bg-emerald-100 border-emerald-300',
  assigned: 'bg-amber-100 border-amber-400',
  checked_out: 'bg-gray-100 border-gray-300',
}

const STATUS_LABEL: Record<TableStatus, string> = {
  free: 'Libero',
  assigned: 'Occupato',
  checked_out: 'Liberato',
}

// ─────────────────────────────────────────────
// DraggableBookingCard
// ─────────────────────────────────────────────

interface DraggableBookingCardProps {
  booking: BookingRequest
}

const DraggableBookingCard: FC<DraggableBookingCardProps> = ({ booking }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `booking-${booking.id}`,
    data: { bookingId: booking.id },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex cursor-grab items-center gap-2 rounded-lg border border-(--color-border) bg-surface px-3 py-2.5 shadow-sm active:cursor-grabbing ${isDragging ? 'opacity-50' : ''}`}
    >
      <GripVertical className="h-4 w-4 shrink-0 text-(--color-text-muted)" aria-hidden />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-primary-900">{booking.client_name}</p>
        <p className="flex items-center gap-1 text-xs text-(--color-text-muted)">
          <Users className="h-3 w-3" aria-hidden />
          {booking.num_guests} coperti
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// DroppableTable
// ─────────────────────────────────────────────

interface DroppableTableProps {
  table: RestaurantTable
  status: TableStatus
  assignedBooking: BookingRequest | null
  onCheckout: () => void
  isCheckingOut: boolean
}

const DroppableTable: FC<DroppableTableProps> = ({ table, status, assignedBooking, onCheckout, isCheckingOut }) => {
  const arrivalTime = assignedBooking
    ? trimTimeToHHmm(getAccurateStartTime(assignedBooking)) || null
    : null
  const [confirmCheckout, setConfirmCheckout] = useState(false)

  const { setNodeRef, isOver } = useDroppable({
    id: `table-${table.id}`,
    data: { tableId: table.id },
  })

  return (
    <div
      ref={setNodeRef}
      className={`relative flex min-h-[80px] flex-col justify-between rounded-xl border-2 p-3 transition-colors ${STATUS_CLASSES[status]} ${isOver ? 'ring-2 ring-primary-400 ring-offset-1' : ''}`}
    >
      <div className="flex items-start justify-between gap-1">
        <div>
          <p className="text-sm font-semibold text-primary-900">{table.name}</p>
          <p className="text-xs text-(--color-text-muted)">{table.capacity} posti</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          status === 'free' ? 'bg-emerald-200 text-emerald-800' :
          status === 'assigned' ? 'bg-amber-200 text-amber-800' :
          'bg-gray-200 text-gray-700'
        }`}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      {status === 'assigned' && assignedBooking && (
        <div className="mt-2 space-y-1">
          <p className="truncate text-xs font-medium text-amber-900">
            {assignedBooking.client_name}, {assignedBooking.num_guests}
          </p>
          {arrivalTime && (
            <p className="text-xs text-amber-800">{arrivalTime}</p>
          )}
          {confirmCheckout ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-red-700">Liberare?</span>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={isCheckingOut}
                onClick={onCheckout}
              >
                Sì
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmCheckout(false)}
              >
                No
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmCheckout(true)}
              className="flex items-center gap-1 text-xs"
            >
              <LogOut className="h-3 w-3" aria-hidden />
              Libera tavolo
            </Button>
          )}
        </div>
      )}

      {isOver && status !== 'assigned' && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-primary-100/50">
          <p className="text-xs font-semibold text-primary-700">Rilascia qui</p>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Componente principale
// ─────────────────────────────────────────────

interface AssignmentMapPanelProps {
  rooms: Room[]
  tables: RestaurantTable[]
}

export const AssignmentMapPanel: FC<AssignmentMapPanelProps> = ({ rooms, tables }) => {
  const today = new Date().toISOString().slice(0, 10)

  const [selectedDate, setSelectedDate] = useState(today)
  const [selectedSlotId, setSelectedSlotId] = useState<string>('')

  const { data: slots = [] } = useServiceSlots()
  const selectedSlot = slots.find((s) => s.id === selectedSlotId) ?? null

  const { data: assignments = [] } = useTableAssignments(selectedDate)
  const { data: unassigned = [] } = useUnassignedBookings(selectedDate, selectedSlot)
  const { data: acceptedOnDate = [] } = useAcceptedBookingsForDate(selectedDate)

  const bookingsById = useMemo(
    () => new Map(acceptedOnDate.map((b) => [b.id, b])),
    [acceptedOnDate],
  )

  const assignBooking = useAssignBookingToTable()
  const checkoutTable = useCheckoutTable()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return

    const bookingId = String(active.id).replace('booking-', '')
    const tableId = String(over.id).replace('table-', '')

    if (!selectedSlot) return

    assignBooking.mutate({
      bookingId,
      tableId,
      slotId: selectedSlotId,
      date: selectedDate,
      maxTurns: selectedSlot.max_turns,
      existingAssignments: assignments,
    })
  }

  const allTables = tables

  return (
    <div className="space-y-4 rounded-xl border border-(--color-border) bg-surface p-4 shadow-sm">
      <div>
        <h3 className="text-title-card font-semibold text-primary-900">Assegnazione tavoli</h3>
        <p className="mt-0.5 text-body text-(--color-text-muted)">
          Trascina una prenotazione su un tavolo per assegnarla.
        </p>
      </div>

      {/* Selettore data + fascia */}
      <div className="flex flex-wrap gap-3">
        <div className="space-y-1">
          <label htmlFor="assign-date" className="block text-xs font-medium text-primary-900">
            Data
          </label>
          <input
            id="assign-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="assign-slot" className="block text-xs font-medium text-primary-900">
            Fascia oraria
          </label>
          <select
            id="assign-slot"
            value={selectedSlotId}
            onChange={(e) => setSelectedSlotId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">— Seleziona fascia —</option>
            {slots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)})
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selectedSlotId && (
        <p className="text-sm text-(--color-text-muted)">Seleziona una fascia per vedere le prenotazioni e la mappa.</p>
      )}

      {selectedSlotId && (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-4">
            {/* Panel sinistro: prenotazioni non assegnate */}
            <div className="w-1/3 shrink-0 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-(--color-text-muted)">
                Prenotazioni ({unassigned.length})
              </p>
              {unassigned.length === 0 && (
                <p className="rounded-lg border border-dashed border-(--color-border) px-3 py-4 text-center text-xs text-(--color-text-muted)">
                  Nessuna prenotazione da assegnare.
                </p>
              )}
              {unassigned.map((b) => (
                <DraggableBookingCard key={b.id} booking={b} />
              ))}
            </div>

            {/* Panel destro: mappa tavoli con drop-zone */}
            <div className="flex-1 space-y-3">
              {rooms.map((room) => {
                const roomTables = allTables.filter((t) => t.room_id === room.id)
                if (roomTables.length === 0) return null
                return (
                  <div key={room.id}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-(--color-text-muted)">
                      {room.name}
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {roomTables.map((table) => {
                        const status = getTableStatus(table.id, assignments, selectedSlotId, selectedDate)
                        const activeAssignment = assignments.find(
                          (a) =>
                            a.table_id === table.id &&
                            a.service_slot_id === selectedSlotId &&
                            a.date === selectedDate &&
                            a.checked_out_at === null,
                        ) ?? null

                        return (
                          <DroppableTable
                            key={table.id}
                            table={table}
                            status={status}
                            assignedBooking={
                              activeAssignment
                                ? bookingsById.get(activeAssignment.booking_id) ?? null
                                : null
                            }
                            isCheckingOut={checkoutTable.isPending}
                            onCheckout={() =>
                              checkoutTable.mutate({
                                tableId: table.id,
                                slotId: selectedSlotId,
                                date: selectedDate,
                                assignments,
                              })
                            }
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {rooms.length === 0 && (
                <p className="text-sm text-(--color-text-muted)">Nessuna sala configurata.</p>
              )}
            </div>
          </div>
        </DndContext>
      )}
    </div>
  )
}
