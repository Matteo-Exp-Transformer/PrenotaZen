import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { useTenantContext } from '@/contexts/TenantContext'
import { deleteMenuCategoryPhoto } from '@/lib/menuPhotoUpload'
import { handleSupabaseError, supabase } from '@/lib/supabase'
import { supabasePublic } from '@/lib/supabasePublic'
import { syncMenuCategoryKeyRename } from '@/features/booking/services/syncMenuCategoryKeyRename'
import { syncMenuCategoryKeyDelete } from '@/features/booking/services/syncMenuCategoryKeyDelete'
import type { TablesInsert, TablesUpdate } from '@/types/database'

export interface MenuCategoryRecord {
  id: string
  tenant_id: string
  key: string
  label: string
  description?: string | null
  /** Foto categoria per pagina Prenota (non thumbnail homepage QR). */
  image_url?: string | null
  /** false = nascosta in Prenota e Menu QR. Default true. */
  is_available?: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface MenuCategoryInput {
  key: string
  label: string
  description?: string | null
  image_url?: string | null
  is_available?: boolean
  sort_order?: number
}

interface MenuCategoryUpdateInput {
  id: string
  key: string
  previousKey: string
  label: string
  description?: string | null
  image_url?: string | null
  is_available?: boolean
}

const DUPLICATE_CATEGORY_MSG = 'Esiste già una categoria con questo nome'

function getMenuCategoryMutationError(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === '23505'
  ) {
    return DUPLICATE_CATEGORY_MSG
  }
  return handleSupabaseError(error)
}

function isMenuCategoriesMissingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const pgError = error as { code?: string; status?: number; message?: string }
  return (
    pgError.code === '42P01' ||
    pgError.code === 'PGRST205' ||
    pgError.status === 404 ||
    (typeof pgError.message === 'string' && pgError.message.toLowerCase().includes('menu_categories'))
  )
}

function buildMenuCategoryUpdate(input: {
  key: string
  label: string
  description?: string | null
  image_url?: string | null
  is_available?: boolean
}): TablesUpdate<'menu_categories'> {
  const patch: TablesUpdate<'menu_categories'> = {
    key: input.key,
    label: input.label,
    description: input.description?.trim() || null,
    updated_at: new Date().toISOString(),
  }

  if (input.image_url !== undefined) {
    patch.image_url = input.image_url
  }
  if (typeof input.is_available === 'boolean') {
    patch.is_available = input.is_available
  }

  return patch
}

export const useMenuCategories = () => {
  const { tenantId } = useTenantContext()

  return useQuery({
    queryKey: ['menu-categories', tenantId],
    queryFn: async () => {
      const { data, error } = await supabasePublic
        .from('menu_categories')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('sort_order', { ascending: true })
        .order('label', { ascending: true })

      if (error) {
        if (isMenuCategoriesMissingError(error)) {
          return []
        }
        throw new Error(handleSupabaseError(error))
      }

      return (data ?? []) as MenuCategoryRecord[]
    },
    enabled: !!tenantId,
    retry: (failureCount, error) => {
      if (isMenuCategoriesMissingError(error)) return false
      return failureCount < 3
    },
  })
}

export const useCreateMenuCategory = () => {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async (category: MenuCategoryInput) => {
      const insertData: TablesInsert<'menu_categories'> = {
        tenant_id: tenantId!,
        key: category.key,
        label: category.label,
        description: category.description?.trim() || null,
        image_url: category.image_url ?? null,
        is_available: category.is_available ?? true,
        sort_order: category.sort_order ?? 999,
      }

      const { data, error } = await supabase
        .from('menu_categories')
        .insert(insertData)
        .select()
        .single()

      if (error) {
        throw new Error(getMenuCategoryMutationError(error))
      }

      return data as MenuCategoryRecord
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-categories'] })
      toast.success('Categoria aggiunta con successo')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Errore nell\'aggiunta della categoria')
    }
  })
}

