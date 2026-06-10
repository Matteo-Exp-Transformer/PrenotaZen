import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { supabasePublic } from '@/lib/supabasePublic'
import { useTenantContext } from '@/contexts/TenantContext'
import type { MenuQrcodeCategoryOverride } from '@/types/menu'

const QUERY_KEY = 'menu-qrcode-categories'

function parseOverride(raw: Record<string, unknown>): MenuQrcodeCategoryOverride {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    menu_qr_code_id: String(raw.menu_qr_code_id),
    category_key: String(raw.category_key),
    title: raw.title != null ? String(raw.title) : null,
    description: raw.description != null ? String(raw.description) : null,
    icon: raw.icon != null ? String(raw.icon) : null,
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
  }
}

/** Lettura pubblica — filtrata per QR (obbligatorio). */
export function usePublicMenuQrcodeCategories(menuQrCodeId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, 'public', menuQrCodeId],
    queryFn: async (): Promise<MenuQrcodeCategoryOverride[]> => {
      const { data, error } = await (supabasePublic
        .from('menu_qrcode_categories') as any)
        .select('*')
        .eq('menu_qr_code_id', menuQrCodeId)

      if (error || !data) return []
      return (data as Record<string, unknown>[]).map(parseOverride)
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
      const { data, error } = await (supabase
        .from('menu_qrcode_categories') as any)
        .select('*')
        .eq('menu_qr_code_id', menuQrCodeId)

      if (error || !data) return []
      return (data as Record<string, unknown>[]).map(parseOverride)
    },
    enabled: !!tenantId && !!menuQrCodeId,
  })
}
