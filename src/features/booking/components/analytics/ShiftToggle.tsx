import type { FC } from 'react'
import { cn } from '@/lib/utils'
import type { ShiftFilter } from '@/features/booking/hooks/useAnalytics'

const OPTIONS: { value: ShiftFilter; label: string }[] = [
  { value: 'all', label: 'Tutti' },
  { value: 'lunch', label: 'Pranzo' },
  { value: 'dinner', label: 'Cena' },
]

interface ShiftToggleProps {
  value: ShiftFilter
  onChange: (shift: ShiftFilter) => void
}

export const ShiftToggle: FC<ShiftToggleProps> = ({ value, onChange }) => (
  <div className="flex rounded-lg border border-(--color-border) bg-surface p-0.5">
    {OPTIONS.map((opt) => (
      <button
        key={opt.value}
        type="button"
        onClick={() => onChange(opt.value)}
        className={cn(
          'rounded-md px-3 py-1 text-sm font-medium transition-colors',
          value === opt.value
            ? 'bg-primary-600 text-white'
            : 'text-(--color-text) hover:text-primary-600',
        )}
      >
        {opt.label}
      </button>
    ))}
  </div>
)
