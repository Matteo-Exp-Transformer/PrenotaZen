import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { supabasePublic } from '@/lib/supabasePublic'
import { useTenantContext } from '@/contexts/TenantContext'
import type { MenuQrcodeCategoryOverride } from '@/types/menu'
import type { Tables } from '@/types/database'

const QUERY_KEY = 'menu-qrcode-categories'

function parseOverride(raw: Tables<'menu_qrcode_categories'>): MenuQrcodeCategoryOverride {
  return {
    id: raw.id,
    tenant_id: raw.tenant_id,
    menu_qr_code_id: raw.menu_qr_code_id,
    category_key: raw.category_key,
    title: raw.title,
    description: raw.description,
    icon: raw.icon,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  }
}

/** Lettura pubblica — filtrata per QR (obbligatorio). */
export function usePublicMenuQrcodeCategories(menuQrCodeId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, 'public', menuQrCodeId],
    queryFn: async (): Promise<MenuQrcodeCategoryOverride[]> => {
      const { data, error } = await supabasePublic
        .from('menu_qrcode_categories')
        .select('*')
        .eq('menu_qr_code_id', menuQrCodeId!)

      if (error || !data) return []
      return data.map(parseOverride)
    },
    enabled: !!menuQrCodeId,
  })
}

/** Lettura admin — override di un singolo QR. */
export function useMenuQrcodeCategoriesForQr(menuQrCodeId: string | null) {
  const { tenantId } = useTenantContext()
  return useQuery({
    queryKey: [QUERY_KEY, 'admin', tenantId, menuQrCodeId],
    queryFn: async (): Promise<MenuQrcodeCategoryOverride[]> => {
      const { data, error } = await supabase
        .from('menu_qrcode_categories')
        .select('*')
        .eq('menu_qr_code_id', menuQrCodeId!)

      if (error || !data) return []
      return data.map(parseOverride)
    },
    enabled: !!tenantId && !!menuQrCodeId,
  })
}
