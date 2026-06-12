import { supabase, handleSupabaseError } from '@/lib/supabase'
import { restaurantSettingRegistry } from '@/features/booking/lib/restaurantSettingRegistry'
import { renameCategoryKeyInBookingPublicFormConfig } from '@/features/booking/utils/bookingFormCategoryKeySync'
import {
  applyCategoryImageUrlRewritesForRename,
  renameCategoryKeyInQrRow,
} from '@/features/booking/utils/menuQrCategoryKeySync'
import { parseMenuQrCodeRow } from '@/features/booking/utils/menuQrAppearance'
import {
  menuQrStorageSegment,
  tryCopyQrCategoryPhotoOnRename,
} from '@/features/booking/utils/menuQrStorage'
import type { Json, TablesInsert, TablesUpdate } from '@/types/database'

const BUCKET = 'menu-photos'

function publicUrlForPath(path: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

function toMenuQrJson(value: unknown): Json {
  return value as unknown as Json
}

type QrcodeCategoryRow = {
  id: string
  menu_qr_code_id: string
  category_key: string
  title: string | null
  description: string | null
  icon: string | null
}

/**
 * Rinomina `category_key` in `menu_qrcode_categories` per un QR.
 * Conflitto UNIQUE (menu_qr_code_id, category_key): unisce title/description/icon
 * dalla riga vecchia nella riga `newKey` se presente, poi elimina la riga `previousKey`.
 */
async function renameQrcodeCategoryOverridesForQr(
  tenantId: string,
  menuQrCodeId: string,
  previousKey: string,
  newKey: string,
): Promise<void> {
  const { data: rows, error: fetchError } = await supabase
    .from('menu_qrcode_categories')
    .select('id, menu_qr_code_id, category_key, title, description, icon')
    .eq('tenant_id', tenantId)
    .eq('menu_qr_code_id', menuQrCodeId)

  if (fetchError) {
    throw new Error(handleSupabaseError(fetchError))
  }

  const oldRow = ((rows ?? []) as QrcodeCategoryRow[]).find((r) => r.category_key === previousKey)
  if (!oldRow) return

  const newRow = ((rows ?? []) as QrcodeCategoryRow[]).find((r) => r.category_key === newKey)
  const now = new Date().toISOString()

  if (!newRow) {
    const patch: TablesUpdate<'menu_qrcode_categories'> = {
      category_key: newKey,
      updated_at: now,
    }
    const { error } = await supabase
      .from('menu_qrcode_categories')
      .update(patch)
      .eq('id', oldRow.id)
      .eq('tenant_id', tenantId)

    if (error) throw new Error(handleSupabaseError(error))
    return
  }

  const mergePatch: TablesUpdate<'menu_qrcode_categories'> = {
    title: oldRow.title ?? newRow.title,
    description: oldRow.description ?? newRow.description,
    icon: oldRow.icon ?? newRow.icon,
    updated_at: now,
  }
  const { error: mergeError } = await supabase
    .from('menu_qrcode_categories')
    .update(mergePatch)
    .eq('id', newRow.id)
    .eq('tenant_id', tenantId)

  if (mergeError) throw new Error(handleSupabaseError(mergeError))

  const { error: deleteError } = await supabase
    .from('menu_qrcode_categories')
    .delete()
    .eq('id', oldRow.id)
    .eq('tenant_id', tenantId)

  if (deleteError) throw new Error(handleSupabaseError(deleteError))
}

/**
 * Dopo rename categoria in `menu_categories`: allinea Menù QR del tenant,
 * override `menu_qrcode_categories` e `hidden_category_keys` in Personalizza form.
 */
export async function syncMenuCategoryKeyRename(
  tenantId: string,
  previousKey: string,
  newKey: string,
): Promise<void> {
  if (previousKey === newKey) return

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
    const patched = renameCategoryKeyInQrRow(previousKey, newKey, {
      category_filter: qr.category_filter,
      category_images: qr.category_images,
    })

    const storageSegment = menuQrStorageSegment(qr.id, null)
    let category_images = patched.category_images

    if (storageSegment && patched.shouldCopyStoragePhoto) {
      await tryCopyQrCategoryPhotoOnRename(tenantId, storageSegment, previousKey, newKey)
      category_images = applyCategoryImageUrlRewritesForRename(
        category_images,
        tenantId,
        storageSegment,
        previousKey,
        newKey,
        publicUrlForPath,
      )
    }

    if (patched.changed) {
      const patch: TablesUpdate<'menu_qr_codes'> = {
        category_filter: patched.category_filter,
        category_images: toMenuQrJson(category_images),
        updated_at: now,
      }
      const { error: updateError } = await supabase
        .from('menu_qr_codes')
        .update(patch)
        .eq('id', qr.id)
        .eq('tenant_id', tenantId)

      if (updateError) throw new Error(handleSupabaseError(updateError))
    }

    await renameQrcodeCategoryOverridesForQr(tenantId, qr.id, previousKey, newKey)
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

    const { config: nextConfig, changed } = renameCategoryKeyInBookingPublicFormConfig(
      parsed,
      previousKey,
      newKey,
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

export const CATEGORY_KEY_RENAME_INFO_MESSAGE =
  'Hai rinominato la categoria. I Menù QR (e le impostazioni collegate) useranno il nuovo nome interno al salvataggio. Puoi ancora personalizzare foto, titoli e icone in "Impostazione Menù QR" e in "Personalizza form" come fai oggi.'
