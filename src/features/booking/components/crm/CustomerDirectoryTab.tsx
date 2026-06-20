import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useCustomers } from '@/features/booking/hooks/useCustomers'
import { useDeleteCustomer } from '@/features/booking/hooks/useCustomerMutations'
import { useAdminAuth } from '@/features/booking/hooks/useAdminAuth'
import type { CustomerProfile } from '@/types/customer'
import { CustomerSearchBar } from './CustomerSearchBar'
import { CustomerCardList } from './CustomerCardList'
import { CustomerFormModal } from './CustomerFormModal'
import { CustomerDeleteConfirm } from './CustomerDeleteConfirm'

export const CustomerDirectoryTab: FC = () => {
  const { customers, isLoading, error, searchQuery, setSearchQuery, dateFilter, setDateFilter } =
    useCustomers()
  const { user } = useAdminAuth()
  const deleteCustomer = useDeleteCustomer()
  const [expandedProfileKey, setExpandedProfileKey] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formProfile, setFormProfile] = useState<CustomerProfile | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CustomerProfile | null>(null)

  const openEdit = (p: CustomerProfile) => {
    setFormProfile(p)
    setFormOpen(true)
  }

  const toggleExpand = useCallback((p: CustomerProfile) => {
    setExpandedProfileKey((prev) => (prev === p.profileKey ? null : p.profileKey))
  }, [])

  const openDelete = (p: CustomerProfile) => {
    setDeleteTarget(p)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    deleteCustomer.mutate(
      {
        customerRowId: deleteTarget.manual_id ?? null,
        email: deleteTarget.email,
        clientName: deleteTarget.name,
        adminId: user?.id ?? null,
      },
      {
        onSuccess: () => {
          if (expandedProfileKey === deleteTarget.profileKey) {
            setExpandedProfileKey(null)
          }
          setDeleteTarget(null)
        },
      },
    )
  }

  useEffect(() => {
    if (!expandedProfileKey) return
    const stillExists = customers.some((c) => c.profileKey === expandedProfileKey)
    if (!stillExists) setExpandedProfileKey(null)
  }, [customers, expandedProfileKey])

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
        <CustomerCardList
          rows={customers}
          expandedProfileKey={expandedProfileKey}
          onToggleExpand={toggleExpand}
          onEdit={openEdit}
          onDelete={openDelete}
        />
      )}

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
