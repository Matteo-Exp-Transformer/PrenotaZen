import type { FC } from 'react'
import { useState, useMemo } from 'react'
import { Button, Modal, Input } from '@/components/ui'
import { useCustomers } from '@/features/booking/hooks/useCustomers'
import type { CustomerProfile } from '@/types/customer'

interface Props {
  isOpen: boolean
  onClose: () => void
  /** Chiamato con la lista di email selezionate. */
  onConfirm: (recipients: string[]) => void
}

function hasValidEmail(c: CustomerProfile): boolean {
  return c.source === 'booking' && !!c.email && c.email.includes('@')
}

export const PromoRecipientPicker: FC<Props> = ({ isOpen, onClose, onConfirm }) => {
  const { customers } = useCustomers()
  const eligible = useMemo(() => customers.filter(hasValidEmail), [customers])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return eligible
    return eligible.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
    )
  }, [eligible, search])

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.email))

  const toggle = (email: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(email)) next.delete(email)
      else next.add(email)
      return next
    })
  }

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        filtered.forEach((c) => next.delete(c.email))
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        filtered.forEach((c) => next.add(c.email))
        return next
      })
    }
  }

  const handleConfirm = () => {
    onConfirm(Array.from(selected))
    onClose()
  }

  const handleClose = () => {
    setSearch('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Scegli destinatari" size="lg">
      <div className="space-y-4">
        <Input
          placeholder="Cerca per nome o email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <p className="text-sm text-slate-500">
          {eligible.length} clienti con prenotazioni •{' '}
          <button
            type="button"
            onClick={toggleAll}
            className="text-primary-600 underline hover:no-underline"
          >
            {allFilteredSelected ? 'Deseleziona tutti' : 'Seleziona tutti'}
          </button>
        </p>

        <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200">
          {filtered.length === 0 && (
            <p className="px-4 py-3 text-sm text-slate-400">Nessun cliente trovato</p>
          )}
          {filtered.map((c) => (
            <label
              key={c.email}
              className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selected.has(c.email)}
                onChange={() => toggle(c.email)}
                className="h-4 w-4 rounded accent-primary-600"
              />
              <span className="flex-1 min-w-0">
                <span className="block font-medium text-slate-800 truncate">{c.name}</span>
                <span className="block text-xs text-slate-500 truncate">{c.email}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-slate-600">
            {selected.size} selezionat{selected.size === 1 ? 'o' : 'i'}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={handleClose}>
              Annulla
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleConfirm}
              disabled={selected.size === 0}
            >
              Conferma
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
