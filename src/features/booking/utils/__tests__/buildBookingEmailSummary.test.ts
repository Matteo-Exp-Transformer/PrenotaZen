import { describe, expect, it } from 'vitest'
import type { BookingRequest } from '@/types/booking'
import type { BookingMode, SubTab } from '@/features/booking/constants/bookingPublicFormConfig'
import { customPresetStorageId } from '@/features/booking/constants/presetMenus'
import {
  buildBookingEmailSummaryHtml,
  buildBookingEmailSummarySections,
  resolveSubTabFromBooking,
  stripSubTabAutoPrefix,
  type BookingEmailSummaryContext,
} from '../buildBookingEmailSummary'
import { getBookingAcceptedEmail, getBookingRejectedEmail } from '@/lib/emailTemplates'

const PRESET_UUID = 'aaaa-bbbb-cccc-dddd'
const PRESET_KEY = customPresetStorageId(PRESET_UUID)

function baseBooking(overrides: Partial<BookingRequest> = {}): BookingRequest {
  return {
    id: 'br-1',
    created_at: '2026-06-15T10:00:00Z',
    updated_at: '2026-06-15T10:00:00Z',
    client_name: 'Anna Rossi',
    client_email: 'anna@example.com',
    event_type: 'drink_caraffe',
    desired_date: '2026-07-20',
    desired_time: '20:00',
    num_guests: 4,
    status: 'pending',
    tenant_id: 'tenant-1',
    booking_type: 'tavolo',
    ...overrides,
  }
}

const tavoloMode: BookingMode = {
  id: 'mode-tavolo',
  booking_type: 'tavolo',
  enabled: true,
  label: 'Prenota un Tavolo',
  description: '',
  icon: 'fork_knife',
  sub_tabs_enabled: false,
  sub_tabs_presentation: null,
  sub_tabs: [],
}

const cardSubTab: SubTab = {
  id: 'sub-1',
  display: 'cards',
  label: 'Menu Laurea Premium',
  preset_id: PRESET_UUID,
  price_per_person: 35,
  is_fixed_menu: true,
}

const rinfrescoMode: BookingMode = {
  id: 'mode-rinfresco',
  booking_type: 'rinfresco_laurea',
  enabled: true,
  label: 'Rinfresco di Laurea',
  description: '',
  icon: 'fork_knife',
  sub_tabs_enabled: true,
  sub_tabs_presentation: 'cards',
  sub_tabs: [cardSubTab],
}

const carouselSubTab: SubTab = {
  id: 'sub-carousel',
  display: 'carousel',
  label: 'Offerta Estate',
  price_per_person: 28,
  show_offer_details_in_summary: true,
  carousel_items: [
    { image_url: 'https://example.com/1.jpg', title: 'Antipasti misti', sort_order: 0 },
    { image_url: 'https://example.com/2.jpg', title: 'Secondo del giorno', sort_order: 1 },
  ],
}

const carouselMode: BookingMode = {
  id: 'mode-carousel',
  booking_type: 'menu_prezzo_fisso',
  enabled: true,
  label: 'Menu a Prezzo Fisso',
  description: '',
  icon: 'fork_knife',
  sub_tabs_enabled: true,
  sub_tabs_presentation: 'carousel',
  sub_tabs: [carouselSubTab],
}

const carouselHiddenMode: BookingMode = {
  ...carouselMode,
  id: 'mode-carousel-hidden',
  sub_tabs: [
    {
      ...carouselSubTab,
      show_offer_details_in_summary: false,
    },
  ],
}

const context = (modes: BookingMode[]): BookingEmailSummaryContext => ({
  modes,
  customStaffPresets: [
    {
      id: PRESET_UUID,
      name: 'Menu Laurea Premium',
      item_ids: ['item-1', 'item-2'],
      booking_types: ['rinfresco_laurea'],
    },
  ],
  menuCategories: [
    { key: 'antipasti', label: 'Antipasti', sort_order: 1 },
    { key: 'secondi', label: 'Secondi', sort_order: 2 },
  ],
})

