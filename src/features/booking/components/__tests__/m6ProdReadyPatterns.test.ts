import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { restaurantSettingRegistry } from '@/features/booking/lib/restaurantSettingRegistry'

const repoRoot = process.cwd()

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8')
}

describe('M6 prod-ready patterns', () => {
  it('non usa popup nativi per le conferme admin nei file bonificati', () => {
    const files = [
      'src/features/booking/components/MenuPricesTab.tsx',
      'src/features/booking/components/settings/BookingFormConfigPanel.tsx',
      'src/features/booking/components/settings/BookingFormPromoSection.tsx',
    ]

    for (const file of files) {
      expect(readRepoFile(file), file).not.toMatch(/window\.confirm|[^a-zA-Z]confirm\(/)
    }
  })

  it('mantiene senza as any i punti type-safety critici ripuliti', () => {
    const files = [
      'src/contexts/AdminAuthContext.tsx',
      'src/contexts/TenantContext.tsx',
      'src/features/booking/components/BookingRequestForm.tsx',
      'src/features/booking/hooks/useAdminBookingRequests.ts',
      'src/features/booking/hooks/useBookingMutations.ts',
      'src/features/booking/hooks/useBookingQueries.ts',
    ]

    for (const file of files) {
      expect(readRepoFile(file), file).not.toContain('as any')
    }
  })

  it('non inietta aree posizionamento demo quando il DB non ha valore', () => {
    const parse = restaurantSettingRegistry.booking_placement_areas.parseFromDb
    expect(parse(null)).toEqual([])
    expect(parse(undefined)).toEqual([])
    expect(parse([])).toEqual([])
  })
})
