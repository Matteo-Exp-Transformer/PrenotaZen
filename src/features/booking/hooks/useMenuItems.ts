import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, handleSupabaseError } from '@/lib/supabase'
import { supabasePublic } from '@/lib/supabasePublic'
import type { MenuItem, MenuItemInput } from '@/types/menu'
import { toast } from 'react-toastify'
import { useTenantContext } from '@/contexts/TenantContext'
import type { TablesInsert, TablesUpdate } from '@/types/database'

const DUPLICATE_MENU_ITEM_MSG =
  'Esiste già un prodotto con lo stesso nome in questa categoria'

function getMenuItemMutationError(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === '23505'
  ) {
    return DUPLICATE_MENU_ITEM_MSG
  }
  return handleSupabaseError(error)
}

function buildMenuItemUpdate(
  updates: Partial<MenuItem>,
): TablesUpdate<'menu_items'> {
  const patch: TablesUpdate<'menu_items'> = {
    updated_at: new Date().toISOString(),
  }

  if (updates.name !== undefined) patch.name = updates.name
  if (updates.category !== undefined) patch.category = updates.category
  if (updates.price !== undefined) patch.price = updates.price
  if (updates.description !== undefined) patch.description = updates.description
  if (updates.sort_order !== undefined) patch.sort_order = updates.sort_order
  if (updates.is_available !== undefined) patch.is_available = updates.is_available
  if (updates.booking_types !== undefined) patch.booking_types = updates.booking_types
  if (updates.image_url !== undefined) patch.image_url = updates.image_url

  return patch
}

// Hook for fetching all menu items
export const useMenuItems = () => {
  const { tenantId } = useTenantContext()

  return useQuery({
    queryKey: ['menu-items', tenantId],
    queryFn: async () => {
      const { data, error } = await supabasePublic
        .from('menu_items')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('category', { ascending: true })
        .order('sort_order', { ascending: true })

      if (error) {
        throw new Error(handleSupabaseError(error))
      }

      return data as unknown as MenuItem[]
    },
    enabled: !!tenantId,
  })
}

// Hook for fetching menu items by category
export const useMenuItemsByCategory = (category?: string) => {
  const { tenantId } = useTenantContext()

  return useQuery({
    queryKey: ['menu-items', 'by-category', category, tenantId],
    queryFn: async () => {
      let query = supabasePublic
        .from('menu_items')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('sort_order', { ascending: true })

      if (category) {
        query = query.eq('category', category)
      }

      const { data, error } = await query

      if (error) {
        throw new Error(handleSupabaseError(error))
      }

      return data as unknown as MenuItem[]
    },
    enabled: !!tenantId,
  })
}

// Hook for creating a new menu item
export const useCreateMenuItem = () => {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async (item: MenuItemInput) => {
      const insertData: TablesInsert<'menu_items'> = {
        tenant_id: tenantId!,
        name: item.name,
        category: item.category,
        price: item.price,
        description: item.description || null,
        sort_order: item.sort_order || 0,
        is_available: item.is_available ?? true,
        booking_types: item.booking_types ?? [],
      }

      const { data, error } = await supabase
        .from('menu_items')
        .insert(insertData)
        .select()
        .single()

      if (error) {
        throw new Error(getMenuItemMutationError(error))
      }

      return data as unknown as MenuItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] })
      toast.success('Prodotto aggiunto con successo')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Errore nell\'aggiunta del prodotto')
    }
  })
}

// Hook for updating a menu item
export const useUpdateMenuItem = () => {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MenuItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('menu_items')
        .update(buildMenuItemUpdate(updates))
        .eq('id', id)
        .eq('tenant_id', tenantId!)
        .select()
        .single()

      if (error) {
        throw new Error(getMenuItemMutationError(error))
      }

      return data as unknown as MenuItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] })
      toast.success('Prodotto aggiornato con successo')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Errore nell\'aggiornamento del prodotto')
    }
  })
}

export const useSetMenuItemAvailability = () => {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async ({ id, is_available }: { id: string; is_available: boolean }) => {
      const updateData: TablesUpdate<'menu_items'> = {
        is_available,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('menu_items')
        .update(updateData)
        .eq('id', id)
        .eq('tenant_id', tenantId!)
        .select()
        .single()

      if (error) {
        throw new Error(getMenuItemMutationError(error))
      }

      return data as unknown as MenuItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] })
      toast.success('Disponibilità ingrediente aggiornata')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Errore aggiornamento disponibilità ingrediente')
    },
  })
}

// Hook for deleting a menu item
export const useDeleteMenuItem = () => {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId!)

      if (error) {
        throw new Error(handleSupabaseError(error))
      }

      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] })
      toast.success('Prodotto eliminato con successo')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Errore nell\'eliminazione del prodotto')
    }
  })
}