describe('buildBookingEmailSummary — email rifiutata', () => {
  it('non include riepilogo dettagliato', () => {
    const booking = baseBooking({
      booking_type: 'rinfresco_laurea',
      preset_menu: PRESET_KEY,
      menu_selection: {
        items: [{ id: 'i1', name: 'Crudo', price: 6, category: 'antipasti', totalPrice: 6 }],
      },
      special_requests: 'Nota cliente',
      dietary_restrictions: [{ restriction: 'celiachia', guest_count: 1 }],
      menu_promo_labels: ['Promo estate'],
    })

    expect(buildBookingEmailSummarySections(booking, context([rinfrescoMode]), 'rejected')).toEqual([])
    expect(buildBookingEmailSummaryHtml(booking, context([rinfrescoMode]), 'rejected')).toBe('')

    const rejectedHtml = getBookingRejectedEmail(booking, undefined, context([rinfrescoMode])).html
    expect(rejectedHtml).not.toContain('Il tuo menu')
    expect(rejectedHtml).not.toContain('Intolleranze')
    expect(rejectedHtml).not.toContain('Promo')
  })
})

describe('buildBookingEmailSummary — tipologia tavolo (confermata)', () => {
  it('mostra label da config e nessuna riga menù se assente', () => {
    const booking = baseBooking({ booking_type: 'tavolo' })
    const sections = buildBookingEmailSummarySections(booking, context([tavoloMode]), 'accepted')

    const labels = sections.map((s) => s.label ?? s.kind)
    expect(labels).toContain('Tipo')
    const tipo = sections.find((s) => s.label === 'Tipo')
    expect(tipo?.value).toBe('Prenota un Tavolo')
    expect(sections.some((s) => s.kind === 'menu_items')).toBe(false)
  })
})

describe('buildBookingEmailSummary — card con preset e menu_selection', () => {
  it('elenca voci menù ordinate per categoria', () => {
    const booking = baseBooking({
      booking_type: 'rinfresco_laurea',
      preset_menu: PRESET_KEY,
      menu_selection: {
        items: [
          { id: 'i2', name: 'Brasato', price: 8, category: 'secondi', totalPrice: 8 },
          { id: 'i1', name: 'Crudo', price: 6, category: 'antipasti', totalPrice: 6 },
        ],
      },
      menu_total_per_person: 35,
      menu_total_booking: 140,
      num_guests: 4,
    })

    const sections = buildBookingEmailSummarySections(
      booking,
      context([rinfrescoMode]),
      'accepted',
    )

    const menu = sections.find((s) => s.kind === 'menu_items')
    expect(menu?.items?.map((i) => i.name)).toEqual(['Crudo', 'Brasato'])
    expect(menu?.items?.[0]?.categoryLabel).toBe('Antipasti')
    expect(sections.some((s) => s.label === 'Opzione menu')).toBe(true)
  })
})

describe('buildBookingEmailSummary — carosello show_offer_details', () => {
  it('con show_offer_details on mostra tipo e offerta selezionata', () => {
    const booking = baseBooking({
      booking_type: 'menu_prezzo_fisso',
      menu_total_per_person: 28,
      menu_total_booking: 56,
      num_guests: 2,
    })
    const sections = buildBookingEmailSummarySections(
      booking,
      context([carouselMode]),
      'accepted',
    )

    expect(sections.some((s) => s.label === 'Tipo' && s.value === 'Offerta Estate')).toBe(true)
    const offerta = sections.find((s) => s.kind === 'offerta_carosello_titles')
    expect(offerta?.titles).toEqual(['Antipasti misti', 'Secondo del giorno'])
  })

  it('con show_offer_details off nasconde tipo/offerta e mostra solo prezzo se presente', () => {
    const booking = baseBooking({
      booking_type: 'menu_prezzo_fisso',
      menu_total_per_person: 28,
      menu_total_booking: 56,
      num_guests: 2,
    })
    const sections = buildBookingEmailSummarySections(
      booking,
      context([carouselHiddenMode]),
      'accepted',
    )

    expect(sections.some((s) => s.label === 'Tipo')).toBe(false)
    expect(sections.some((s) => s.kind === 'offerta_carosello_titles')).toBe(false)
    expect(sections.some((s) => s.kind === 'offerta_carosello_price')).toBe(true)
  })
})

