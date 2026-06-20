// @admin-blindatura: settings-form-config
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_BOOKING_HEADER_FONT_SIZE_PX,
  getBookingHeaderTextStyle,
  getCarouselStickyMiniPanelLine,
  getShowOfferDetailsInSummary,
  normalizeBookingPublicFormConfig,
  parseBookingHeaderStylesFromUnknown,
  parseSubTabFromUnknown,
  resolveCarouselSummaryDisplay,
  type BookingPublicFormConfig,
} from '../bookingPublicFormConfig'
import { restaurantSettingRegistry } from '@/features/booking/lib/restaurantSettingRegistry'

describe('parseBookingHeaderStylesFromUnknown — fontSize migrate-on-read', () => {
  it('usa default 34/30/16 quando fontSize assente (legacy)', () => {
    const styles = parseBookingHeaderStylesFromUnknown({
      restaurant_name: { font: 'playfair', color: '#6b4226' },
      page_title: { font: 'playfair', color: '#6b4226' },
      page_description: { font: 'montserrat', color: '#4a2d19' },
    })
    expect(styles.restaurant_name.fontSize).toBe(DEFAULT_BOOKING_HEADER_FONT_SIZE_PX.restaurant_name)
    expect(styles.page_title.fontSize).toBe(DEFAULT_BOOKING_HEADER_FONT_SIZE_PX.page_title)
    expect(styles.page_description.fontSize).toBe(
      DEFAULT_BOOKING_HEADER_FONT_SIZE_PX.page_description,
    )
  })

  it('clamp fontSize fuori range e arrotonda decimali', () => {
    const styles = parseBookingHeaderStylesFromUnknown({
      restaurant_name: { font: 'playfair', color: '#6b4226', fontSize: 5 },
      page_title: { font: 'playfair', color: '#6b4226', fontSize: 50 },
      page_description: { font: 'montserrat', color: '#4a2d19', fontSize: 15.6 },
    })
    expect(styles.restaurant_name.fontSize).toBe(8)
    expect(styles.page_title.fontSize).toBe(38)
    expect(styles.page_description.fontSize).toBe(16)
  })

  it('page_description fontSize oltre 28 → clamp a 28', () => {
    const styles = parseBookingHeaderStylesFromUnknown({
      page_description: { font: 'montserrat', color: '#4a2d19', fontSize: 50 },
    })
    expect(styles.page_description.fontSize).toBe(28)
  })

  it('font id sconosciuto → fallback font del target', () => {
    const styles = parseBookingHeaderStylesFromUnknown({
      page_title: { font: 'not-a-font', color: '#6b4226', fontSize: 22 },
    })
    expect(styles.page_title.font).toBe('playfair')
    expect(styles.page_title.fontSize).toBe(22)
  })

  it('getBookingHeaderTextStyle espone fontSize in px', () => {
    const styles = parseBookingHeaderStylesFromUnknown({
      restaurant_name: { font: 'lora', color: '#6b4226', fontSize: 20 },
      page_title: { font: 'playfair', color: '#6b4226' },
      page_description: { font: 'montserrat', color: '#4a2d19' },
    })
    expect(getBookingHeaderTextStyle('restaurant_name', styles).fontSize).toBe('20px')
    expect(getBookingHeaderTextStyle('page_title', styles).fontSize).toBe('30px')
  })

  it('legacy thirsty-script → dancing-script', () => {
    const styles = parseBookingHeaderStylesFromUnknown({
      page_title: { font: 'thirsty-script', color: '#6b4226' },
    })
    expect(styles.page_title.font).toBe('dancing-script')
  })

  it('default fontWeight: bold su nome/titolo, normal su descrizione', () => {
    const styles = parseBookingHeaderStylesFromUnknown({
      restaurant_name: { font: 'playfair', color: '#6b4226' },
      page_title: { font: 'playfair', color: '#6b4226' },
      page_description: { font: 'montserrat', color: '#4a2d19' },
    })
    expect(styles.restaurant_name.fontWeight).toBe('bold')
    expect(styles.page_title.fontWeight).toBe('bold')
    expect(styles.page_description.fontWeight).toBe('normal')
    expect(styles.page_description.textDecoration).toBe('none')
  })

  it('getBookingHeaderTextStyle espone fontWeight e textDecoration', () => {
    const styles = parseBookingHeaderStylesFromUnknown({
      page_title: {
        font: 'playfair',
        color: '#6b4226',
        fontWeight: 'normal',
        textDecoration: 'underline',
      },
    })
    const css = getBookingHeaderTextStyle('page_title', styles)
    expect(css.fontWeight).toBe(400)
    expect(css.textDecoration).toBe('underline')
  })
})

