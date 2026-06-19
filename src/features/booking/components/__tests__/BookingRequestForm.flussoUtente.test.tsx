// @prenota-blindatura: flusso-utente
// Copre (PRENOTA_SKILL §2-bis flusso Anna + §3 limiti voluti + §3-bis capability):
//  - submit a form vuoto → niente POST (mutate non chiamato), attenzione sul primo campo;
//  - cambio tipologia a metà compilazione → reset stato menù/preset/totali e reset intolleranze
//    per CAPACITÀ (tavolo non usa intolleranze → si svuotano; rinfresco le usa → si conservano);
//  - cap testo cliente SILENZIOSO: l'input taglia oltre il limite senza contatore (regola §3).
//
// Il componente dipende da molti hook dati: li mockiamo (come BookingSummarySidebar.capability.test)
// così il test esercita la VERA logica di stato/validazione del form, non una replica.

import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mutateSpy = vi.fn()

// --- Mock degli hook dati (nessuna rete, valori deterministici) ---
vi.mock('@/features/booking/hooks/useBookingRequests', () => ({
  useCreateBookingRequest: () => ({ mutate: mutateSpy, isPending: false }),
}))
vi.mock('@/hooks/useRateLimit', () => ({
  useRateLimit: () => ({ checkRateLimit: () => true, isBlocked: false }),
}))
vi.mock('@/hooks/useBusinessHours', () => ({
  // Nessun orario caricato → la validazione orari è non-bloccante (vedi BookingRequestForm).
  useBusinessHours: () => ({ data: null, isLoading: false, error: null }),
}))
vi.mock('@/features/booking/hooks/useMenuItems', () => ({
  useMenuItems: () => ({ data: [], isLoading: false, isFetching: false }),
}))
vi.mock('@/features/booking/hooks/useRestaurantSetting', () => ({
  useRestaurantSetting: () => ({ data: undefined, isLoading: false, isFetching: false }),
}))
vi.mock('@/features/booking/hooks/useMenuCategories', () => ({
  useMenuCategories: () => ({ data: [] }),
}))

import { BookingRequestForm } from '../BookingRequestForm'
import type { BookingPublicFormConfig, BookingMode } from '../../constants/bookingPublicFormConfig'
import { BOOKING_PUBLIC_CLIENT_TEXT_LIMITS } from '../../constants/bookingPrenotaTextLimits'

function makeMode(over: Partial<BookingMode>): BookingMode {
  return {
    id: over.id ?? over.booking_type ?? 'm',
    booking_type: 'tavolo',
    enabled: true,
    label: 'Tavolo',
    description: '',
    icon: 'utensils' as BookingMode['icon'],
    sub_tabs_enabled: false,
    sub_tabs_presentation: null,
    sub_tabs: [],
    ...over,
  }
}

function makeConfig(modes: BookingMode[]): BookingPublicFormConfig {
  return {
    page_title: 'Prenota',
    page_description: '',
    header_styles: {} as BookingPublicFormConfig['header_styles'],
    booking_modes: modes,
  }
}

function renderForm(config: BookingPublicFormConfig, onFormDataChange?: (d: unknown) => void) {
  return render(
    <MemoryRouter>
      <BookingRequestForm formConfig={config} onFormDataChange={onFormDataChange} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mutateSpy.mockClear()
  try {
    window.sessionStorage.clear()
  } catch {
    /* jsdom: ignora */
  }
})

describe('BookingRequestForm — submit a form vuoto (§2-bis: invalido → niente POST)', () => {
  it('non chiama mutate (niente invio) e segnala attenzione sul primo campo', () => {
    const config = makeConfig([makeMode({ booking_type: 'tavolo' })])
    const { container } = renderForm(config)

    const form = container.querySelector('#booking-request-form') as HTMLFormElement
    expect(form).toBeTruthy()
    fireEvent.submit(form)

    // Nessuna prenotazione inviata: la validazione blocca prima della mutation.
    expect(mutateSpy).not.toHaveBeenCalled()

    // Lampeggio "attenzione" applicato ad almeno un campo (primo errore = nome).
    const attention = container.querySelectorAll('.booking-public-field-attention')
    expect(attention.length).toBeGreaterThan(0)

    // Messaggio errore nome obbligatorio visibile.
    expect(screen.getByText('Nome obbligatorio')).toBeInTheDocument()
  })
})