describe('buildBookingEmailSummary — confermata: totali e promo', () => {
  it('usa label Totale, senza riga barrata preset né promo', () => {
    const booking = baseBooking({
      booking_type: 'rinfresco_laurea',
      preset_menu: PRESET_KEY,
      menu_selection: {
        items: [{ id: 'i1', name: 'Crudo', price: 6, category: 'antipasti', totalPrice: 6 }],
      },
      menu_total_per_person: 35,
      menu_total_booking: 140,
      menu_promo_labels: ['Promo estate'],
    })

    const html = getBookingAcceptedEmail(booking, undefined, context([rinfrescoMode])).html
    expect(html).toContain('Totale')
    expect(html).not.toContain('Totale stimato')
    expect(html).not.toContain('Totale senza menù preselezionato')
    expect(html).not.toContain('Promo')
  })
})

describe('buildBookingEmailSummary — nessun event_type legacy', () => {
  it('HTML accetta/rifiuta non contiene EVENT_TYPE_LABELS né drink_caraffe', () => {
    const booking = baseBooking({
      booking_type: 'rinfresco_laurea',
      event_type: 'drink_caraffe',
      preset_menu: PRESET_KEY,
      menu_selection: {
        items: [{ id: 'i1', name: 'Crudo', price: 6, category: 'antipasti', totalPrice: 6 }],
      },
      menu_total_per_person: 35,
      menu_total_booking: 140,
    })

    const ctx = context([rinfrescoMode])
    const accepted = getBookingAcceptedEmail(booking, undefined, ctx).html
    const rejected = getBookingRejectedEmail(booking, undefined, ctx).html

    for (const html of [accepted, rejected]) {
      expect(html).not.toMatch(/Drink\/Caraffe/i)
      expect(html).not.toMatch(/Tipo Evento/i)
      expect(html).not.toContain('event_type')
      expect(html).not.toContain('drink_caraffe')
    }
  })
})

describe('buildBookingEmailSummary — special_requests senza duplicato sottotab', () => {
  it('strippa prefisso [Sottotab] e non duplica in note se opzione menu visibile', () => {
    expect(stripSubTabAutoPrefix('[Menu Laurea Premium - €35/p] Voglio tavolo vicino finestra')).toBe(
      'Voglio tavolo vicino finestra',
    )

    const booking = baseBooking({
      booking_type: 'rinfresco_laurea',
      preset_menu: PRESET_KEY,
      special_requests: '[Menu Laurea Premium - €35/p] Voglio tavolo vicino finestra',
      menu_selection: {
        items: [{ id: 'i1', name: 'Crudo', price: 6, category: 'antipasti', totalPrice: 6 }],
      },
      menu_total_per_person: 35,
      menu_total_booking: 140,
    })

    const sections = buildBookingEmailSummarySections(
      booking,
      context([rinfrescoMode]),
      'accepted',
    )

    const note = sections.find((s) => s.kind === 'note')
    expect(note?.value).toBe('Voglio tavolo vicino finestra')
    expect(buildBookingEmailSummaryHtml(booking, context([rinfrescoMode]), 'accepted')).not.toContain(
      '[Menu Laurea Premium',
    )
  })
})

describe('resolveSubTabFromBooking', () => {
  it('risolve da preset_menu custom:uuid', () => {
    const booking = baseBooking({
      booking_type: 'rinfresco_laurea',
      preset_menu: PRESET_KEY,
    })
    const resolved = resolveSubTabFromBooking(
      booking,
      rinfrescoMode,
      context([rinfrescoMode]).customStaffPresets,
    )
    expect(resolved?.id).toBe('sub-1')
    expect(resolved?.label).toBe('Menu Laurea Premium')
  })
})