describe('icone Prenota — migrate-on-read', () => {
  it('card scorrevole: legacy utensils → fork_knife in memoria', () => {
    const tab = parseSubTabFromUnknown({
      id: 'c1',
      label: 'Menu',
      display: 'cards',
      icon: 'utensils',
    })
    expect(tab!.icon).toBe('fork_knife')
  })

  it('slide carosello: legacy chef-hat → lucide_chef_hat', () => {
    const tab = parseSubTabFromUnknown({
      id: 'car1',
      label: 'Offerta',
      display: 'carousel',
      carousel_items: [
        {
          image_url: 'https://example.com/a.jpg',
          icon: 'chef-hat',
        },
      ],
    })
    expect(tab!.carousel_items![0].icon).toBe('lucide_chef_hat')
  })

  it('card scorrevole senza icon nel JSON resta senza icona', () => {
    const tab = parseSubTabFromUnknown({
      id: 'c-none',
      label: 'Senza icona',
      display: 'cards',
    })
    expect(tab!.icon).toBeUndefined()
  })

  it('normalize mantiene assenza icona su card e slide carosello', () => {
    const config: BookingPublicFormConfig = {
      page_title: 'Prenota',
      page_description: 'Desc',
      header_styles: parseBookingHeaderStylesFromUnknown({
        restaurant_name: { font: 'playfair', color: '#6b4226' },
        page_title: { font: 'playfair', color: '#6b4226' },
        page_description: { font: 'montserrat', color: '#4a2d19' },
      }),
      booking_modes: [
        {
          id: 'm1',
          booking_type: 'tavolo',
          enabled: true,
          label: 'Tavolo',
          description: 'D',
          icon: 'fork_knife',
          sub_tabs_enabled: true,
          sub_tabs_presentation: 'carousel',
          sub_tabs: [
            {
              id: 's-card',
              display: 'cards',
              label: 'Card',
            },
            {
              id: 's-car',
              label: 'Carosello',
              display: 'carousel',
              carousel_items: [{ image_url: 'https://example.com/a.jpg', sort_order: 0 }],
            },
          ],
        },
      ],
    }
    const normalized = normalizeBookingPublicFormConfig(config)
    expect(normalized.booking_modes[0].sub_tabs[0].icon).toBeUndefined()
    expect(normalized.booking_modes[0].sub_tabs[1].carousel_items![0].icon).toBeUndefined()
  })

  it('normalize al salvataggio admin scrive chiavi catalogo QR', () => {
    const config: BookingPublicFormConfig = {
      page_title: 'Prenota',
      page_description: 'Desc',
      header_styles: parseBookingHeaderStylesFromUnknown({
        restaurant_name: { font: 'playfair', color: '#6b4226' },
        page_title: { font: 'playfair', color: '#6b4226' },
        page_description: { font: 'montserrat', color: '#4a2d19' },
      }),
      booking_modes: [
        {
          id: 'm1',
          booking_type: 'tavolo',
          enabled: true,
          label: 'Tavolo',
          description: 'D',
          icon: 'utensils' as unknown as BookingPublicFormConfig['booking_modes'][0]['icon'],
          sub_tabs_enabled: true,
          sub_tabs_presentation: 'cards',
          sub_tabs: [
            {
              id: 's1',
              display: 'cards',
              label: 'Card',
              icon: 'star' as unknown as BookingPublicFormConfig['booking_modes'][0]['sub_tabs'][0]['icon'],
            },
          ],
        },
      ],
    }
    const normalized = normalizeBookingPublicFormConfig(config)
    expect(normalized.booking_modes[0].icon).toBe('fork_knife')
    expect(normalized.booking_modes[0].sub_tabs[0].icon).toBe('lucide_salad')
  })

  it('normalize clamp testi ristoratore ai limiti Prenota', () => {
    const long = 'x'.repeat(200)
    const config: BookingPublicFormConfig = {
      page_title: long,
      page_description: long,
      header_styles: parseBookingHeaderStylesFromUnknown({
        restaurant_name: { font: 'playfair', color: '#6b4226' },
        page_title: { font: 'playfair', color: '#6b4226' },
        page_description: { font: 'montserrat', color: '#4a2d19' },
      }),
      booking_modes: [
        {
          id: 'm1',
          booking_type: 'tavolo',
          enabled: true,
          label: long,
          description: long,
          icon: 'fork_knife',
          sub_tabs_enabled: true,
          sub_tabs_presentation: 'cards',
          sub_tabs: [
            {
              id: 's1',
              display: 'cards',
              label: long,
              description: long,
              courses_label: long,
            },
          ],
        },
      ],
    }
    const normalized = normalizeBookingPublicFormConfig(config)
    expect(normalized.page_title.length).toBe(50)
    expect(normalized.page_description.length).toBe(120)
    expect(normalized.booking_modes[0].label.length).toBe(40)
    expect(normalized.booking_modes[0].description.length).toBe(61)
    expect(normalized.booking_modes[0].sub_tabs[0].label.length).toBe(24)
    expect(normalized.booking_modes[0].sub_tabs[0].description!.length).toBe(79)
    expect(normalized.booking_modes[0].sub_tabs[0].courses_label!.length).toBe(12)
  })

  it('booking_badge_label: legacy senza campo funziona, valore nuovo viene trimmato e cappato', () => {
    const long = 'B'.repeat(80)
    const parsedLegacy = restaurantSettingRegistry.booking_public_form_config.parseFromDb({
      page_title: 'Prenota',
      page_description: 'Desc',
      booking_modes: [
        {
          id: 'm-legacy',
          booking_type: 'tavolo',
          enabled: true,
          label: 'Tavolo',
          description: 'D',
          icon: 'fork_knife',
          sub_tabs_enabled: true,
          sub_tabs_presentation: 'cards',
          sub_tabs: [{ id: 's-legacy', display: 'cards', label: 'Sala' }],
        },
      ],
    })
    expect(parsedLegacy).not.toBeNull()
    expect(parsedLegacy!.booking_modes[0].booking_badge_label).toBeUndefined()
    expect(parsedLegacy!.booking_modes[0].sub_tabs[0].booking_badge_label).toBeUndefined()

    const parsed = restaurantSettingRegistry.booking_public_form_config.parseFromDb({
      page_title: 'Prenota',
      page_description: 'Desc',
      booking_modes: [
        {
          id: 'm1',
          booking_type: 'menu_prezzo_fisso',
          enabled: true,
          label: 'Menu degustazione',
          booking_badge_label: ` ${long} `,
          description: 'D',
          icon: 'bowl_food',
          sub_tabs_enabled: true,
          sub_tabs_presentation: 'cards',
          sub_tabs: [
            {
              id: 's1',
              display: 'cards',
              label: 'Cena lunga',
              booking_badge_label: ` ${long} `,
            },
          ],
        },
      ],
    })
    expect(parsed).not.toBeNull()
    expect(parsed!.booking_modes[0].booking_badge_label).toBe('B'.repeat(12))
    expect(parsed!.booking_modes[0].sub_tabs[0].booking_badge_label).toBe('B'.repeat(12))
  })
})

