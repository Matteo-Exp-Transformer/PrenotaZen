import type { FC } from 'react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui'
import { useCustomers } from '@/features/booking/hooks/useCustomers'
import { useDeleteCustomer } from '@/features/booking/hooks/useCustomerMutations'
import { useAdminAuth } from '@/features/booking/hooks/useAdminAuth'
import type { CustomerProfile } from '@/types/customer'
import { CustomerSearchBar } from '@/features/booking/components/crm/CustomerSearchBar'
import { CustomerListTable } from '@/features/booking/components/crm/CustomerListTable'
import { CustomerDetailPanel } from '@/features/booking/components/crm/CustomerDetailPanel'
import { CustomerFormModal } from '@/features/booking/components/crm/CustomerFormModal'
import { CustomerDeleteConfirm } from '@/features/booking/components/crm/CustomerDeleteConfirm'

export const CrmPage: FC = () => {
  const { customers, isLoading, error, searchQuery, setSearchQuery, dateFilter, setDateFilter } = useCustomers()
  const { user } = useAdminAuth()
  const deleteCustomer = useDeleteCustomer()
  const [selected, setSelected] = useState<CustomerProfile | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [formProfile, setFormProfile] = useState<CustomerProfile | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CustomerProfile | null>(null)

  const openCreate = () => {
    setFormMode('create')
    setFormProfile(null)
    setFormOpen(true)
  }

  const openEdit = (p: CustomerProfile) => {
    setFormMode('edit')
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
    <div className="min-h-0 flex-1 bg-(--color-bg) px-4 py-5 md:px-6 md:py-7">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-title-page min-w-0 truncate font-bold text-primary-900">CRM Clienti</h1>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={openCreate}
            className="w-full shrink-0 sm:w-auto"
          >
            + Nuovo cliente
          </Button>
        </div>

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
      </div>

      <CustomerDetailPanel
        profile={selected}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onEditContacts={() => selected && openEdit(selected)}
      />

      <CustomerFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        mode={formMode}
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
