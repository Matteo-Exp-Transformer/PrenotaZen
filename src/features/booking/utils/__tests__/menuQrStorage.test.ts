import { describe, expect, it } from 'vitest'
import {
  applyCatalogPrefillForKey,
  buildCatalogPrefillForKeys,
  isBookingCategoryPhotoUrl,
  isMenuQrCategoryPhotoUrl,
  menuQrCategoryPhotoPath,
  menuQrStoragePrefix,
  shouldRefreshCatalogPrefill,
  storagePathFromPublicUrl,
} from '../menuQrStorage'

const TENANT = 'tenant-abc'
const BASE = `https://example.supabase.co/storage/v1/object/public/menu-photos`

const bookingCatUrl = (categoryId: string) => `${BASE}/${TENANT}/booking-cat/${categoryId}.webp`
const qrCatUrl = (segment: string, categoryKey: string) =>
  `${BASE}/${menuQrCategoryPhotoPath(TENANT, segment, categoryKey)}`

describe('menuQrStorage path helpers', () => {
  it('parses public URL to storage path', () => {
    const url = `${BASE}/${TENANT}/booking-cat/cat-1.webp?v=1`
    expect(storagePathFromPublicUrl(url)).toBe(`${TENANT}/booking-cat/cat-1.webp`)
  })

  it('detects booking-cat catalog URLs', () => {
    const url = `${BASE}/${TENANT}/booking-cat/uuid-here.webp`
    expect(isBookingCategoryPhotoUrl(url, TENANT)).toBe(true)
    expect(isBookingCategoryPhotoUrl(url, 'other-tenant')).toBe(false)
  })

  it('builds QR category photo path', () => {
    expect(menuQrCategoryPhotoPath(TENANT, 'qr-id-1', 'antipasti')).toBe(
      `${menuQrStoragePrefix(TENANT, 'qr-id-1')}/cat/antipasti.webp`,
    )
    expect(menuQrCategoryPhotoPath(TENANT, 'draft/sc7abc', 'dolci')).toBe(
      `${TENANT}/qr/draft/sc7abc/cat/dolci.webp`,
    )
  })

  it('detects QR category thumb URLs', () => {
    expect(isMenuQrCategoryPhotoUrl(qrCatUrl('qr-id-1', 'secondi'), TENANT)).toBe(true)
    expect(isMenuQrCategoryPhotoUrl(qrCatUrl('draft/sc7abc', 'primi'), TENANT)).toBe(true)
    expect(isMenuQrCategoryPhotoUrl(bookingCatUrl('id-a'), TENANT)).toBe(false)
  })
})

describe('catalog prefill (modale QR anteprima)', () => {
  const categories = [
    { key: 'primi', id: 'id-primi', image_url: bookingCatUrl('id-primi') },
    { key: 'secondi', id: 'id-secondi', image_url: bookingCatUrl('id-secondi') },
  ]

  it('prefills empty slot with catalog image_url', () => {
    const result = buildCatalogPrefillForKeys(['secondi'], categories, {}, TENANT)
    expect(result.secondi).toBe(bookingCatUrl('id-secondi'))
  })

  it('replaces stale booking-cat URL (wrong category id) on re-select', () => {
    const stale = { secondi: bookingCatUrl('id-primi') }
    const result = buildCatalogPrefillForKeys(['secondi'], categories, stale, TENANT)
    expect(result.secondi).toBe(bookingCatUrl('id-secondi'))
    expect(shouldRefreshCatalogPrefill(stale.secondi, 'id-secondi', TENANT)).toBe(true)
  })

  it('does not overwrite QR path thumb', () => {
    const qrThumb = qrCatUrl('qr-id-1', 'secondi')
    const existing = { secondi: qrThumb }
    const result = buildCatalogPrefillForKeys(['secondi'], categories, existing, TENANT)
    expect(result).toBe(existing)
    expect(result.secondi).toBe(qrThumb)
    expect(shouldRefreshCatalogPrefill(qrThumb, 'id-secondi', TENANT)).toBe(false)
  })

  it('keeps booking-cat URL when category id matches', () => {
    const url = bookingCatUrl('id-secondi')
    expect(applyCatalogPrefillForKey(url, bookingCatUrl('id-secondi'), 'id-secondi', TENANT)).toBe(
      url,
    )
    expect(shouldRefreshCatalogPrefill(url, 'id-secondi', TENANT)).toBe(false)
  })
})
