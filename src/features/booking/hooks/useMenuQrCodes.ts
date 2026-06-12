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
import type { Json, Tables, TablesInsert, TablesUpdate } from '@/types/database'

export const MENU_QR_CODES_QUERY_KEY = 'menu-qr-codes'

function toMenuQrJson(value: unknown): Json {
  return value as unknown as Json
}

function buildMenuQrCodeFields(input: MenuQrCodeInput): Pick<
  TablesUpdate<'menu_qr_codes'>,
  | 'name'
  | 'category_filter'
  | 'is_active'
  | 'sort_order'
  | 'theme_key'
  | 'carousel_items'
  | 'category_images'
  | 'hidden_menu_item_ids'
> {
  return {
    name: input.name,
    category_filter: input.category_filter ?? null,
    is_active: input.is_active ?? true,
    sort_order: input.sort_order ?? 0,
    theme_key: input.theme_key ?? DEFAULT_THEME_KEY,
    carousel_items: toMenuQrJson(input.carousel_items ?? []),
    category_images: toMenuQrJson(input.category_images ?? {}),
    hidden_menu_item_ids: toMenuQrJson(input.hidden_menu_item_ids ?? []),
  }
}

function buildMenuQrCodeUpdate(input: Partial<MenuQrCodeInput>): TablesUpdate<'menu_qr_codes'> {
  const patch: TablesUpdate<'menu_qr_codes'> = {
    updated_at: new Date().toISOString(),
  }

  if (input.name !== undefined) patch.name = input.name
  if (input.category_filter !== undefined) patch.category_filter = input.category_filter
  if (input.is_active !== undefined) patch.is_active = input.is_active
  if (input.sort_order !== undefined) patch.sort_order = input.sort_order
  if (input.theme_key !== undefined) patch.theme_key = input.theme_key
  if (input.carousel_items !== undefined) patch.carousel_items = toMenuQrJson(input.carousel_items)
  if (input.category_images !== undefined) patch.category_images = toMenuQrJson(input.category_images)
  if (input.hidden_menu_item_ids !== undefined) {
    patch.hidden_menu_item_ids = toMenuQrJson(input.hidden_menu_item_ids)
  }

  return patch
}

function parseMenuQrRow(data: Tables<'menu_qr_codes'>) {
  return parseMenuQrCodeRow(data as unknown as Record<string, unknown>)
}

// ── Admin: lettura tutti i QR del tenant ──────────────────────────────────────

export const useMenuQrCodes = () => {
  const { tenantId } = useTenantContext()

  return useQuery({
    queryKey: [MENU_QR_CODES_QUERY_KEY, tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_qr_codes')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw new Error(handleSupabaseError(error))
      return (data ?? []).map(parseMenuQrRow)
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

      const row: TablesUpdate<'menu_qr_codes'> = {
        ...buildMenuQrCodeFields({ ...input, category_images: categoryImages }),
        updated_at: new Date().toISOString(),
      }

      let savedId = qrId

      if (savedId) {
        const { error } = await supabase
          .from('menu_qr_codes')
          .update(row)
          .eq('id', savedId)
          .eq('tenant_id', tenantId!)

        if (error) throw new Error(handleSupabaseError(error))
      } else {
        const insertData: TablesInsert<'menu_qr_codes'> = {
          tenant_id: tenantId!,
          short_code: shortCode,
          name: row.name!,
          category_filter: row.category_filter ?? null,
          is_active: row.is_active ?? true,
          sort_order: row.sort_order ?? 0,
          theme_key: row.theme_key ?? DEFAULT_THEME_KEY,
          carousel_items: row.carousel_items ?? toMenuQrJson([]),
          category_images: row.category_images ?? toMenuQrJson({}),
          hidden_menu_item_ids: row.hidden_menu_item_ids ?? toMenuQrJson([]),
        }

        const { data, error } = await supabase
          .from('menu_qr_codes')
          .insert(insertData)
          .select()
          .single()

        if (error) throw new Error(handleSupabaseError(error))
        savedId = data.id

        if (draftShortCode) {
          const finalAssets = await migrateMenuQrDraftAssets(
            tenantId!,
            draftShortCode,
            savedId,
            input.carousel_items ?? [],
            categoryImages,
          )
          const assetUpdate: TablesUpdate<'menu_qr_codes'> = {
            carousel_items: toMenuQrJson(finalAssets.carousel_items),
            category_images: toMenuQrJson(finalAssets.category_images),
            updated_at: new Date().toISOString(),
          }
          const { error: assetError } = await supabase
            .from('menu_qr_codes')
            .update(assetUpdate)
            .eq('id', savedId)
            .eq('tenant_id', tenantId!)

          if (assetError) throw new Error(handleSupabaseError(assetError))
        }
      }

      if (categoryOverrides.length > 0) {
        const overrideRows: TablesInsert<'menu_qrcode_categories'>[] = categoryOverrides.map((o) => ({
          tenant_id: tenantId!,
          menu_qr_code_id: savedId!,
          category_key: o.category_key,
          title: o.title,
          description: o.description,
          icon: o.icon ?? null,
          updated_at: new Date().toISOString(),
        }))

        const { error: ovError } = await supabase
          .from('menu_qrcode_categories')
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
      const fields = buildMenuQrCodeFields(input)
      const insertData: TablesInsert<'menu_qr_codes'> = {
        tenant_id: tenantId!,
        short_code: shortCode,
        name: input.name,
        category_filter: fields.category_filter ?? null,
        is_active: fields.is_active ?? true,
        sort_order: fields.sort_order ?? 0,
        theme_key: fields.theme_key ?? DEFAULT_THEME_KEY,
        carousel_items: fields.carousel_items ?? toMenuQrJson([]),
        category_images: fields.category_images ?? toMenuQrJson({}),
        hidden_menu_item_ids: fields.hidden_menu_item_ids ?? toMenuQrJson([]),
      }

      const { data, error } = await supabase
        .from('menu_qr_codes')
        .insert(insertData)
        .select()
        .single()

      if (error) throw new Error(handleSupabaseError(error))
      return parseMenuQrRow(data)
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
      const { data, error } = await supabase
        .from('menu_qr_codes')
        .update(buildMenuQrCodeUpdate(input))
        .eq('id', id)
        .eq('tenant_id', tenantId!)
        .select()
        .single()

      if (error) throw new Error(handleSupabaseError(error))
      return parseMenuQrRow(data)
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
      const { error } = await supabase
        .from('menu_qr_codes')
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
      const { data, error } = await supabasePublic
        .from('menu_qr_codes')
        .select('*')
        .eq('tenant_id', tenantId!)
        .eq('short_code', normalizedCode!)
        .eq('is_active', true)
        .maybeSingle()

      if (error) throw new Error(handleSupabaseError(error))
      if (!data) return null
      return parseMenuQrRow(data)
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
      const { data, error } = await supabasePublic
        .from('menu_qr_codes')
        .select('*')
        .eq('tenant_id', tenantId!)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (error) return null
      return parseMenuQrRow(data)
    },
    enabled: !!tenantId,
  })
}
