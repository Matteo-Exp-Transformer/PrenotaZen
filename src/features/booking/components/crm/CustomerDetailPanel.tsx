import type { FC } from 'react'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button, Textarea } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { CustomerProfile } from '@/types/customer'
import type { BookingRequest } from '@/types/booking'
import { useUpdateCustomer } from '@/features/booking/hooks/useCustomerMutations'

const STATUS_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  pending: { label: 'In attesa', className: 'bg-yellow-100 text-yellow-800' },
  accepted: { label: 'Accettata', className: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rifiutata', className: 'bg-red-100 text-red-800' },
  deleted: { label: 'Eliminata', className: 'bg-slate-200 text-slate-700' },
}

function bookingTypeLabel(b: BookingRequest): string {
  if (b.booking_type) return b.booking_type.replace(/_/g, ' ')
  if (b.event_type) return b.event_type.replace(/_/g, ' ')
  return '—'
}

interface CustomerDetailPanelProps {
  profile: CustomerProfile | null
  open: boolean
  onClose: () => void
  onEditContacts: () => void
}

export const CustomerDetailPanel: FC<CustomerDetailPanelProps> = ({
  profile,
  open,
  onClose,
  onEditContacts,
}) => {
  const updateCustomer = useUpdateCustomer()
  const [notesDraft, setNotesDraft] = useState('')

  useEffect(() => {
    if (profile) setNotesDraft(profile.notes ?? '')
  }, [profile])

  if (!profile) return null

  const saveNotes = () => {
    updateCustomer.mutate({
      customerRowId: profile.manual_id ?? null,
      previousEmail: profile.email,
      name: profile.name,
      email: profile.email,
      phone: profile.phone ?? null,
      notes: notesDraft.trim() || null,
    })
  }

  return (
    <>
      <button
        type="button"
        aria-label="Chiudi pannello"
        className={cn(
          'fixed inset-0 z-[8999] bg-black/30 transition-opacity',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed right-0 top-0 z-[9000] flex h-full w-full max-w-md flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : 'pointer-events-none translate-x-full',
        )}
        aria-hidden={!open}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] bg-primary-50 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-title-modal font-semibold text-primary-900">{profile.name || profile.email}</h2>
            <p className="truncate text-sm text-[var(--color-text-muted)]">{profile.email}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Chiudi" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <section className="mb-6">
            <h3 className="mb-2 text-title-subtitle font-semibold text-primary-900">Contatti</h3>
            <dl className="space-y-1 text-sm">
              <div>
                <dt className="text-[var(--color-text-muted)]">Email</dt>
                <dd className="text-[var(--color-text)]">{profile.email}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-text-muted)]">Telefono</dt>
                <dd className="text-[var(--color-text)]">{profile.phone ?? '—'}</dd>
              </div>
            </dl>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onEditContacts}>
              Modifica contatti
            </Button>
          </section>

          <section className="mb-6">
            <h3 className="mb-2 text-title-subtitle font-semibold text-primary-900">Note</h3>
            <Textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={4}
              placeholder="Note interne…"
              className="w-full"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2"
              disabled={updateCustomer.isPending}
              onClick={saveNotes}
            >
              Salva note
            </Button>
          </section>

          <section className="mb-6">
            <h3 className="mb-2 text-title-subtitle font-semibold text-primary-900">Statistiche</h3>
            <ul className="grid grid-cols-2 gap-2 text-sm text-[var(--color-text)]">
              <li className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
                <span className="text-[var(--color-text-muted)]">Prenotazioni</span>
                <div className="text-lg font-bold text-primary-900">{profile.booking_count}</div>
              </li>
              <li className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
                <span className="text-[var(--color-text-muted)]">Coperti</span>
                <div className="text-lg font-bold text-primary-900">{profile.total_guests}</div>
              </li>
              <li className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
                <span className="text-[var(--color-text-muted)]">Prima visita</span>
                <div className="font-medium">{profile.first_booking_date ?? '—'}</div>
              </li>
              <li className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
                <span className="text-[var(--color-text-muted)]">Ultima visita</span>
                <div className="font-medium">{profile.last_booking_date ?? '—'}</div>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-title-subtitle font-semibold text-primary-900">Prenotazioni</h3>
            {profile.bookings.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">Nessuna prenotazione.</p>
            ) : (
              <ul className="space-y-2">
                {profile.bookings.map((b) => {
                  const st = STATUS_BADGE[b.status] ?? STATUS_BADGE.pending
                  return (
                    <li
                      key={b.id}
                      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-primary-900">{b.desired_date}</span>
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', st.className)}>
                          {st.label}
                        </span>
                      </div>
                      <div className="mt-1 text-[var(--color-text-muted)]">
                        {bookingTypeLabel(b)} · {b.num_guests ?? 0} ospiti
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </>
  )
}
