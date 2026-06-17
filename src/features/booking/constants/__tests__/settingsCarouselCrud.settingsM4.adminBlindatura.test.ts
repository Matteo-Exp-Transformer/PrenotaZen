// @admin-blindatura: settings-carousel-crud
// Copre: normalizzazione slide (testi/sort_order), salva+ricarica parseFromDb, legacy/null safe, effetto titoli pubblico

import { describe, expect, it } from 'vitest'
import {
  BOOKING_CAROUSEL_SLIDE_TEXT_LIMITS,
  getCarouselSlideTitles,
  normalizeBookingPublicFormConfig,
  normalizeCarouselSlideItem,
  parseBookingHeaderStylesFromUnknown,
  type BookingPublicFormConfig,
} from '../bookingPublicFormConfig'
import { restaurantSettingRegistry } from '@/features/booking/lib/restaurantSettingRegistry'
import type { CarouselItem } from '@/types/menu'

const CAROUSEL_TAB_ID = 'carousel-crud-1111-1111-1111-111111111111'

function makeCarouselConfig(items: CarouselItem[]): BookingPublicFormConfig {
  return normalizeBookingPublicFormConfig({
    page_title: 'Prenota',
    page_description: 'Desc',
    header_styles: parseBookingHeaderStylesFromUnknown({}),
    booking_modes: [
      {
        id: 'tavolo',
        booking_type: 'tavolo',
        enabled: true,
        label: 'Tavolo',
        description: 'D',
        icon: 'fork_knife',
        sub_tabs_enabled: true,
        sub_tabs_presentation: 'carousel',
        sub_tabs: [
          {
            id: CAROUSEL_TAB_ID,
            display: 'carousel',
            label: 'Offerte estate',
            carousel_items: items,
          },
        ],
      },
    ],
  })
}

describe('settings-carousel-crud — normalizeCarouselSlideItem', () => {
  it('ricappa testi slide e assegna sort_order', () => {
    const overEyebrow = 'E'.repeat(BOOKING_CAROUSEL_SLIDE_TEXT_LIMITS.eyebrow + 5)
    const overTitle = 'T'.repeat(BOOKING_CAROUSEL_SLIDE_TEXT_LIMITS.title + 4)
    const overDesc = 'D'.repeat(BOOKING_CAROUSEL_SLIDE_TEXT_LIMITS.description + 10)

    const normalized = normalizeCarouselSlideItem(
      {
        image_url: 'https://example.com/slide.webp',
        eyebrow: overEyebrow,
        title: overTitle,
        description: overDesc,
        sort_order: 2,
      },
      2,
    )

    expect(normalized.eyebrow).toHaveLength(BOOKING_CAROUSEL_SLIDE_TEXT_LIMITS.eyebrow)
    expect(normalized.title).toHaveLength(BOOKING_CAROUSEL_SLIDE_TEXT_LIMITS.title)
    expect(normalized.description).toHaveLength(BOOKING_CAROUSEL_SLIDE_TEXT_LIMITS.description)
    expect(normalized.sort_order).toBe(2)
  })

  it('mantiene ordine slide dopo normalizeBookingPublicFormConfig (riordino)', () => {
    const config = makeCarouselConfig([
      { image_url: 'https://example.com/a.webp', title: 'Prima', sort_order: 0 },
      { image_url: 'https://example.com/b.webp', title: 'Seconda', sort_order: 1 },
    ])
    const swapped = makeCarouselConfig([
      { image_url: 'https://example.com/b.webp', title: 'Seconda', sort_order: 0 },
      { image_url: 'https://example.com/a.webp', title: 'Prima', sort_order: 1 },
    ])

    const tab = swapped.booking_modes[0].sub_tabs![0]
    expect(tab.carousel_items!.map((s) => s.title)).toEqual(['Seconda', 'Prima'])
    expect(getCarouselSlideTitles(tab)).toEqual(['Seconda', 'Prima'])

    const roundtrip = normalizeBookingPublicFormConfig(config)
    expect(roundtrip.booking_modes[0].sub_tabs![0].carousel_items!.map((s) => s.title)).toEqual([
      'Prima',
      'Seconda',
    ])
  })
})

describe('settings-carousel-crud — salva e ricarica (parseFromDb)', () => {
  it('parseFromDb preserva slide, testi e ordine dopo roundtrip DB', () => {
    const saved = makeCarouselConfig([
      {
        image_url: 'https://cdn.example.com/1.webp',
        eyebrow: 'Antipasti',
        title: 'Tonno crosta',
        description: 'Con verdure',
        sort_order: 0,
      },
      {
        image_url: 'https://cdn.example.com/2.webp',
        title: 'Dolce',
        sort_order: 1,
      },
    ])

    const dbRaw = {
      page_title: saved.page_title,
      page_description: saved.page_description,
      header_styles: saved.header_styles,
      booking_modes: saved.booking_modes,
    }

    const reloaded = restaurantSettingRegistry.booking_public_form_config.parseFromDb(dbRaw)
    expect(reloaded).not.toBeNull()

    const tab = reloaded!.booking_modes[0].sub_tabs![0]
    expect(tab.label).toBe('Offerte estate')
    expect(tab.carousel_items).toHaveLength(2)
    expect(tab.carousel_items![0].title).toBe('Tonno crosta')
    expect(tab.carousel_items![0].eyebrow).toBe('Antipasti')
    expect(tab.carousel_items![1].title).toBe('Dolce')
    expect(getCarouselSlideTitles(tab)).toEqual(['Tonno crosta', 'Dolce'])
  })
})

describe('settings-carousel-crud — legacy/null safe', () => {
  it('carousel_items null o malformati non crashano parseFromDb', () => {
    const parsed = restaurantSettingRegistry.booking_public_form_config.parseFromDb({
      page_title: 'Prenota',
      page_description: 'Desc',
      booking_modes: [
        {
          id: 'tavolo',
          booking_type: 'tavolo',
          enabled: true,
          label: 'Tavolo',
          description: 'D',
          icon: 'fork_knife',
          sub_tabs_enabled: true,
          sub_tabs_presentation: 'carousel',
          sub_tabs: [
            {
              id: CAROUSEL_TAB_ID,
              label: 'Carosello legacy',
              display: 'carousel',
              carousel_items: [null, { title: 'senza foto' }, { image_url: '   ' }],
            },
          ],
        },
      ],
    })

    expect(parsed).not.toBeNull()
    expect(parsed!.booking_modes[0].sub_tabs).toEqual([])
    expect(parsed!.booking_modes[0].sub_tabs_presentation).toBeNull()
  })

  it('slide senza testi ma con foto restano visibili in config normalizzata', () => {
    const config = makeCarouselConfig([{ image_url: 'https://example.com/only-photo.webp', sort_order: 0 }])
    const tab = config.booking_modes[0].sub_tabs![0]
    expect(tab.carousel_items).toHaveLength(1)
    expect(getCarouselSlideTitles(tab, { photoFallback: false })).toEqual([])
  })
})
