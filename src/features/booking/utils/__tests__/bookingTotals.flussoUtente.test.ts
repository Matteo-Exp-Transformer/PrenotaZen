// @prenota-blindatura: flusso-utente
// Copre: calcolo totali del menù lato cliente (PRENOTA_SKILL §2-bis riga "prezzo = somma piatti
// OPPURE prezzo×ospiti se menù fisso"; §3-bis "preset per capacità"). Blinda tutti i rami della
// funzione pura usata da BookingRequestForm e BookingSummarySidebar: menù componibile (somma
// piatti), menù fisso (prezzo×ospiti), ospiti = 0, ospiti negativi, prezzo preset = 0.

import { describe, expect, it } from 'vitest'
import type { SelectedMenuItem } from '@/types/menu'
import {
  computeMenuTotalsFromItems,
  computeMenuTotalsWithPresetPrice,
} from '../buildPresetMenuSelection'

const items: SelectedMenuItem[] = [
  { id: 'a', name: 'Antipasto', price: 4, category: 'antipasti' },
  { id: 'b', name: 'Primo', price: 6, category: 'primi' },
  { id: 'c', name: 'Dolce', price: 3, category: 'dolci' },
]

describe('computeMenuTotalsFromItems — menù componibile (somma piatti × ospiti)', () => {
  it('somma i prezzi dei piatti per persona e moltiplica per gli ospiti', () => {
    // 4+6+3 = 13 a persona, × 2 ospiti = 26
    expect(computeMenuTotalsFromItems(items, 2)).toEqual({
      totalPerPerson: 13,
      menu_total_booking: 26,
    })
  })

  it('ospiti = 0 → totale prenotazione 0 (a persona resta valorizzato)', () => {
    expect(computeMenuTotalsFromItems(items, 0)).toEqual({
      totalPerPerson: 13,
      menu_total_booking: 0,
    })
  })

  it('ospiti negativi → clamp a 0, mai totale negativo', () => {
    expect(computeMenuTotalsFromItems(items, -5)).toEqual({
      totalPerPerson: 13,
      menu_total_booking: 0,
    })
  })

  it('nessun piatto selezionato → tutto a 0', () => {
    expect(computeMenuTotalsFromItems([], 4)).toEqual({
      totalPerPerson: 0,
      menu_total_booking: 0,
    })
  })
})

describe('computeMenuTotalsWithPresetPrice — menù fisso (prezzo × ospiti)', () => {
  it('usa il prezzo fisso a persona, NON la somma dei piatti', () => {
    // i piatti sommerebbero 13, ma il prezzo fisso 20 vince
    expect(computeMenuTotalsWithPresetPrice(items, 3, 20)).toEqual({
      totalPerPerson: 20,
      menu_total_booking: 60,
    })
  })

  it('menù fisso con ospiti = 0 → totale prenotazione 0, a persona resta il prezzo fisso', () => {
    expect(computeMenuTotalsWithPresetPrice(items, 0, 20)).toEqual({
      totalPerPerson: 20,
      menu_total_booking: 0,
    })
  })

  it('menù fisso con ospiti negativi → clamp a 0', () => {
    expect(computeMenuTotalsWithPresetPrice(items, -2, 20)).toEqual({
      totalPerPerson: 20,
      menu_total_booking: 0,
    })
  })

  it('prezzo preset null → ricade sulla somma dei piatti (componibile)', () => {
    expect(computeMenuTotalsWithPresetPrice(items, 2, null)).toEqual({
      totalPerPerson: 13,
      menu_total_booking: 26,
    })
  })

  it('prezzo preset undefined → ricade sulla somma dei piatti', () => {
    expect(computeMenuTotalsWithPresetPrice(items, 2, undefined)).toEqual({
      totalPerPerson: 13,
      menu_total_booking: 26,
    })
  })

  it('prezzo preset = 0 → NON è un prezzo fisso valido, ricade sulla somma piatti', () => {
    // guard: presetPricePerPerson > 0. Un preset "senza prezzo" (0) non azzera il totale,
    // usa la somma dei piatti — evita un riepilogo a 0€ ingannevole per il cliente.
    expect(computeMenuTotalsWithPresetPrice(items, 2, 0)).toEqual({
      totalPerPerson: 13,
      menu_total_booking: 26,
    })
  })

  it('prezzo preset negativo → ignorato, somma piatti', () => {
    expect(computeMenuTotalsWithPresetPrice(items, 2, -10)).toEqual({
      totalPerPerson: 13,
      menu_total_booking: 26,
    })
  })
})
