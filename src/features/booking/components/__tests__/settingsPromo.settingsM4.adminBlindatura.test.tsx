// @admin-blindatura: settings-promo
// Copre: FIX 6 (16-06-26) — apply/delete/toggle aggiornano SOLO lo stato locale + dirty, nessuna
// persistenza autonoma (FU-002 ribaltato); save() via ref persiste e azzera dirty; fail di save()
// rilancia (lo gestisce il chiamante/footer) lasciando promo in UI locale; label tipologie da config

import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRef } from 'react'
import {
  DEFAULT_BOOKING_FORM_CONFIG,
  type BookingMode,
} from '@/features/booking/constants/bookingPublicFormConfig'
import type { MenuPromo } from '@/features/booking/constants/menuPromo'
import { toast } from 'react-toastify'
import {
  BookingFormPromoSection,
  type BookingFormPromoSectionHandle,
} from '../settings/BookingFormPromoSection'

const mutateAsyncSpy = vi.fn()

const savedPromo: MenuPromo = {
  id: 'promo-1111-1111-1111-111111111111',
  label: 'Promo weekend',
  message: 'Sconto del 10% il sabato',
  placement: 'booking_type',
  booking_types: ['tavolo'],
  visible_on_booking: true,
}

/** Riferimento stabile: `[savedPromo]` inline nel mock ricrea l'array a ogni render → loop useEffect sync. */
const savedPromosData: MenuPromo[] = [savedPromo]

function resetSavedPromos(promos: MenuPromo[] = [savedPromo]) {
  savedPromosData.length = 0
  savedPromosData.push(...promos)
}

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), warn: vi.fn(), success: vi.fn() },
}))

vi.mock('@/features/booking/hooks/useRestaurantSetting', () => ({
  useRestaurantSetting: (key: string) => ({
    data: key === 'booking_menu_promos' ? savedPromosData : null,
    isSuccess: true,
    isPending: false,
    error: null,
  }),
  useUpsertRestaurantSetting: () => ({
    mutateAsync: mutateAsyncSpy,
    isPending: false,
  }),
}))

function makeCustomBookingModes(): BookingMode[] {
  return DEFAULT_BOOKING_FORM_CONFIG.booking_modes.map((mode) =>
    mode.booking_type === 'tavolo'
      ? { ...mode, enabled: true, label: 'Tavolo Estivo' }
      : mode.booking_type === 'menu_prezzo_fisso'
        ? { ...mode, enabled: true, label: 'Menu Degustazione' }
        : { ...mode, enabled: false, label: 'Evento Laurea Custom' },
  )
}

function renderPromoSection(options?: {
  bookingModes?: BookingMode[]
  onDirtyChange?: (dirty: boolean) => void
  ref?: React.RefObject<BookingFormPromoSectionHandle>
}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <BookingFormPromoSection
        ref={options?.ref}
        bookingModes={options?.bookingModes ?? DEFAULT_BOOKING_FORM_CONFIG.booking_modes}
        onDirtyChange={options?.onDirtyChange}
      />
    </QueryClientProvider>,
  )
}

function createPromoRef(): React.RefObject<BookingFormPromoSectionHandle> {
  return createRef<BookingFormPromoSectionHandle>() as React.RefObject<BookingFormPromoSectionHandle>
}

describe('settings-promo delete copy', () => {
  beforeEach(() => {
    resetSavedPromos()
    mutateAsyncSpy.mockReset()
    mutateAsyncSpy.mockResolvedValue(undefined)
  })

  it('la modale delete parla di footer, non di salvataggio autonomo, e l’elimina è solo locale', async () => {
    const onDirtyChange = vi.fn()
    const user = userEvent.setup()
    renderPromoSection({ onDirtyChange })

    await waitFor(() => {
      expect(screen.getByText('Promo weekend')).toBeInTheDocument()
    })

    const row = screen.getByText('Promo weekend').closest('.menu-prices-item-row')
    expect(row).toBeTruthy()
    await user.click(within(row as HTMLElement).getByRole('button', { name: /elimina promo/i }))

    const dialog = await screen.findByRole('dialog', { name: /eliminare la promo/i })
    const body = within(dialog).getByText(/sei sicuro di voler eliminare/i).textContent ?? ''
    expect(body).toMatch(/salva modifiche.*footer/i)
    expect(body).not.toMatch(/salvata subito/i)

    await user.click(within(dialog).getByRole('button', { name: /elimina promo/i }))

    expect(screen.queryByText('Promo weekend')).not.toBeInTheDocument()
    expect(onDirtyChange).toHaveBeenCalledWith(true)
    expect(mutateAsyncSpy).not.toHaveBeenCalled()
  })
})

describe('settings-promo label dinamiche da config', () => {
  const promoWithCustomType: MenuPromo = {
    id: 'promo-custom-type',
    label: 'Promo estiva',
    message: 'Offerta luglio',
    placement: 'booking_type',
    booking_types: ['tavolo'],
    visible_on_booking: true,
  }

  beforeEach(() => {
    mutateAsyncSpy.mockReset()
    mutateAsyncSpy.mockResolvedValue(undefined)
    resetSavedPromos([promoWithCustomType])
  })

  it('riepilogo promo usa la label configurata in Personalizza form, non nomi demo hardcoded', async () => {
    renderPromoSection({ bookingModes: makeCustomBookingModes() })

    await waitFor(() => {
      expect(screen.getByText('Promo estiva')).toBeInTheDocument()
    })
    expect(screen.getByText('Tavolo Estivo')).toBeInTheDocument()
    expect(screen.queryByText(/^Tavolo$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/rinfresco di laurea|compila nome tipologia/i)).not.toBeInTheDocument()
  })

  it('editor promo mostra checkbox tipologia con label da config', async () => {
    const user = userEvent.setup()
    renderPromoSection({ bookingModes: makeCustomBookingModes() })

    await user.click(await screen.findByRole('button', { name: /nuova promo/i }))
    expect(screen.getByLabelText('Tavolo Estivo')).toBeInTheDocument()
    expect(screen.getByLabelText('Menu Degustazione')).toBeInTheDocument()
    expect(screen.queryByLabelText('Evento Laurea Custom')).not.toBeInTheDocument()
  })
})

