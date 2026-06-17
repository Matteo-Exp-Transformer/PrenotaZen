import type { FC, FormEvent } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal, Input, Label, Button, Textarea } from '@/components/ui'
import type { CustomerProfile } from '@/types/customer'
import { useUpdateCustomer } from '@/features/booking/hooks/useCustomerMutations'
import { DiscardChangesConfirmModal } from '@/features/booking/components/settings/SettingsSaveUi'

// Solo modifica: i clienti non si inseriscono a mano. Solo chi ha inviato una
// prenotazione (accettando la privacy policy nel form pubblico) entra in rubrica.
interface CustomerFormModalProps {
  isOpen: boolean
  onClose: () => void
  initialProfile?: CustomerProfile | null
}

function normalizeDraft(value: {
  name: string
  email: string
  phone: string
  notes: string
}) {
  return {
    name: value.name.trim(),
    email: value.email.trim(),
    phone: value.phone.trim(),
    notes: value.notes.trim(),
  }
}

export const CustomerFormModal: FC<CustomerFormModalProps> = ({
  isOpen,
  onClose,
  initialProfile,
}) => {
  const updateCustomer = useUpdateCustomer()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [emailSnapshot, setEmailSnapshot] = useState('')
  const [baseline, setBaseline] = useState(() => normalizeDraft({ name: '', email: '', phone: '', notes: '' }))
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)

  useEffect(() => {
    if (!isOpen || !initialProfile) return
    const next = normalizeDraft({
      name: initialProfile.name,
      email: initialProfile.email,
      phone: initialProfile.phone ?? '',
      notes: initialProfile.notes ?? '',
    })
    setName(next.name)
    setEmail(next.email)
    setPhone(next.phone)
    setNotes(next.notes)
    setEmailSnapshot(initialProfile.email)
    setBaseline(next)
  }, [isOpen, initialProfile])

  const busy = updateCustomer.isPending

  const isDirty = useMemo(
    () =>
      normalizeDraft({ name, email, phone, notes }).name !== baseline.name ||
      normalizeDraft({ name, email, phone, notes }).email !== baseline.email ||
      normalizeDraft({ name, email, phone, notes }).phone !== baseline.phone ||
      normalizeDraft({ name, email, phone, notes }).notes !== baseline.notes,
    [baseline, email, name, notes, phone],
  )

  const requestClose = useCallback(() => {
    if (busy) return
    if (isDirty) {
      setDiscardConfirmOpen(true)
      return
    }
    onClose()
  }, [busy, isDirty, onClose])

  const confirmDiscardClose = useCallback(() => {
    setDiscardConfirmOpen(false)
    onClose()
  }, [onClose])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!initialProfile) return
    updateCustomer.mutate(
      {
        customerRowId: initialProfile.manual_id ?? null,
        previousEmail: emailSnapshot,
        name,
        email,
        phone: phone.trim() || null,
        notes: notes.trim() || null,
      },
      { onSuccess: () => onClose() },
    )
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={requestClose}
        title="Modifica cliente"
        size="md"
        closeOnOverlayClick={!busy}
        closeOnEscape={!busy}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="crm-form-name">Nome</Label>
            <Input
              id="crm-form-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
          <div>
            <Label htmlFor="crm-form-email">Email</Label>
            <Input
              id="crm-form-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <Label htmlFor="crm-form-phone">Telefono</Label>
            <Input
              id="crm-form-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
          </div>
          <div>
            <Label htmlFor="crm-form-notes">Note</Label>
            <Textarea id="crm-form-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={requestClose} disabled={busy}>
              Annulla
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              Salva
            </Button>
          </div>
        </form>
      </Modal>

      <DiscardChangesConfirmModal
        isOpen={discardConfirmOpen}
        onStay={() => setDiscardConfirmOpen(false)}
        onDiscard={confirmDiscardClose}
      />
    </>
  )
}
