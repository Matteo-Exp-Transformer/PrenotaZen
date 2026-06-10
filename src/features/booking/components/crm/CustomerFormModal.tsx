import type { FC, FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Modal, Input, Label, Button, Textarea } from '@/components/ui'
import type { CustomerProfile } from '@/types/customer'
import { useCreateCustomer, useUpdateCustomer } from '@/features/booking/hooks/useCustomerMutations'

interface CustomerFormModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  initialProfile?: CustomerProfile | null
}

export const CustomerFormModal: FC<CustomerFormModalProps> = ({
  isOpen,
  onClose,
  mode,
  initialProfile,
}) => {
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [emailSnapshot, setEmailSnapshot] = useState('')

  useEffect(() => {
    if (!isOpen) return
    if (mode === 'edit' && initialProfile) {
      setName(initialProfile.name)
      setEmail(initialProfile.email)
      setPhone(initialProfile.phone ?? '')
      setNotes(initialProfile.notes ?? '')
      setEmailSnapshot(initialProfile.email)
    } else if (mode === 'create') {
      setName('')
      setEmail('')
      setPhone('')
      setNotes('')
      setEmailSnapshot('')
    }
  }, [isOpen, mode, initialProfile])

  const busy = createCustomer.isPending || updateCustomer.isPending

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'create') {
      createCustomer.mutate(
        { name, email, phone: phone || undefined, notes: notes || undefined },
        { onSuccess: () => onClose() },
      )
      return
    }
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Nuovo cliente' : 'Modifica cliente'}
      size="md"
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
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Annulla
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            Salva
          </Button>
        </div>
      </form>
    </Modal>
  )
}
