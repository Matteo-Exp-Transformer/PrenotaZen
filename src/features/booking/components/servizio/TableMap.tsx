import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui'
import { TableShape } from './TableShape'
import { useUpdateTablePosition } from '@/features/booking/hooks/useServizioTables'
import type { RestaurantTable } from '@/features/booking/hooks/useServizioTables'
import type { Room } from '@/features/booking/hooks/useRooms'

interface TableMapProps {
  room: Room
  tables: RestaurantTable[]
  onEditTable: (table: RestaurantTable) => void
  onAddTable: () => void
}

/** Snap al grid di 10px */
function snapToGrid(value: number): number {
  return Math.round(value / 10) * 10
}

export const TableMap: FC<TableMapProps> = ({ room, tables, onEditTable, onAddTable }) => {
  const { debouncedUpdate } = useUpdateTablePosition()
  const [isMobile, setIsMobile] = useState(false)

  // Rileva mobile via matchMedia — drag disabilitato su schermi stretti
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)')
    setIsMobile(mql.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Richiede uno spostamento minimo di 5px per avviare il drag (evita click accidentali)
      activationConstraint: { distance: 5 },
    }),
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, delta } = event
      const tableId = String(active.id)
      const table = tables.find((t) => t.id === tableId)
      if (!table) return

      const newX = snapToGrid(Math.max(0, table.position_x + delta.x))
      const newY = snapToGrid(Math.max(0, table.position_y + delta.y))
      debouncedUpdate(tableId, newX, newY)
    },
    [tables, debouncedUpdate],
  )

  const roomTables = tables.filter((t) => t.room_id === room.id)

  return (
    <div className="space-y-3">
      {/* Banner mobile */}
      {isMobile && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Modifica layout disponibile da desktop. Su mobile puoi solo visualizzare la mappa.
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-(--color-text-muted)">
          {room.width} × {room.height} px — {roomTables.length} tavol{roomTables.length === 1 ? 'o' : 'i'}
        </p>
        <Button type="button" variant="primary" size="sm" onClick={onAddTable}>
          <Plus className="h-4 w-4" aria-hidden />
          Aggiungi tavolo
        </Button>
      </div>

      {/* Canvas mappa */}
      <div className="overflow-auto rounded-xl border border-(--color-border) shadow-sm">
        <div
          style={{
            width: room.width,
            height: room.height,
            position: 'relative',
            // Griglia CSS 20px — aiuta a visualizzare le posizioni senza ingombrare il codice
            backgroundImage:
              'linear-gradient(to right, var(--color-border) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          <DndContext sensors={isMobile ? [] : sensors} onDragEnd={handleDragEnd}>
            {roomTables.map((table) => (
              <TableShape
                key={table.id}
                table={table}
                onEdit={onEditTable}
                dragDisabled={isMobile}
              />
            ))}
          </DndContext>

          {roomTables.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-(--color-text-muted)">Nessun tavolo in questa sala. Aggiungine uno.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
