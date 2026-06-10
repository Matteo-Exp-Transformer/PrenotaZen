import type { FC } from 'react'
import { useState, useRef, useEffect } from 'react'
import { Settings, Plus, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { Room } from '@/features/booking/hooks/useRooms'

interface RoomTabsProps {
  rooms: Room[]
  selectedRoomId: string | null
  onSelectRoom: (id: string) => void
  onAddRoom: () => void
  onConfigureRoom: (room: Room) => void
}

export const RoomTabs: FC<RoomTabsProps> = ({
  rooms,
  selectedRoomId,
  onSelectRoom,
  onAddRoom,
  onConfigureRoom,
}) => {
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Chiude il picker cliccando fuori
  useEffect(() => {
    if (!pickerOpen) return
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [pickerOpen])

  function handlePickRoom(room: Room) {
    setPickerOpen(false)
    onConfigureRoom(room)
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {rooms.map((room) => (
        <button
          key={room.id}
          type="button"
          onClick={() => onSelectRoom(room.id)}
          className={cn(
            'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            room.id === selectedRoomId
              ? 'bg-primary-600 text-white'
              : 'bg-surface text-(--color-text) border border-(--color-border) hover:bg-primary-50',
          )}
        >
          {room.name}
        </button>
      ))}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onAddRoom}
        className="shrink-0"
        title="Nuova sala"
      >
        <Plus className="h-4 w-4" />
        Nuova sala
      </Button>

      {/* Pulsante Modifica sale — apre picker con lista delle sale */}
      {rooms.length > 0 && (
        <div ref={pickerRef} className="relative shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setPickerOpen((prev) => !prev)}
            title="Modifica sale"
            className="gap-1"
          >
            <Settings className="h-4 w-4" />
            Modifica sale
            <ChevronDown className={cn('h-3 w-3 transition-transform', pickerOpen && 'rotate-180')} />
          </Button>

          {pickerOpen && (
            <div className="absolute left-0 top-full z-30 mt-1 min-w-44 rounded-xl border border-(--color-border) bg-surface py-1 shadow-lg">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => handlePickRoom(room)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-(--color-text) hover:bg-primary-50 hover:text-primary-700"
                >
                  <Settings className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  {room.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