describe('parseSubTabFromUnknown — show_offer_details_in_summary', () => {
  const baseCarousel = {
    id: 'tab-1',
    label: 'Offerta estate',
    display: 'carousel',
    carousel_items: [{ image_url: 'https://example.com/a.jpg' }],
  }

  it('tratta assenza campo come dettaglio ON (legacy)', () => {
    const tab = parseSubTabFromUnknown(baseCarousel)
    expect(tab).not.toBeNull()
    expect(tab!.show_offer_details_in_summary).toBeUndefined()
    expect(getShowOfferDetailsInSummary(tab)).toBe(true)
  })

  it('legge false esplicito su carosello', () => {
    const tab = parseSubTabFromUnknown({
      ...baseCarousel,
      show_offer_details_in_summary: false,
    })
    expect(tab!.show_offer_details_in_summary).toBe(false)
    expect(getShowOfferDetailsInSummary(tab)).toBe(false)
  })

  it('non persiste il campo sulle card scorrevoli', () => {
    const tab = parseSubTabFromUnknown({
      id: 'card-1',
      label: 'Menu fisso',
      display: 'cards',
      show_offer_details_in_summary: false,
    })
    expect(tab).not.toBeNull()
    expect(tab!.show_offer_details_in_summary).toBeUndefined()
  })

  it('rifiuta card scorrevole senza titolo', () => {
    expect(
      parseSubTabFromUnknown({
        id: 'card-empty',
        label: '',
        display: 'cards',
      }),
    ).toBeNull()
    expect(
      parseSubTabFromUnknown({
        id: 'card-preset-no-title',
        label: '',
        display: 'cards',
        preset_id: 'preset-1',
      }),
    ).toBeNull()
  })

  it('accetta card scorrevole con titolo modificato e preset importato', () => {
    const tab = parseSubTabFromUnknown({
      id: 'card-preset',
      label: 'Titolo personalizzato',
      display: 'cards',
      preset_id: 'preset-1',
    })
    expect(tab).not.toBeNull()
    expect(tab!.label).toBe('Titolo personalizzato')
    expect(tab!.preset_id).toBe('preset-1')
  })

  it('rifiuta carosello senza label', () => {
    expect(
      parseSubTabFromUnknown({
        id: 'carousel-empty',
        label: '',
        display: 'carousel',
        carousel_items: [{ image_url: 'https://example.com/a.jpg' }],
      }),
    ).toBeNull()
  })

  it('rifiuta carosello senza foto visibile', () => {
    expect(
      parseSubTabFromUnknown({
        id: 'carousel-no-photo',
        label: 'Carosello',
        display: 'carousel',
        carousel_items: [],
      }),
    ).toBeNull()
    expect(
      parseSubTabFromUnknown({
        id: 'carousel-blank-photo',
        label: 'Carosello',
        display: 'carousel',
        carousel_items: [{ image_url: '   ' }],
      }),
    ).toBeNull()
  })

  it('normalize rimuove caroselli vuoti e resetta la presentazione se non restano sottotab valide', () => {
    const config: BookingPublicFormConfig = {
      page_title: 'Prenota',
      page_description: 'Desc',
      header_styles: parseBookingHeaderStylesFromUnknown({}),
      booking_modes: [
        {
          id: 'm1',
          booking_type: 'tavolo',
          enabled: true,
          label: 'Tavolo',
          description: 'D',
          icon: 'fork_knife',
          sub_tabs_enabled: true,
          sub_tabs_presentation: 'carousel',
          sub_tabs: [
            {
              id: 'empty-carousel',
              label: 'Carosello',
              display: 'carousel',
              carousel_items: [],
            },
          ],
        },
      ],
    }
    const normalized = normalizeBookingPublicFormConfig(config)
    expect(normalized.booking_modes[0].sub_tabs).toEqual([])
    expect(normalized.booking_modes[0].sub_tabs_presentation).toBeNull()
  })

  it('normalize rimuove card senza titolo e resetta la presentazione se non restano sottotab valide', () => {
    const config: BookingPublicFormConfig = {
      page_title: 'Prenota',
      page_description: 'Desc',
      header_styles: parseBookingHeaderStylesFromUnknown({}),
      booking_modes: [
        {
          id: 'm1',
          booking_type: 'tavolo',
          enabled: true,
          label: 'Tavolo',
          description: 'D',
          icon: 'fork_knife',
          sub_tabs_enabled: true,
          sub_tabs_presentation: 'cards',
          sub_tabs: [
            {
              id: 'empty-card',
              label: '',
              display: 'cards',
              preset_id: 'preset-1',
            },
          ],
        },
      ],
    }
    const normalized = normalizeBookingPublicFormConfig(config)
    expect(normalized.booking_modes[0].sub_tabs).toEqual([])
    expect(normalized.booking_modes[0].sub_tabs_presentation).toBeNull()
  })

  it('parseFromDb ricappa testi raw e non mantiene caroselli vuoti come presentazione attiva', () => {
    const long = 'x'.repeat(200)
    const parsed = restaurantSettingRegistry.booking_public_form_config.parseFromDb({
      page_title: long,
      page_description: long,
      booking_modes: [
        {
          id: 'm1',
          booking_type: 'tavolo',
          enabled: true,
          label: long,
          description: long,
          icon: 'fork_knife',
          sub_tabs_enabled: true,
          sub_tabs_presentation: 'carousel',
          sub_tabs: [
            {
              id: 'empty-carousel',
              label: 'Carosello',
              display: 'carousel',
              carousel_items: [],
            },
          ],
        },
      ],
    })
    expect(parsed).not.toBeNull()
    expect(parsed!.page_title.length).toBe(50)
    expect(parsed!.page_description.length).toBe(120)
    expect(parsed!.booking_modes[0].label.length).toBe(40)
    expect(parsed!.booking_modes[0].description.length).toBe(61)
    expect(parsed!.booking_modes[0].sub_tabs).toEqual([])
    expect(parsed!.booking_modes[0].sub_tabs_presentation).toBeNull()
  })
})

