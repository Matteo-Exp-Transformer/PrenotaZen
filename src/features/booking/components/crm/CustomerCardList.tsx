import type { FC } from 'react'
import { useMemo, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { CustomerProfile } from '@/types/customer'
import { formatItalianDateDisplay } from '@/features/booking/utils/formatItalianDateDisplay'
import { CustomerCardExpandedContent } from './CustomerCardExpandedContent'

type SortKey = 'name' | 'email' | 'phone' | 'booking_count' | 'last_booking_date'

interface CustomerCardListProps {
  rows: CustomerProfile[]
  expandedProfileKey: string | null
  onToggleExpand: (profile: CustomerProfile) => void
  onEdit: (profile: CustomerProfile) => void
  onDelete: (profile: CustomerProfile) => void
}

const sortLabel: Record<SortKey, string> = {
  name: 'Nome',
  email: 'Email',
  phone: 'Telefono',
  booking_count: 'N° Pren.',
  last_booking_date: 'Ultima prenotazione',
}

export const CustomerCardList: FC<CustomerCardListProps> = ({
  rows,
  expandedProfileKey,
  onToggleExpand,
  onEdit,
  onDelete,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('last_booking_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const sorted = useMemo(() => {
    const list = [...rows]
    const dir = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      let va: string | number = ''
      let vb: string | number = ''
      switch (sortKey) {
        case 'name':
          va = a.name.toLowerCase()
          vb = b.name.toLowerCase()
          break
        case 'email':
          va = a.email.toLowerCase()
          vb = b.email.toLowerCase()
          break
        case 'phone':
          va = (a.phone ?? '').toLowerCase()
          vb = (b.phone ?? '').toLowerCase()
          break
        case 'booking_count':
          va = a.booking_count
          vb = b.booking_count
          break
        case 'last_booking_date':
          va = a.last_booking_date ?? ''
          vb = b.last_booking_date ?? ''
          break
        default:
          break
      }
      if (va < vb) return -1 * dir
      if (va > vb) return 1 * dir
      return 0
    })
    return list
  }, [rows, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'last_booking_date' || key === 'booking_count' ? 'desc' : 'asc')
    }
  }

  const showManualBadge = (p: CustomerProfile) =>
    p.customer_db_source === 'manual' && p.booking_count === 0

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 rounded-xl border border-(--color-border) bg-primary-50 px-3 py-2">
        <span className="self-center text-xs font-medium text-primary-900">Ordina per:</span>
        {(Object.keys(sortLabel) as SortKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => toggleSort(key)}
            className={cn(
              'rounded-lg px-2 py-1 text-xs font-medium transition-colors',
              sortKey === key
                ? 'bg-primary-600 text-white'
                : 'bg-white text-primary-800 hover:bg-primary-100',
            )}
          >
            {sortLabel[key]}
            {sortKey === key && (
              <span className="ml-1 font-normal">{sortDir === 'asc' ? '↑' : '↓'}</span>
            )}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-xl border border-(--color-border) bg-(--color-surface) px-4 py-8 text-center text-sm text-(--color-text-muted)">
          Nessun cliente trovato.
        </p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((p) => {
            const expanded = p.profileKey === expandedProfileKey
            return (
              <li
                key={p.profileKey}
                className={cn(
                  'overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface) shadow-sm transition-colors',
                  expanded && 'ring-2 ring-primary-200',
                )}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onToggleExpand(p)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onToggleExpand(p)
                    }
                  }}
                  className={cn(
                    'cursor-pointer px-4 py-3 transition-colors hover:bg-primary-50/50 sm:px-5 sm:py-4',
                    expanded && 'bg-primary-50/40',
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate text-base font-semibold text-primary-900">
                          {p.name || '—'}
                        </span>
                        {showManualBadge(p) && (
                          <span className="shrink-0 rounded-md border border-(--color-border) bg-(--color-bg) px-1.5 py-0.5 text-xs font-medium text-(--color-text-muted)">
                            Manuale
                          </span>
                        )}
                      </div>
                      <div className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        <p className="min-w-0 truncate text-(--color-text)">
                          <span className="text-(--color-text-muted)">Email: </span>
                          {p.email}
                        </p>
                        <p className="text-(--color-text-muted)">
                          <span>Telefono: </span>
                          <span className="text-(--color-text)">{p.phone ?? '—'}</span>
                        </p>
                        <p className="text-(--color-text-muted)">
                          <span>N° pren.: </span>
                          <span className="font-medium text-(--color-text)">{p.booking_count}</span>
                        </p>
                        <p className="text-(--color-text-muted)">
                          <span>Ultima pren.: </span>
                          <span className="text-(--color-text)">
                            {formatItalianDateDisplay(p.last_booking_date)}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 justify-end gap-1 sm:pt-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Modifica contatti"
                        title="Modifica contatti"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEdit(p)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Elimina"
                        title="Elimina cliente"
                        className="text-(--color-danger) hover:bg-(--color-danger)/10"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(p)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {expanded && (
                  <CustomerCardExpandedContent
                    profile={p}
                    onRequestCollapse={() => onToggleExpand(p)}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
