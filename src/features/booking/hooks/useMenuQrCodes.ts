import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, handleSupabaseError } from '@/lib/supabase'
import { supabasePublic } from '@/lib/supabasePublic'
import { toast } from 'react-toastify'
import { useTenantContext } from '@/contexts/TenantContext'
import { parseMenuQrCodeRow } from '../utils/menuQrAppearance'
import { DEFAULT_THEME_KEY } from '@/features/public-menu/menuThemes'
import {
  importCatalogCategoryImagesToQrStorage,
  menuQrStorageSegment,
  migrateMenuQrDraftAssets,
} from '../utils/menuQrStorage'
import type { MenuQrCodeInput, MenuQrSettingsSavePayload } from '@/types/menu'

export const MENU_QR_CODES_QUERY_KEY = 'menu-qr-codes'

// ── Admin: lettura tutti i QR del tenant ──────────────────────────────────────

export const useMenuQrCodes = () => {
  const { tenantId } = useTenantContext()

  return useQuery({
    queryKey: [MENU_QR_CODES_QUERY_KEY, tenantId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('menu_qr_codes') as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw new Error(handleSupabaseError(error))
      return (data as Record<string, unknown>[]).map(parseMenuQrCodeRow)
    },
    enabled: !!tenantId,
  })
}

// ── Salvataggio unificato modale (QR + override categorie) ────────────────────

export const useSaveMenuQrSettings = () => {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async (payload: MenuQrSettingsSavePayload) => {
      const { shortCode, qrId, input, categoryOverrides, draftShortCode } = payload

      const storageSegment = menuQrStorageSegment(qrId, draftShortCode ?? null)
      let categoryImages = input.category_images ?? {}
      if (storageSegment) {
        categoryImages = await importCatalogCategoryImagesToQrStorage(
          tenantId!,
          storageSegment,
          categoryImages,
        )
      }

      const row = {
        name: input.name,
        category_filter: input.category_filter ?? null,
        is_active: input.is_active ?? true,
        sort_order: input.sort_order ?? 0,
        theme_key: input.theme_key ?? DEFAULT_THEME_KEY,
        carousel_items: input.carousel_items ?? [],
        category_images: categoryImages,
        hidden_menu_item_ids: input.hidden_menu_item_ids ?? [],
        updated_at: new Date().toISOString(),
      }

      let savedId = qrId

      if (savedId) {
        const { error } = await (supabase
          .from('menu_qr_codes') as any)
          .update(row)
          .eq('id', savedId)
          .eq('tenant_id', tenantId!)

        if (error) throw new Error(handleSupabaseError(error))
      } else {
        const { data, error } = await (supabase
          .from('menu_qr_codes') as any)
          .insert({
            tenant_id: tenantId,
            short_code: shortCode,
            ...row,
          })
          .select()
          .single()

        if (error) throw new Error(handleSupabaseError(error))
        savedId = String((data as Record<string, unknown>).id)

        if (draftShortCode) {
          const finalAssets = await migrateMenuQrDraftAssets(
            tenantId!,
            draftShortCode,
            savedId,
            row.carousel_items,
            row.category_images,
          )
          const { error: assetError } = await (supabase
            .from('menu_qr_codes') as any)
            .update({
              carousel_items: finalAssets.carousel_items,
              category_images: finalAssets.category_images,
              updated_at: new Date().toISOString(),
            })
            .eq('id', savedId)
            .eq('tenant_id', tenantId!)

          if (assetError) throw new Error(handleSupabaseError(assetError))
        }
      }

      if (categoryOverrides.length > 0) {
        const overrideRows = categoryOverrides.map((o) => ({
          tenant_id: tenantId,
          menu_qr_code_id: savedId,
          category_key: o.category_key,
          title: o.title,
          description: o.description,
          icon: o.icon ?? null,
          updated_at: new Date().toISOString(),
        }))

        const { error: ovError } = await (supabase
          .from('menu_qrcode_categories') as any)
          .upsert(overrideRows, { onConflict: 'menu_qr_code_id,category_key' })

        if (ovError) throw new Error(handleSupabaseError(ovError))
      }

      return savedId!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MENU_QR_CODES_QUERY_KEY] })
      queryClient.invalidateQueries({ queryKey: ['menu-qrcode-categories'] })
      toast.success('Menù QR salvato')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Errore nel salvataggio del Menù QR')
    },
  })
}

// ── Admin: crea nuovo QR ──────────────────────────────────────────────────────

export const useCreateMenuQrCode = () => {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async ({ shortCode, input }: { shortCode: string; input: MenuQrCodeInput }) => {
      const { data, error } = await (supabase
        .from('menu_qr_codes') as any)
        .insert({
          tenant_id: tenantId,
          short_code: shortCode,
          name: input.name,
          category_filter: input.category_filter ?? null,
          is_active: input.is_active ?? true,
          sort_order: input.sort_order ?? 0,
          theme_key: input.theme_key ?? DEFAULT_THEME_KEY,
          carousel_items: input.carousel_items ?? [],
          category_images: input.category_images ?? {},
        })
        .select()
        .single()

      if (error) throw new Error(handleSupabaseError(error))
      return parseMenuQrCodeRow(data as Record<string, unknown>)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MENU_QR_CODES_QUERY_KEY] })
      toast.success('QR creato')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Errore nella creazione del QR')
    },
  })
}

// ── Admin: aggiorna QR esistente ──────────────────────────────────────────────

export const useUpdateMenuQrCode = () => {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<MenuQrCodeInput> }) => {
      const { data, error } = await (supabase
        .from('menu_qr_codes') as any)
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('tenant_id', tenantId!)
        .select()
        .single()

      if (error) throw new Error(handleSupabaseError(error))
      return parseMenuQrCodeRow(data as Record<string, unknown>)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MENU_QR_CODES_QUERY_KEY] })
      toast.success('QR aggiornato')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Errore nella modifica del QR')
    },
  })
}

// ── Admin: elimina QR ─────────────────────────────────────────────────────────

export const useDeleteMenuQrCode = () => {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from('menu_qr_codes') as any)
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId!)

      if (error) throw new Error(handleSupabaseError(error))
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MENU_QR_CODES_QUERY_KEY] })
      toast.success('QR eliminato')
    },
    onError: (err: Error) => {
      toast.error(err.message || "Errore nell'eliminazione del QR")
    },
  })
}

// ── Pubblico: risolvi short_code → MenuQrCode ─────────────────────────────────

export const usePublicMenuQr = (tenantId: string | null, shortCode: string | null) => {
  const normalizedCode = shortCode?.trim().toLowerCase() ?? null

  return useQuery({
    queryKey: ['public-menu-qr', tenantId, normalizedCode],
    queryFn: async () => {
      const { data, error } = await (supabasePublic
        .from('menu_qr_codes') as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('short_code', normalizedCode)
        .eq('is_active', true)
        .maybeSingle()

      if (error) throw new Error(handleSupabaseError(error))
      if (!data) return null
      return parseMenuQrCodeRow(data as Record<string, unknown>)
    },
    enabled: !!tenantId && !!normalizedCode,
    retry: false,
  })
}

// ── Pubblico: primo QR attivo del tenant (fallback route /menu/:slug) ─────────

export const usePublicDefaultMenuQr = (tenantId: string | null) => {
  return useQuery({
    queryKey: ['public-menu-qr-default', tenantId],
    queryFn: async () => {
      const { data, error } = await (supabasePublic
        .from('menu_qr_codes') as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (error) return null
      return parseMenuQrCodeRow(data as Record<string, unknown>)
    },
    enabled: !!tenantId,
  })
}