describe('capabilities BookingMode — round-trip + legacy (LOCK Parser/normalizer accoppiati)', () => {
  function modeBase(extra: Record<string, unknown> = {}) {
    return {
      id: 'm1',
      booking_type: 'tavolo' as const,
      enabled: true,
      label: 'Tavolo',
      description: 'D',
      icon: 'fork_knife' as BookingPublicFormConfig['booking_modes'][0]['icon'],
      sub_tabs_enabled: true,
      sub_tabs_presentation: null,
      sub_tabs: [],
      ...extra,
    }
  }
  function configWith(mode: Record<string, unknown>): BookingPublicFormConfig {
    return {
      page_title: 'Prenota',
      page_description: 'Desc',
      header_styles: parseBookingHeaderStylesFromUnknown({
        restaurant_name: { font: 'playfair', color: '#6b4226' },
        page_title: { font: 'playfair', color: '#6b4226' },
        page_description: { font: 'montserrat', color: '#4a2d19' },
      }),
      booking_modes: [mode as unknown as BookingPublicFormConfig['booking_modes'][0]],
    }
  }

  it('normalize: config legacy senza capabilities → campo assente (fallback Livello C)', () => {
    const normalized = normalizeBookingPublicFormConfig(configWith(modeBase()))
    expect(normalized.booking_modes[0].capabilities).toBeUndefined()
  })

  it('normalize: capabilities esplicite preservate', () => {
    const normalized = normalizeBookingPublicFormConfig(
      configWith(modeBase({ capabilities: { uses_menu: true, uses_dietary: false } })),
    )
    expect(normalized.booking_modes[0].capabilities).toEqual({ uses_menu: true, uses_dietary: false })
  })

  it('normalize: capabilities malformate scartate (no campo)', () => {
    const normalized = normalizeBookingPublicFormConfig(
      configWith(modeBase({ capabilities: { uses_menu: 'sì' } })),
    )
    expect(normalized.booking_modes[0].capabilities).toBeUndefined()
  })

  it('parseFromDb: legacy senza capabilities → assente; con capabilities → preservate', () => {
    const legacy = restaurantSettingRegistry.booking_public_form_config.parseFromDb({
      page_title: 'Prenota',
      page_description: 'Desc',
      booking_modes: [modeBase()],
    })
    expect(legacy).not.toBeNull()
    expect(legacy!.booking_modes[0].capabilities).toBeUndefined()

    const withCaps = restaurantSettingRegistry.booking_public_form_config.parseFromDb({
      page_title: 'Prenota',
      page_description: 'Desc',
      booking_modes: [modeBase({ capabilities: { uses_menu: true } })],
    })
    expect(withCaps).not.toBeNull()
    expect(withCaps!.booking_modes[0].capabilities).toEqual({ uses_menu: true })
  })
})

