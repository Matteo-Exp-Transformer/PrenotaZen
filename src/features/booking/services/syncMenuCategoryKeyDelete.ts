import { supabase, handleSupabaseError } from '@/lib/supabase'
import { restaurantSettingRegistry } from '@/features/booking/lib/restaurantSettingRegistry'
import { removeCategoryKeyFromBookingPublicFormConfig } from '@/features/booking/utils/bookingFormCategoryKeySync'
import { deleteCategoryKeyFromQrRow } from '@/features/booking/utils/menuQrCategoryKeySync'
import { parseMenuQrCodeRow } from '@/features/booking/utils/menuQrAppearance'
import { menuQrCategoryPhotoPath, menuQrStorageSegment } from '@/features/booking/utils/menuQrStorage'
import { removeMenuPhotoPath } from '@/features/booking/hooks/useCarouselPhotoUpload'
import type { Json, TablesInsert, TablesUpdate } from '@/types/database'

function toMenuQrJson(value: unknown): Json {
  return value as unknown as Json
}

/**
 * Dopo delete categoria in `menu_categories`: rimuove la chiave da tutti i Menù QR del tenant,
 * elimina override `menu_qrcode_categories` e aggiorna `hidden_category_keys` in Personalizza form.
 */
export async function syncMenuCategoryKeyDelete(
  tenantId: string,
  categoryKey: string,
): Promise<void> {
  const { data: qrRows, error: qrListError } = await supabase
    .from('menu_qr_codes')
    .select('*')
    .eq('tenant_id', tenantId)

  if (qrListError) {
    throw new Error(handleSupabaseError(qrListError))
  }

  const now = new Date().toISOString()

  for (const raw of qrRows ?? []) {
    const qr = parseMenuQrCodeRow(raw as Record<string, unknown>)
    const patched = deleteCategoryKeyFromQrRow(categoryKey, {
      category_filter: qr.category_filter,
      category_images: qr.category_images,
    })

    const storageSegment = menuQrStorageSegment(qr.id, null)
    if (storageSegment && patched.shouldRemoveStoragePhoto) {
      const path = menuQrCategoryPhotoPath(tenantId, storageSegment, categoryKey)
      try {
        await removeMenuPhotoPath(path)
      } catch {
        // file assente o già rimosso
      }
    }

    if (patched.changed) {
      const patch: TablesUpdate<'menu_qr_codes'> = {
        category_filter: patched.category_filter,
        category_images: toMenuQrJson(patched.category_images),
        updated_at: now,
      }
      const { error: updateError } = await supabase
        .from('menu_qr_codes')
        .update(patch)
        .eq('id', qr.id)
        .eq('tenant_id', tenantId)

      if (updateError) throw new Error(handleSupabaseError(updateError))
    }
  }

  const { error: overridesDeleteError } = await supabase
    .from('menu_qrcode_categories')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('category_key', categoryKey)

  if (overridesDeleteError) {
    throw new Error(handleSupabaseError(overridesDeleteError))
  }

  const { data: formSetting, error: formFetchError } = await supabase
    .from('restaurant_settings')
    .select('setting_value')
    .eq('tenant_id', tenantId)
    .eq('setting_key', 'booking_public_form_config')
    .maybeSingle()

  if (formFetchError) {
    throw new Error(handleSupabaseError(formFetchError))
  }

  if (formSetting?.setting_value != null) {
    const parsed = restaurantSettingRegistry.booking_public_form_config.parseFromDb(
      formSetting.setting_value,
    )
    if (!parsed) return

    const { config: nextConfig, changed } = removeCategoryKeyFromBookingPublicFormConfig(
      parsed,
      categoryKey,
    )

    if (changed) {
      const serialized = restaurantSettingRegistry.booking_public_form_config.serializeToDb(
        nextConfig as never,
      )

      const rows: TablesInsert<'restaurant_settings'>[] = [
        {
          tenant_id: tenantId,
          setting_key: 'booking_public_form_config',
          setting_value: serialized as Json,
        },
      ]

      const { error: formUpsertError } = await supabase
        .from('restaurant_settings')
        .upsert(rows, { onConflict: 'tenant_id,setting_key' })

      if (formUpsertError) {
        throw new Error(handleSupabaseError(formUpsertError))
      }
    }
  }
}

export const CATEGORY_KEY_DELETE_INFO_MESSAGE =
  'La categoria verrà rimossa anche dai Menù QR collegati (foto card, titoli e filtri). Le impostazioni in "Personalizza form" che usavano questa categoria saranno aggiornate.'
