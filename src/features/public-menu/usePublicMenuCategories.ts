import { useQuery } from '@tanstack/react-query'
import { supabasePublic } from '@/lib/supabasePublic'
import type { MenuCategoryRecord } from '@/features/booking/hooks/useMenuCategories'
import { orderMenuCategoriesByFilter } from '@/features/booking/utils/menuQrAppearance'
import { filterMenuCategoriesForPublic } from '@/features/booking/constants/menuMagazzinoLimits'

/** Categorie visibili del QR pubblico: `category_filter` + magazzino `is_available`. */
export function usePublicMenuCategories(
  tenantId: string | null,
  categoryFilter: string[] | null,
) {
  return useQuery({
    queryKey: ['public-menu-categories', tenantId, categoryFilter],
    queryFn: async () => {
      if (categoryFilter !== null && categoryFilter.length === 0) {
        return []
      }

      let query = supabasePublic
        .from('menu_categories')
        .select('id, key, label, description, sort_order, is_available')
        .eq('tenant_id', tenantId!)
        .order('sort_order', { ascending: true })
        .order('label', { ascending: true })

      if (categoryFilter !== null && categoryFilter.length > 0) {
        query = query.in('key', categoryFilter)
      }

      const { data, error } = await query
      if (error) throw error
      const rows = filterMenuCategoriesForPublic((data ?? []) as MenuCategoryRecord[])
      return orderMenuCategoriesByFilter(rows, categoryFilter)
    },
    enabled: !!tenantId,
  })
}
