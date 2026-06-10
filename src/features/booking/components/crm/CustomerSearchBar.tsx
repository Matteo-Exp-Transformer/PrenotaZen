import type { FC } from 'react'
import { Input } from '@/components/ui'
import type { CustomerDateFilter } from '@/features/booking/hooks/useCustomers'

const DATE_OPTIONS: { value: CustomerDateFilter; label: string }[] = [
  { value: 'all', label: 'Tutte' },
  { value: 'week', label: 'Ultima settimana' },
  { value: 'month', label: 'Ultimo mese' },
  { value: 'year', label: 'Ultimo anno' },
]

interface CustomerSearchBarProps {
  searchQuery: string
  onSearchChange: (v: string) => void
  dateFilter: CustomerDateFilter
  onDateFilterChange: (v: CustomerDateFilter) => void
}

export const CustomerSearchBar: FC<CustomerSearchBarProps> = ({
  searchQuery,
  onSearchChange,
  dateFilter,
  onDateFilterChange,
}) => {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
      <div className="min-w-0 flex-1">
        <label htmlFor="crm-search" className="mb-1 block text-sm font-medium text-primary-900">
          Cerca
        </label>
        <Input
          id="crm-search"
          type="search"
          placeholder="Nome o email…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="w-full sm:w-52">
        <label htmlFor="crm-date-filter" className="mb-1 block text-sm font-medium text-primary-900">
          Filtra data ultima prenotazione
        </label>
        <select
          id="crm-date-filter"
          value={dateFilter}
          onChange={(e) => onDateFilterChange(e.target.value as CustomerDateFilter)}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text)] shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {DATE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
