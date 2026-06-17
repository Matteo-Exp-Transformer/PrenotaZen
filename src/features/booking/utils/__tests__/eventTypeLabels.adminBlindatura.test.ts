// @admin-blindatura: prenotazioni
// Strip tipologia card richiesta/archivio — label da booking_public_form_config, non demo fisse.

import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import type { BookingMode } from '@/features/booking/constants/bookingPublicFormConfig'
import { getBookingEventTypeLabel } from '@/features/booking/utils/eventTypeLabels'

function makeMode(
  over: Partial<BookingMode> & Pick<BookingMode, 'booking_type'>,
): BookingMode {
  return {
    id: over.booking_type,
    label: over.booking_type,
    description: '',
    enabled: true,
    icon: 'fork_knife',
    sub_tabs_enabled: false,
    sub_tabs_presentation: null,
    sub_tabs: [],
    ...over,
  }
}

describe('@admin-blindatura prenotazioni — getBookingEventTypeLabel da config', () => {
  it('mostra il nome rinominato in Personalizza form, non la label demo', () => {
    const modes = [
      makeMode({
        booking_type: 'menu_prezzo_fisso',
        label: 'Cena di gruppo',
      }),
    ]

    expect(
      getBookingEventTypeLabel({ booking_type: 'menu_prezzo_fisso' }, modes),
    ).toBe('Cena di gruppo')
    expect(
      getBookingEventTypeLabel({ booking_type: 'menu_prezzo_fisso' }, modes),
    ).not.toBe('Menu a prezzo fisso')
  })

  it('senza config tenant usa fallback statico intenzionale (ultimo livello)', () => {
    expect(
      getBookingEventTypeLabel({ booking_type: 'rinfresco_laurea' }, []),
    ).toBe('Rinfresco di Laurea')
  })

  it('restituisce null senza booking_type', () => {
    expect(getBookingEventTypeLabel({ booking_type: null }, [])).toBeNull()
    expect(getBookingEventTypeLabel(undefined, [])).toBeNull()
  })
})