describe('settings-promo: apply/toggle/delete sono locali, niente persistenza autonoma', () => {
  beforeEach(() => {
    resetSavedPromos()
    mutateAsyncSpy.mockReset()
    mutateAsyncSpy.mockResolvedValue(undefined)
  })

  it('toggle visibilità: aggiorna solo lo stato locale e alza dirty, nessuna mutation', async () => {
    const onDirtyChange = vi.fn()
    const user = userEvent.setup()
    renderPromoSection({ onDirtyChange })

    await waitFor(() => {
      expect(screen.getByText('Promo weekend')).toBeInTheDocument()
    })

    const row = screen.getByText('Promo weekend').closest('.menu-prices-item-row')
    await user.click(within(row as HTMLElement).getByRole('button', { name: /nascondi nella pagina prenota/i }))

    expect(screen.getByRole('button', { name: /mostra nella pagina prenota/i })).toBeInTheDocument()
    expect(onDirtyChange).toHaveBeenCalledWith(true)
    expect(mutateAsyncSpy).not.toHaveBeenCalled()
  })

  it('Applica nuova promo: entra nella lista locale e alza dirty, nessuna mutation', async () => {
    resetSavedPromos([])
    const onDirtyChange = vi.fn()
    const user = userEvent.setup()
    renderPromoSection({ bookingModes: makeCustomBookingModes(), onDirtyChange })

    await user.click(await screen.findByRole('button', { name: /nuova promo/i }))
    await user.type(screen.getByLabelText(/nome promo \(admin\)/i), 'Promo nuova')
    await user.type(screen.getByLabelText(/testo promo \(prenota\)/i), 'Messaggio promo')
    await user.click(screen.getByLabelText('Tavolo Estivo'))
    await user.click(screen.getByRole('button', { name: /aggiungi alla lista/i }))

    expect(screen.getByText('Promo nuova')).toBeInTheDocument()
    expect(onDirtyChange).toHaveBeenCalledWith(true)
    expect(mutateAsyncSpy).not.toHaveBeenCalled()
  })
})

describe('settings-promo: save() via ref persiste tutta la lista (chiamato dal footer)', () => {
  beforeEach(() => {
    resetSavedPromos()
    mutateAsyncSpy.mockReset()
    mutateAsyncSpy.mockResolvedValue(undefined)
  })

  it('apply locale + ref.save() persiste la lista intera e azzera dirty', async () => {
    resetSavedPromos([])
    const onDirtyChange = vi.fn()
    const ref = createPromoRef()
    const user = userEvent.setup()
    renderPromoSection({ bookingModes: makeCustomBookingModes(), onDirtyChange, ref })

    await user.click(await screen.findByRole('button', { name: /nuova promo/i }))
    await user.type(screen.getByLabelText(/nome promo \(admin\)/i), 'Promo nuova')
    await user.type(screen.getByLabelText(/testo promo \(prenota\)/i), 'Messaggio promo')
    await user.click(screen.getByLabelText('Tavolo Estivo'))
    await user.click(screen.getByRole('button', { name: /aggiungi alla lista/i }))

    expect(mutateAsyncSpy).not.toHaveBeenCalled()

    await act(async () => {
      await ref.current!.save()
    })

    expect(mutateAsyncSpy).toHaveBeenCalledWith([
      expect.objectContaining({ key: 'booking_menu_promos' }),
    ])
    expect(ref.current!.isDirty()).toBe(false)
    expect(toast.success).toHaveBeenCalled()
  })

  it('ref.save() fallito rilancia l’errore e lascia la promo in UI locale (footer gestisce il toast/dirty)', async () => {
    mutateAsyncSpy.mockRejectedValueOnce(new Error('network'))
    const ref = createPromoRef()
    const user = userEvent.setup()
    renderPromoSection({ ref })

    await waitFor(() => {
      expect(screen.getByText('Promo weekend')).toBeInTheDocument()
    })

    const row = screen.getByText('Promo weekend').closest('.menu-prices-item-row')
    await user.click(within(row as HTMLElement).getByRole('button', { name: /nascondi nella pagina prenota/i }))

    await act(async () => {
      await expect(ref.current!.save()).rejects.toThrow('network')
    })
    expect(screen.getByText('Promo weekend')).toBeInTheDocument()
  })

  it('ref.cancel() ripristina i promo salvati e azzera dirty', async () => {
    const onDirtyChange = vi.fn()
    const ref = createPromoRef()
    const user = userEvent.setup()
    renderPromoSection({ onDirtyChange, ref })

    await waitFor(() => {
      expect(screen.getByText('Promo weekend')).toBeInTheDocument()
    })

    const row = screen.getByText('Promo weekend').closest('.menu-prices-item-row')
    await user.click(within(row as HTMLElement).getByRole('button', { name: /elimina promo/i }))
    const dialog = await screen.findByRole('dialog', { name: /eliminare la promo/i })
    await user.click(within(dialog).getByRole('button', { name: /elimina promo/i }))

    expect(screen.queryByText('Promo weekend')).not.toBeInTheDocument()

    act(() => {
      ref.current!.cancel()
    })

    expect(screen.getByText('Promo weekend')).toBeInTheDocument()
    expect(ref.current!.isDirty()).toBe(false)
  })
})
