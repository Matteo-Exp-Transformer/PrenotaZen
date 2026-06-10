import type { FC } from 'react'
import { useMemo, useState } from 'react'
import { Eye, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { CustomerProfile } from '@/types/customer'

type SortKey = 'name' | 'email' | 'phone' | 'booking_count' | 'last_booking_date'

interface CustomerListTableProps {
  rows: CustomerProfile[]
  selectedEmail: string | null
  onSelect: (profile: CustomerProfile) => void
  onOpenDetail: (profile: CustomerProfile) => void
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

export const CustomerListTable: FC<CustomerListTableProps> = ({
  rows,
  selectedEmail,
  onSelect,
  onOpenDetail,
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
    <div className="overflow-x-auto rounded-xl border border-(--color-border) bg-(--color-surface) shadow-sm">
      <table className="w-full min-w-[640px] divide-y divide-[var(--color-border)] text-left text-sm">
        <thead className="bg-primary-50 text-primary-900">
          <tr>
            {(Object.keys(sortLabel) as SortKey[]).map((key) => (
              <th key={key} scope="col" className="px-4 py-3 font-semibold">
                <button
                  type="button"
                  onClick={() => toggleSort(key)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-lg px-1 py-0.5 text-left hover:bg-primary-100/80',
                    sortKey === key && 'text-primary-600',
                  )}
                >
                  {sortLabel[key]}
                  {sortKey === key && <span className="text-xs font-normal">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </button>
              </th>
            ))}
            <th scope="col" className="px-4 py-3 font-semibold text-right">
              Azioni
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-(--color-border) bg-(--color-bg)">
          {sorted.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-sm text-(--color-text-muted)">
                Nessun cliente trovato.
              </td>
            </tr>
          )}
          {sorted.map((p) => {
            const selected = p.email === selectedEmail
            return (
              <tr
                key={p.email}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(p)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(p)
                  }
                }}
                className={cn(
                  'cursor-pointer transition-colors hover:bg-primary-50/50',
                  selected && 'bg-primary-50',
                )}
              >
                <td className="max-w-[220px] px-4 py-3 font-medium text-primary-900">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate">{p.name || '—'}</span>
                    {showManualBadge(p) && (
                      <span className="shrink-0 rounded-md border border-(--color-border) bg-(--color-bg) px-1.5 py-0.5 text-xs font-medium text-(--color-text-muted)">
                        Manuale
                      </span>
                    )}
                  </div>
                </td>
                <td className="max-w-[260px] truncate px-4 py-3 text-(--color-text)">{p.email}</td>
                <td className="whitespace-nowrap px-4 py-3 text-(--color-text-muted)">{p.phone ?? '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-(--color-text)">{p.booking_count}</td>
                <td className="whitespace-nowrap px-4 py-3 text-(--color-text-muted)">{p.last_booking_date ?? '—'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex shrink-0 justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Dettaglio"
                      title="Dettaglio"
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenDetail(p)
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Modifica"
                      title="Modifica"
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
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
