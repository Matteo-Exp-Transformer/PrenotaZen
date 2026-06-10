import type { FC } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { RestaurantTable } from '@/features/booking/hooks/useServizioTables'

interface TableShapeProps {
  table: RestaurantTable
  onEdit: (table: RestaurantTable) => void
  /** Drag disabilitato su mobile */
  dragDisabled?: boolean
}

const SHAPE_SIZE = 64
const SHAPE_SIZE_RECT_W = 96

export const TableShape: FC<TableShapeProps> = ({ table, onEdit, dragDisabled = false }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: table.id,
    disabled: dragDisabled,
  })

  const style: React.CSSProperties = {
    position: 'absolute',
    left: table.position_x,
    top: table.position_y,
    transform: CSS.Translate.toString(transform),
    cursor: dragDisabled ? 'pointer' : isDragging ? 'grabbing' : 'grab',
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.8 : 1,
  }

  const w = table.shape === 'rect' ? SHAPE_SIZE_RECT_W : SHAPE_SIZE
  const h = SHAPE_SIZE

  // TODO: collegare a useTableStatuses in fase F4 dedicata per stato live (libero/occupato/prenotato)
  const fillColor = '#4ade80'
  const strokeColor = '#16a34a'

  function handleClick(e: React.MouseEvent) {
    // Non aprire il modal se stiamo finendo un drag
    if (isDragging) return
    e.stopPropagation()
    onEdit(table)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(dragDisabled ? {} : listeners)}
      {...(dragDisabled ? {} : attributes)}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`${table.name}, ${table.capacity} posti`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onEdit(table)
        }
      }}
    >
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', overflow: 'visible' }}
      >
        {table.shape === 'round' ? (
          <circle
            cx={w / 2}
            cy={h / 2}
            r={h / 2 - 2}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={2}
          />
        ) : (
          <rect
            x={2}
            y={2}
            width={w - 4}
            height={h - 4}
            rx={table.shape === 'square' ? 6 : 4}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={2}
          />
        )}

        {/* Etichetta nome + capienza al centro */}
        <text
          x={w / 2}
          y={h / 2 - 4}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={10}
          fontWeight="600"
          fill="#14532d"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {table.name.length > 8 ? table.name.slice(0, 7) + '…' : table.name}
        </text>
        <text
          x={w / 2}
          y={h / 2 + 9}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={9}
          fill="#166534"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {table.capacity}p
        </text>
      </svg>
    </div>
  )
}
