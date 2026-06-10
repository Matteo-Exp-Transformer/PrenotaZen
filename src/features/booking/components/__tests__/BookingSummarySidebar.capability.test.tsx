// @prenota-blindatura: flusso-utente
// Copre (FU-036 #1): il riepilogo mostra/nasconde i totali per CAPACITÀ
// (modeUsesMenu(activeMode)) e non per nome tipologia. Blinda che una modalità
// «tavolo» con menù via card+preset mostri i totali, e che una senza menù non li mostri.

import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BookingSummarySidebar } from '../publicBooking/BookingSummarySidebar'
import type { BookingMode } from '@/features/booking/constants/bookingPublicFormConfig'

// Il sidebar legge il catalogo categorie via hook: lo neutralizziamo, qui conta solo `hasMenu`.
vi.mock('@/features/booking/hooks/useMenuCategories', () => ({
  useMenuCategories: () => ({ data: [] }),
}))

function makeMode(overrides: Partial<BookingMode>): BookingMode {
  return {
    id: 'm1',
    booking_type: 'tavolo',
    enabled: true,
    label: 'Modalità',
    sub_tabs_enabled: false,
    ...overrides,
  } as BookingMode
}

const MENU_SELECTION = {
  items: [{ id: 'i1', name: 'Antipasto', category: 'antipasti', price: 5 }],
}

describe('BookingSummarySidebar — menù per CAPACITÀ non per nome', () => {
  it('mostra «Il tuo menu» quando la modalità USA il menù anche se booking_type=tavolo', () => {
    // tavolo per NOME non userebbe il menù, ma la capability esplicita (Livello A) vince.
    const modes = [makeMode({ booking_type: 'tavolo', capabilities: { uses_menu: true } })]
    render(
      <BookingSummarySidebar
        formData={{ num_guests: 2, booking_type: 'tavolo', menu_selection: MENU_SELECTION }}
        modes={modes}
      />,
    )
    expect(screen.getByText('Il tuo menu')).toBeInTheDocument()
    expect(screen.getByText('Antipasto')).toBeInTheDocument()
  })

  it('mostra «Il tuo menu» per Livello B: card tavolo con preset collegato', () => {
    const modes = [makeMode({ booking_type: 'tavolo' })]
    render(
      <BookingSummarySidebar
        formData={{ num_guests: 2, booking_type: 'tavolo', menu_selection: MENU_SELECTION }}
        modes={modes}
        activeSubTab={{
          id: 'tab-preset',
          display: 'cards',
          label: 'Menu collegato',
          preset_id: 'preset-1',
        }}
      />,
    )
    expect(screen.getByText('Il tuo menu')).toBeInTheDocument()
    expect(screen.getByText('Antipasto')).toBeInTheDocument()
  })

  it('NON mostra «Il tuo menu» quando la modalità NON usa il menù anche se rinfresco_laurea', () => {
    // rinfresco_laurea per NOME mostrerebbe il menù, ma la capability esplicita lo disattiva.
    const modes = [makeMode({ booking_type: 'rinfresco_laurea', capabilities: { uses_menu: false } })]
    render(
      <BookingSummarySidebar
        formData={{ num_guests: 2, booking_type: 'rinfresco_laurea', menu_selection: MENU_SELECTION }}
        modes={modes}
      />,
    )
    expect(screen.queryByText('Il tuo menu')).not.toBeInTheDocument()
  })

  it('comportamento storico preservato: tavolo senza capability → niente menù', () => {
    const modes = [makeMode({ booking_type: 'tavolo' })]
    render(
      <BookingSummarySidebar
        formData={{ num_guests: 2, booking_type: 'tavolo', menu_selection: MENU_SELECTION }}
        modes={modes}
      />,
    )
    expect(screen.queryByText('Il tuo menu')).not.toBeInTheDocument()
  })
})

const CAROUSEL_SUBTAB = {
  id: 'carousel-1',
  display: 'carousel' as const,
  label: 'Benvenuto!',
  carousel_items: [
    { image_url: 'https://example.com/1.jpg', title: 'Prima offerta', sort_order: 0 },
    { image_url: 'https://example.com/2.jpg', title: 'Seconda offerta', sort_order: 1 },
  ],
}

describe('BookingSummarySidebar — carosello show_offer_details_in_summary', () => {
  const modes = [makeMode({ booking_type: 'rinfresco_laurea', label: 'Rinfresco' })]

  it('toggle ON: nome carosello in Tipo e Opzione menu + titoli slide', () => {
    render(
      <BookingSummarySidebar
        formData={{ num_guests: 2, booking_type: 'rinfresco_laurea', menu_total_per_person: 33, menu_total_booking: 66 }}
        modes={modes}
        activeSubTab={{ ...CAROUSEL_SUBTAB, price_per_person: 33 }}
      />,
    )
    expect(screen.getByText('Tipo')).toBeInTheDocument()
    expect(screen.getAllByText('Benvenuto!').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Opzione menu')).toBeInTheDocument()
    expect(screen.getByText('Offerta selezionata')).toBeInTheDocument()
    expect(screen.getByText('Prima offerta')).toBeInTheDocument()
  })

  it('toggle OFF con prezzo: nasconde nome e titoli, prezzo nel blocco carosello', () => {
    render(
      <BookingSummarySidebar
        formData={{ num_guests: 2, booking_type: 'rinfresco_laurea' }}
        modes={modes}
        activeSubTab={{
          ...CAROUSEL_SUBTAB,
          show_offer_details_in_summary: false,
          price_per_person: 33,
        }}
      />,
    )
    expect(screen.queryByText('Tipo')).not.toBeInTheDocument()
    expect(screen.queryByText('Benvenuto!')).not.toBeInTheDocument()
    expect(screen.queryByText('Opzione menu')).not.toBeInTheDocument()
    expect(screen.queryByText('Offerta selezionata')).not.toBeInTheDocument()
    expect(screen.queryByText('Prima offerta')).not.toBeInTheDocument()
    expect(screen.getByText('33,00 €')).toBeInTheDocument()
    expect(screen.getByText('/persona')).toBeInTheDocument()
  })

  it('toggle OFF senza prezzo: niente nome, titoli né prezzo carosello', () => {
    render(
      <BookingSummarySidebar
        formData={{ num_guests: 2, booking_type: 'rinfresco_laurea' }}
        modes={modes}
        activeSubTab={{ ...CAROUSEL_SUBTAB, show_offer_details_in_summary: false }}
      />,
    )
    expect(screen.queryByText('Benvenuto!')).not.toBeInTheDocument()
    expect(screen.queryByText('Offerta selezionata')).not.toBeInTheDocument()
    expect(screen.queryByText('Prima offerta')).not.toBeInTheDocument()
    expect(screen.queryByText(/\/persona/)).not.toBeInTheDocument()
  })

  it('card sottotab: Tipo mostra etichetta modalità, non influenzata dal toggle carosello', () => {
    render(
      <BookingSummarySidebar
        formData={{ num_guests: 2, booking_type: 'rinfresco_laurea' }}
        modes={modes}
        activeSubTab={{
          id: 'card-1',
          display: 'cards',
          label: 'Menu festa',
          price_per_person: 40,
          is_fixed_menu: true,
        }}
      />,
    )
    expect(screen.getByText('Tipo')).toBeInTheDocument()
    expect(screen.getByText('Rinfresco')).toBeInTheDocument()
    expect(screen.getByText('Menu festa')).toBeInTheDocument()
  })
})
