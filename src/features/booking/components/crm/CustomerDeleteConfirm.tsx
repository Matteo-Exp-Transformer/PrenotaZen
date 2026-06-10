import type { FC } from 'react'
import { Modal, Button } from '@/components/ui'
import type { CustomerProfile } from '@/types/customer'

interface CustomerDeleteConfirmProps {
  profile: CustomerProfile | null
  isOpen: boolean
  isBusy: boolean
  onClose: () => void
  onConfirm: () => void
}

export const CustomerDeleteConfirm: FC<CustomerDeleteConfirmProps> = ({
  profile,
  isOpen,
  isBusy,
  onClose,
  onConfirm,
}) => {
  if (!profile) return null
  const count = profile.booking_count

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Elimina cliente" size="md">
      <div className="space-y-4">
        <p className="text-sm text-[var(--color-text)]">
          Stai per eliminare il cliente{' '}
          <span className="font-semibold text-primary-900">{profile.name || profile.email}</span>{' '}
          <span className="text-[var(--color-text-muted)]">({profile.email})</span>.
        </p>

        <ul className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-text)]">
          {profile.manual_id && (
            <li>
              · Il record cliente verrà <span className="font-semibold">rimosso definitivamente</span> dal database.
            </li>
          )}
          {count > 0 ? (
            <li>
              · Le {count} prenotazion{count === 1 ? 'e' : 'i'} associat{count === 1 ? 'a' : 'e'} verranno{' '}
              <span className="font-semibold">archiviat{count === 1 ? 'a' : 'e'}</span> (status{' '}
              <code className="rounded bg-[var(--color-surface-2)] px-1 py-0.5 text-xs">deleted</code>) e non saranno
              più visibili in dashboard.
            </li>
          ) : (
            !profile.manual_id && (
              <li>· Nessuna prenotazione associata: l&apos;operazione non avrà effetti sul database.</li>
            )
          )}
        </ul>

        <p className="text-xs text-[var(--color-text-muted)]">L&apos;azione non è reversibile da interfaccia.</p>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isBusy}>
            Annulla
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={isBusy}>
            Elimina
          </Button>
        </div>
      </div>
    </Modal>
  )
}
