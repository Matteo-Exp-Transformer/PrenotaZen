import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { useTenantContext } from '@/contexts/TenantContext'
import { deleteMenuCategoryPhoto } from '@/lib/menuPhotoUpload'
import { handleSupabaseError, supabase } from '@/lib/supabase'
import { supabasePublic } from '@/lib/supabasePublic'
import { syncMenuCategoryKeyRename } from '@/features/booking/services/syncMenuCategoryKeyRename'
import { syncMenuCategoryKeyDelete } from '@/features/booking/services/syncMenuCategoryKeyDelete'

export interface MenuCategoryRecord {
  id: string
  tenant_id: string
  key: string
  label: string
  description?: string | null
  /** Foto categoria per pagina Prenota (non thumbnail homepage QR). */
  image_url?: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface MenuCategoryInput {
  key: string
  label: string
  description?: string | null
  image_url?: string | null
  sort_order?: number
}

interface MenuCategoryUpdateInput {
  id: string
  key: string
  previousKey: string
  label: string
  description?: string | null
  image_url?: string | null
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

export const useMenuCategories = () => {
  const { tenantId } = useTenantContext()

  return useQuery({
    queryKey: ['menu-categories', tenantId],
    queryFn: async () => {
      const { data, error } = await ((supabasePublic as any).from('menu_categories') as any)
        .select('*')
        .eq('tenant_id', tenantId)
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
      const { data, error } = await (((supabase as any)
        .from('menu_categories') as any) as any)
        .insert({
          tenant_id: tenantId,
          key: category.key,
          label: category.label,
          description: category.description?.trim() || null,
          image_url: category.image_url ?? null,
          sort_order: category.sort_order ?? 999
        })
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
    mutationFn: async ({ id, key, previousKey, label, description, image_url }: MenuCategoryUpdateInput) => {
      const now = new Date().toISOString()
      const supabaseAny = supabase as any

      const patch: Record<string, unknown> = {
        key,
        label,
        description: description?.trim() || null,
        updated_at: now,
      }
      if (image_url !== undefined) {
        patch.image_url = image_url
      }

      const { data, error } = await ((supabaseAny.from('menu_categories') as any) as any)
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
        const { error: menuItemsError } = await ((supabaseAny.from('menu_items') as any) as any)
          .update({
            category: key,
            updated_at: now
          })
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

export const useUpdateCategoryDescription = () => {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async ({ id, description }: { id: string; description: string | null }) => {
      const { error } = await ((supabase as any).from('menu_categories') as any)
        .update({ description, updated_at: new Date().toISOString() })
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

export const useDeleteMenuCategory = () => {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async ({ id, categoryKey }: DeleteMenuCategoryInput) => {
      const { error: itemsError } = await (supabase.from('menu_items') as any)
        .delete()
        .eq('tenant_id', tenantId!)
        .eq('category', categoryKey)

      if (itemsError) {
        throw new Error(handleSupabaseError(itemsError))
      }

      const { error } = await (supabase.from('menu_categories') as any)
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