describe('BookingRequestForm — cap testo cliente silenzioso (§3: nessun contatore, taglio muto)', () => {
  it('il campo Nome non accetta più di clientName caratteri (slice in onChange)', () => {
    const config = makeConfig([makeMode({ booking_type: 'tavolo' })])
    renderForm(config)

    const nameInput = screen.getByLabelText(/Nome Completo/i) as HTMLInputElement
    const tooLong = 'a'.repeat(BOOKING_PUBLIC_CLIENT_TEXT_LIMITS.clientName + 20)
    fireEvent.change(nameInput, { target: { value: tooLong } })

    expect(nameInput.value).toHaveLength(BOOKING_PUBLIC_CLIENT_TEXT_LIMITS.clientName)
    // Nessun contatore "N/max" in pagina (regola voluta §3).
    expect(
      screen.queryByText(new RegExp(`/${BOOKING_PUBLIC_CLIENT_TEXT_LIMITS.clientName}`)),
    ).not.toBeInTheDocument()
  })
})

describe('BookingRequestForm — cambio tipologia resetta lo stato (§2-bis + §3-bis capability)', () => {
  it('se Tavolo è disabilitato inizializza il payload sulla prima modalità abilitata', async () => {
    const updates: Array<Record<string, unknown>> = []
    const config = makeConfig([
      makeMode({ id: 'tav', booking_type: 'tavolo', label: 'Tavolo', enabled: false }),
      makeMode({ id: 'menu', booking_type: 'menu_prezzo_fisso', label: 'Menu fisso' }),
    ])
    renderForm(config, (d) => updates.push(d as Record<string, unknown>))

    await waitFor(() => {
      expect(updates[updates.length - 1]?.booking_type).toBe('menu_prezzo_fisso')
    })
    // Con 1 sola modalità abilitata la card è un div non interattivo: niente bordo arancione.
    const card = screen.getByTestId('booking-mode-card-menu')
    expect(card.tagName).toBe('DIV')
    expect(card).not.toHaveClass('border-warm-orange')
  })

  it('passando a una modalità SENZA intolleranze (tavolo) le intolleranze si svuotano', () => {
    const updates: Array<Record<string, unknown>> = []
    const config = makeConfig([
      // rinfresco_laurea USA le intolleranze (Livello C); tavolo NO.
      makeMode({ id: 'rinf', booking_type: 'rinfresco_laurea', label: 'Rinfresco' }),
      makeMode({ id: 'tav', booking_type: 'tavolo', label: 'Tavolo' }),
    ])
    renderForm(config, (d) => updates.push(d as Record<string, unknown>))

    // formData.booking_type parte da 'tavolo' (createInitialFormData): seleziono esplicitamente
    // Rinfresco (USA le intolleranze) e poi scrivo delle intolleranze.
    fireEvent.click(screen.getByRole('button', { name: /Rinfresco/i }))
    const dietary = screen.getByLabelText(/Intolleranze/i) as HTMLTextAreaElement
    fireEvent.change(dietary, { target: { value: 'Glutine, lattosio' } })

    const lastBefore = updates[updates.length - 1]
    expect(lastBefore.booking_type).toBe('rinfresco_laurea')
    expect((lastBefore.dietary_restrictions as unknown[]).length).toBeGreaterThan(0)

    // Cambio tipologia → Tavolo (non usa intolleranze): devono svuotarsi + reset menù/preset/totali.
    fireEvent.click(screen.getByRole('button', { name: /Tavolo/i }))

    const lastAfter = updates[updates.length - 1]
    expect(lastAfter.booking_type).toBe('tavolo')
    expect(lastAfter.dietary_restrictions).toEqual([])
    expect(lastAfter.preset_menu).toBeNull()
    expect((lastAfter.menu_selection as { items: unknown[] }).items).toEqual([])
    expect(lastAfter.menu_total_per_person).toBeUndefined()
    expect(lastAfter.menu_total_booking).toBeUndefined()
  })

  it('passando a una modalità CHE USA le intolleranze le conserva (capability-driven, non per nome)', () => {
    const updates: Array<Record<string, unknown>> = []
    const config = makeConfig([
      makeMode({ id: 'tav', booking_type: 'tavolo', label: 'Tavolo' }),
      makeMode({ id: 'rinf', booking_type: 'rinfresco_laurea', label: 'Rinfresco' }),
    ])
    renderForm(config, (d) => updates.push(d as Record<string, unknown>))

    // Prima attiva = tavolo. Scrivo intolleranze (la sezione è mostrata per ogni tipologia, §3-bis).
    const dietary = screen.getByLabelText(/Intolleranze/i) as HTMLTextAreaElement
    fireEvent.change(dietary, { target: { value: 'Noci' } })

    // Cambio a Rinfresco (USA intolleranze) → si conservano.
    fireEvent.click(screen.getByRole('button', { name: /Rinfresco/i }))

    const lastAfter = updates[updates.length - 1]
    expect(lastAfter.booking_type).toBe('rinfresco_laurea')
    expect((lastAfter.dietary_restrictions as unknown[]).length).toBeGreaterThan(0)
  })
})
