import type { FC } from 'react'
import { useEffect, useState } from 'react'
import { useCustomers } from '@/features/booking/hooks/useCustomers'
import { useDeleteCustomer } from '@/features/booking/hooks/useCustomerMutations'
import { useAdminAuth } from '@/features/booking/hooks/useAdminAuth'
import type { CustomerProfile } from '@/types/customer'
import { CustomerSearchBar } from './CustomerSearchBar'
import { CustomerListTable } from './CustomerListTable'
import { CustomerDetailPanel } from './CustomerDetailPanel'
import { CustomerFormModal } from './CustomerFormModal'
import { CustomerDeleteConfirm } from './CustomerDeleteConfirm'

export const CustomerDirectoryTab: FC = () => {
  const { customers, isLoading, error, searchQuery, setSearchQuery, dateFilter, setDateFilter } = useCustomers()
  const { user } = useAdminAuth()
  const deleteCustomer = useDeleteCustomer()
  const [selected, setSelected] = useState<CustomerProfile | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [formProfile, setFormProfile] = useState<CustomerProfile | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CustomerProfile | null>(null)

  const openEdit = (p: CustomerProfile) => {
    setFormProfile(p)
    setFormOpen(true)
  }

  const openDetail = (p: CustomerProfile) => {
    setSelected(p)
    setPanelOpen(true)
  }

  const handleRowSelect = (p: CustomerProfile) => {
    setSelected(p)
  }

  const openDelete = (p: CustomerProfile) => {
    setDeleteTarget(p)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    deleteCustomer.mutate(
      {
        customerRowId: deleteTarget.manual_id ?? null,
        email: deleteTarget.email,
        adminId: user?.id ?? null,
      },
      {
        onSuccess: () => {
          if (selected?.email === deleteTarget.email) {
            setPanelOpen(false)
            setSelected(null)
          }
          setDeleteTarget(null)
        },
      },
    )
  }

  useEffect(() => {
    setSelected((prev) => {
      if (!prev?.email) return prev
      const next = customers.find((c) => c.email === prev.email)
      if (!next) return prev
      if (
        next.name === prev.name &&
        next.notes === prev.notes &&
        next.phone === prev.phone &&
        next.manual_id === prev.manual_id &&
        next.booking_count === prev.booking_count &&
        next.last_booking_date === prev.last_booking_date
      ) {
        return prev
      }
      return next
    })
  }, [customers])

  return (
    <div className="space-y-6">
      <CustomerSearchBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
      />

      {error && (
        <p className="text-body rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          {error.message}
        </p>
      )}

      {isLoading ? (
        <p className="text-body text-(--color-text-muted)">Caricamento…</p>
      ) : (
        <CustomerListTable
          rows={customers}
          selectedEmail={selected?.email ?? null}
          onSelect={handleRowSelect}
          onOpenDetail={openDetail}
          onEdit={openEdit}
          onDelete={openDelete}
        />
      )}

      <CustomerDetailPanel
        profile={selected}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onEditContacts={() => selected && openEdit(selected)}
      />

      <CustomerFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        initialProfile={formProfile}
      />

      <CustomerDeleteConfirm
        profile={deleteTarget}
        isOpen={deleteTarget !== null}
        isBusy={deleteCustomer.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