describe('resolveCarouselSummaryDisplay / sticky mini-pannello', () => {
  const base = {
    id: 'c1',
    label: 'Carosello',
    display: 'carousel' as const,
    carousel_items: [
      { image_url: 'https://example.com/1.jpg', title: 'Prima offerta' },
      { image_url: 'https://example.com/2.jpg', title: 'Seconda' },
    ],
  }

  it('toggle ON con titoli → lista titoli', () => {
    const tab = parseSubTabFromUnknown(base)
    expect(resolveCarouselSummaryDisplay(tab)?.kind).toBe('titles')
    expect(getCarouselStickyMiniPanelLine(tab)).toBe('Prima offerta')
  })

  it('non inventa label Foto N per slide senza titolo nel riepilogo', () => {
    const tab = parseSubTabFromUnknown({
      ...base,
      carousel_items: [
        { image_url: 'https://example.com/1.jpg', title: 'Prima offerta' },
        { image_url: 'https://example.com/2.jpg' },
      ],
    })
    expect(resolveCarouselSummaryDisplay(tab)).toEqual({
      kind: 'titles',
      titles: ['Prima offerta'],
    })
  })

  it('toggle OFF con prezzo → solo prezzo', () => {
    const tab = parseSubTabFromUnknown({
      ...base,
      show_offer_details_in_summary: false,
      price_per_person: 45,
    })
    expect(resolveCarouselSummaryDisplay(tab)?.kind).toBe('price')
    expect(getCarouselStickyMiniPanelLine(tab)).toMatch(/45.*persona/i)
  })

  it('toggle ON senza titoli ma con prezzo → prezzo', () => {
    const tab = parseSubTabFromUnknown({
      ...base,
      carousel_items: [{ image_url: 'https://example.com/1.jpg' }],
      price_per_person: 30,
    })
    expect(resolveCarouselSummaryDisplay(tab)?.kind).toBe('price')
  })

  it('toggle OFF senza prezzo → null', () => {
    const tab = parseSubTabFromUnknown({
      ...base,
      show_offer_details_in_summary: false,
    })
    expect(resolveCarouselSummaryDisplay(tab)).toBeNull()
    expect(getCarouselStickyMiniPanelLine(tab)).toBeNull()
  })
})