export const useUpdateMenuCategory = () => {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async ({ id, key, previousKey, label, description, image_url, is_available }: MenuCategoryUpdateInput) => {
      const now = new Date().toISOString()
      const patch = buildMenuCategoryUpdate({ key, label, description, image_url, is_available })

      const { data, error } = await supabase
        .from('menu_categories')
        .update(patch)
        .eq('id', id)
        .eq('tenant_id', tenantId!)
        .select()
        .single()

      if (error) {
        throw new Error(getMenuCategoryMutationError(error))
      }

      const keyRenamed = previousKey !== key

      if (keyRenamed) {
        const menuItemsUpdate: TablesUpdate<'menu_items'> = {
          category: key,
          updated_at: now,
        }

        const { error: menuItemsError } = await supabase
          .from('menu_items')
          .update(menuItemsUpdate)
          .eq('tenant_id', tenantId!)
          .eq('category', previousKey)

        if (menuItemsError) {
          throw new Error(handleSupabaseError(menuItemsError))
        }

        try {
          await syncMenuCategoryKeyRename(tenantId!, previousKey, key)
        } catch (syncError) {
          throw new Error(
            syncError instanceof Error
              ? syncError.message
              : 'Errore nell\'allineamento Menù QR e Personalizza form dopo il rename della categoria',
          )
        }
      }

      return data as MenuCategoryRecord
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-categories'] })
      queryClient.invalidateQueries({ queryKey: ['menu-items'] })
      queryClient.invalidateQueries({ queryKey: ['menu-qr-codes'] })
      queryClient.invalidateQueries({ queryKey: ['menu-qrcode-categories'] })
      queryClient.invalidateQueries({
        queryKey: ['restaurant_settings', 'booking_public_form_config'],
      })
      toast.success('Categoria aggiornata con successo')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Errore nell\'aggiornamento della categoria')
    }
  })
}

export type DeleteMenuCategoryInput = {
  id: string
  categoryKey: string
}

/**
 * Riscrive `sort_order` sequenziale (0,10,20…) seguendo l'ordine degli id passati.
 * Ordine canonico unico del magazzino: lo stesso usato da panoramica Menu, menù
 * preselezionati e dettaglio prenotazione (Prenota/QR mantengono i loro override).
 * Riscrive tutte le categorie (max 7) per normalizzare anche i legacy a sort_order=999.
 */
export const useReorderMenuCategories = () => {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const now = new Date().toISOString()
      await Promise.all(
        orderedIds.map((id, index) => {
          const patch: TablesUpdate<'menu_categories'> = {
            sort_order: index * 10,
            updated_at: now,
          }
          return supabase
            .from('menu_categories')
            .update(patch)
            .eq('id', id)
            .eq('tenant_id', tenantId!)
            .then(({ error }) => {
              if (error) throw new Error(handleSupabaseError(error))
            })
        }),
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-categories'] })
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ['menu-categories'] })
      toast.error(error.message || 'Errore nel riordino delle categorie')
    },
  })
}

export const useUpdateCategoryDescription = () => {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async ({ id, description }: { id: string; description: string | null }) => {
      const updateData: TablesUpdate<'menu_categories'> = {
        description,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('menu_categories')
        .update(updateData)
        .eq('id', id)
        .eq('tenant_id', tenantId!)

      if (error) throw new Error(handleSupabaseError(error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-categories'] })
      toast.success('Descrizione salvata')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Errore salvataggio descrizione')
    },
  })
}

export const useSetMenuCategoryAvailability = () => {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async ({ id, is_available }: { id: string; is_available: boolean }) => {
      const updateData: TablesUpdate<'menu_categories'> = {
        is_available,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('menu_categories')
        .update(updateData)
        .eq('id', id)
        .eq('tenant_id', tenantId!)
        .select()
        .single()

      if (error) {
        throw new Error(handleSupabaseError(error))
      }

      return data as MenuCategoryRecord
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-categories'] })
      toast.success('Disponibilità categoria aggiornata')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Errore aggiornamento disponibilità categoria')
    },
  })
}

export const useDeleteMenuCategory = () => {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async ({ id, categoryKey }: DeleteMenuCategoryInput) => {
      const { error: itemsError } = await supabase
        .from('menu_items')
        .delete()
        .eq('tenant_id', tenantId!)
        .eq('category', categoryKey)

      if (itemsError) {
        throw new Error(handleSupabaseError(itemsError))
      }

      const { error } = await supabase
        .from('menu_categories')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId!)

      if (error) {
        throw new Error(handleSupabaseError(error))
      }

      try {
        await syncMenuCategoryKeyDelete(tenantId!, categoryKey)
      } catch (syncError) {
        throw new Error(
          syncError instanceof Error
            ? syncError.message
            : 'Errore nell\'allineamento Menù QR e Personalizza form dopo l\'eliminazione della categoria',
        )
      }

      try {
        await deleteMenuCategoryPhoto(tenantId!, id)
      } catch {
        // file assente o già rimosso
      }

      return { id, categoryKey }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-categories'] })
      queryClient.invalidateQueries({ queryKey: ['menu-items'] })
      queryClient.invalidateQueries({ queryKey: ['menu-qr-codes'] })
      queryClient.invalidateQueries({ queryKey: ['menu-qrcode-categories'] })
      queryClient.invalidateQueries({
        queryKey: ['restaurant_settings', 'booking_public_form_config'],
      })
      toast.success('Categoria eliminata con successo')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Errore nell\'eliminazione della categoria')
    },
  })
}
