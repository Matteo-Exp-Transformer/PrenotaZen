import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseBookingPageBackgroundFromDb } from '@/features/booking/constants/bookingPageBackground'
import { getDefaultBusinessHours } from '@/lib/businessHours'
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
      'src/features/booking/components/servizio/RoomConfigModal.tsx',
      'src/features/booking/components/servizio/TableFormModal.tsx',
      'src/features/booking/components/servizio/ServiceSlotsManager.tsx',
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
      'src/features/booking/hooks/useRestaurantSetting.ts',
      'src/hooks/useBusinessHours.ts',
      'src/lib/email.ts',
      'src/features/booking/hooks/useBookingRequests.ts',
      'src/features/booking/hooks/useMenuItems.ts',
      'src/features/booking/hooks/useMenuQrCodes.ts',
      'src/features/booking/hooks/useMenuQrcodeCategories.ts',
      'src/features/booking/hooks/useMenuCategories.ts',
      'src/hooks/useRestaurantName.ts',
      'src/features/booking/services/syncMenuCategoryKeyRename.ts',
      'src/features/booking/services/syncMenuCategoryKeyDelete.ts',
      'src/pages/PublicMenuPage.tsx',
      'src/pages/PublicMenuCategoryPage.tsx',
      'src/lib/menuPhotoUpload.ts',
      'src/features/booking/hooks/useCarouselPhotoUpload.ts',
      'src/features/booking/components/servizio/WalkInLimitCard.tsx',
      'src/features/booking/components/servizio/RoomConfigModal.tsx',
      'src/features/booking/components/servizio/TableFormModal.tsx',
      'src/features/booking/components/servizio/ServiceSlotsManager.tsx',
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

  it('non inietta orari demo quando business_hours manca in DB', () => {
    const parse = restaurantSettingRegistry.business_hours.parseFromDb
    expect(parse(null)).toEqual(getDefaultBusinessHours())
    expect(parse(undefined)).toEqual(getDefaultBusinessHours())
    expect(parse('invalid')).toEqual(getDefaultBusinessHours())
  })

  it('non inietta sfondo pagina demo quando public_booking_page_background manca in DB', () => {
    const parse = restaurantSettingRegistry.public_booking_page_background.parseFromDb
    expect(parse(null)).toBeNull()
    expect(parse(undefined)).toBeNull()
    expect(parse('')).toBeNull()
    expect(parse('   ')).toBeNull()
    expect(parseBookingPageBackgroundFromDb(null)).toBeNull()
  })

  it('non inietta form config demo quando booking_public_form_config manca in DB', () => {
    const parse = restaurantSettingRegistry.booking_public_form_config.parseFromDb
    expect(parse(null)).toBeNull()
    expect(parse(undefined)).toBeNull()
    expect(parse({ page_title: 'P', booking_modes: [] })).toBeNull()
  })

  it('BookingRequestPage non applica DEFAULT_BOOKING_FORM_CONFIG sul pubblico', () => {
    const page = readRepoFile('src/pages/BookingRequestPage.tsx')
    expect(page).not.toMatch(/formConfig\s*\?\?\s*DEFAULT_BOOKING_FORM_CONFIG/)
    expect(page).not.toMatch(/resolvedConfig/)
    expect(page).toContain('Form prenotazione non ancora configurato')
  })

  it('menuQrStorage non usa cast as any su storage', () => {
    expect(readRepoFile('src/features/booking/utils/menuQrStorage.ts')).not.toContain('as any')
  })
})