// @admin-blindatura: settings-form-config
describe('compilable_category_keys — parse / serialize / round-trip (LOCK Parser/normalizer accoppiati)', () => {
  const basePersonalizzabile = {
    id: 'card-1',
    display: 'cards',
    label: 'Menu a scelta',
    is_fixed_menu: false,
  }

  it('config legacy senza il campo → assente (tutte compilabili per default)', () => {
    const tab = parseSubTabFromUnknown({
      ...basePersonalizzabile,
      // nessun compilable_category_keys
    })
    expect(tab).not.toBeNull()
    expect(tab!.compilable_category_keys).toBeUndefined()
  })

  it('parse: array valido su card personalizzabile → preservato', () => {
    const tab = parseSubTabFromUnknown({
      ...basePersonalizzabile,
      compilable_category_keys: ['antipasti', 'dolci'],
    })
    expect(tab!.compilable_category_keys).toEqual(['antipasti', 'dolci'])
  })

  it('parse: array vuoto su card personalizzabile → array vuoto (nessuna categoria compilabile)', () => {
    const tab = parseSubTabFromUnknown({
      ...basePersonalizzabile,
      compilable_category_keys: [],
    })
    expect(tab!.compilable_category_keys).toEqual([])
  })

  it('parse: filtro stringhe vuote/invalide', () => {
    const tab = parseSubTabFromUnknown({
      ...basePersonalizzabile,
      compilable_category_keys: ['antipasti', '', '  ', 42, 'dolci'],
    })
    expect(tab!.compilable_category_keys).toEqual(['antipasti', 'dolci'])
  })

  it('parse: campo ignorato su card con is_fixed_menu non false (menu fisso)', () => {
    const tab = parseSubTabFromUnknown({
      id: 'card-fisso',
      display: 'cards',
      label: 'Menu fisso',
      // is_fixed_menu assente = menu fisso
      compilable_category_keys: ['antipasti'],
    })
    expect(tab).not.toBeNull()
    expect(tab!.compilable_category_keys).toBeUndefined()
  })

  it('parse: campo ignorato su card con is_fixed_menu: true', () => {
    const tab = parseSubTabFromUnknown({
      id: 'card-fixed-true',
      display: 'cards',
      label: 'Menu fisso esplicito',
      is_fixed_menu: true,
      compilable_category_keys: ['antipasti'],
    })
    expect(tab!.compilable_category_keys).toBeUndefined()
  })

  it('parse: campo ignorato su carosello (non card)', () => {
    const tab = parseSubTabFromUnknown({
      id: 'car-1',
      label: 'Offerta',
      display: 'carousel',
      is_fixed_menu: false,
      compilable_category_keys: ['antipasti'],
      carousel_items: [{ image_url: 'https://example.com/a.jpg' }],
    })
    expect(tab!.compilable_category_keys).toBeUndefined()
  })

  it('normalize: preserva compilable_category_keys su card personalizzabile', () => {
    const config: BookingPublicFormConfig = {
      page_title: 'Prenota',
      page_description: 'Desc',
      header_styles: parseBookingHeaderStylesFromUnknown({}),
      booking_modes: [{
        id: 'm1',
        booking_type: 'tavolo',
        enabled: true,
        label: 'Tavolo',
        description: 'D',
        icon: 'fork_knife',
        sub_tabs_enabled: true,
        sub_tabs_presentation: 'cards',
        sub_tabs: [{
          id: 's1',
          display: 'cards',
          label: 'Menu a scelta',
          is_fixed_menu: false,
          compilable_category_keys: ['antipasti', 'dolci'],
        }],
      }],
    }
    const normalized = normalizeBookingPublicFormConfig(config)
    expect(normalized.booking_modes[0].sub_tabs[0].compilable_category_keys).toEqual(['antipasti', 'dolci'])
  })

  it('normalize: strip compilable_category_keys se menu fisso (is_fixed_menu non false)', () => {
    const config: BookingPublicFormConfig = {
      page_title: 'Prenota',
      page_description: 'Desc',
      header_styles: parseBookingHeaderStylesFromUnknown({}),
      booking_modes: [{
        id: 'm1',
        booking_type: 'tavolo',
        enabled: true,
        label: 'Tavolo',
        description: 'D',
        icon: 'fork_knife',
        sub_tabs_enabled: true,
        sub_tabs_presentation: 'cards',
        sub_tabs: [{
          id: 's1',
          display: 'cards',
          label: 'Menu fisso',
          // is_fixed_menu assente = fisso
          compilable_category_keys: ['antipasti'] as string[] | undefined,
        }],
      }],
    }
    const normalized = normalizeBookingPublicFormConfig(config)
    expect(normalized.booking_modes[0].sub_tabs[0].compilable_category_keys).toBeUndefined()
  })

  it('round-trip: parseFromDb con campo preserva compilable_category_keys', () => {
    const parsed = restaurantSettingRegistry.booking_public_form_config.parseFromDb({
      page_title: 'Prenota',
      page_description: 'Desc',
      booking_modes: [{
        id: 'm1',
        booking_type: 'tavolo',
        enabled: true,
        label: 'Tavolo',
        description: 'D',
        icon: 'fork_knife',
        sub_tabs_enabled: true,
        sub_tabs_presentation: 'cards',
        sub_tabs: [{
          id: 's1',
          display: 'cards',
          label: 'Menu personalizzabile',
          is_fixed_menu: false,
          compilable_category_keys: ['antipasti', 'primi'],
        }],
      }],
    })
    expect(parsed).not.toBeNull()
    expect(parsed!.booking_modes[0].sub_tabs[0].compilable_category_keys).toEqual(['antipasti', 'primi'])
  })

  it('round-trip: parseFromDb legacy senza il campo → campo assente', () => {
    const parsed = restaurantSettingRegistry.booking_public_form_config.parseFromDb({
      page_title: 'Prenota',
      page_description: 'Desc',
      booking_modes: [{
        id: 'm1',
        booking_type: 'tavolo',
        enabled: true,
        label: 'Tavolo',
        description: 'D',
        icon: 'fork_knife',
        sub_tabs_enabled: true,
        sub_tabs_presentation: 'cards',
        sub_tabs: [{
          id: 's1',
          display: 'cards',
          label: 'Menu personalizzabile',
          is_fixed_menu: false,
          // nessun compilable_category_keys — legacy
        }],
      }],
    })
    expect(parsed).not.toBeNull()
    expect(parsed!.booking_modes[0].sub_tabs[0].compilable_category_keys).toBeUndefined()
  })
})
