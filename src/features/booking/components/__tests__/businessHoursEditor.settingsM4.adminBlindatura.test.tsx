// @admin-blindatura: settings-business-hours-editor
// Copre: FIX 2 (16-06-26) — al primo "Aggiungi apertura"/apertura giorno chiuso compaiono insieme
// 06:30–16:30 e 17:30–23:30; giorno con aperture esistenti NON viene sovrascritto (solo append);
// Annulla (toggle "Chiuso") ripristina lo snapshot precedente; overlap resta bloccato.

import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BusinessHoursEditor } from '../BusinessHoursEditor'
import { getDefaultBusinessHours, type BusinessHours } from '@/lib/businessHours'

function Harness({ initial }: { initial: BusinessHours }) {
  const [value, setValue] = useState<BusinessHours>(initial)
  return <BusinessHoursEditor value={value} onChange={setValue} />
}

function mondayCard(): HTMLElement {
  return screen.getByText('Lunedì').closest('div.rounded-xl') as HTMLElement
}

/** Legge "HH:mm" dalla coppia di <select> ora/minuti generata da TimePicker24h per un dato id. */
function readTime(card: HTMLElement, id: string): string {
  const hourSelect = card.querySelector<HTMLSelectElement>(`#${id}`)
  const minuteSelect = card.querySelector<HTMLSelectElement>(`#${id}-minute`)
  return `${hourSelect?.value ?? '??'}:${minuteSelect?.value ?? '??'}`
}

function hasSlotRow(card: HTMLElement, id: string): boolean {
  return card.querySelector(`#${id}`) != null
}

describe('settings-business-hours-editor M4 — FIX 2 default orari', () => {
  it('giorno chiuso → click "Chiuso" per aprirlo popola insieme pranzo 06:30–16:30 e cena 17:30–23:30', async () => {
    const user = userEvent.setup()
    render(<Harness initial={getDefaultBusinessHours()} />)

    const card = mondayCard()
    const closedCheckbox = within(card).getByRole('checkbox', { name: /chiuso/i })
    expect(closedCheckbox).toBeChecked()

    await user.click(closedCheckbox)

    expect(readTime(card, 'monday-open-0')).toBe('06:30')
    expect(readTime(card, 'monday-close-0')).toBe('16:30')
    expect(readTime(card, 'monday-open-1')).toBe('17:30')
    expect(readTime(card, 'monday-close-1')).toBe('23:30')
    // Nessun overlap, nessun banner errore.
    expect(within(card).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('rompi: giorno con apertura già esistente → "Aggiungi apertura" NON sovrascrive, aggiunge solo una fascia', async () => {
    const user = userEvent.setup()
    const initial = getDefaultBusinessHours()
    initial.monday = [{ open: '09:00', close: '13:00' }]
    render(<Harness initial={initial} />)

    const card = mondayCard()
    await user.click(within(card).getByRole('button', { name: /aggiungi apertura/i }))

    // La fascia originale resta intatta...
    expect(readTime(card, 'monday-open-0')).toBe('09:00')
    expect(readTime(card, 'monday-close-0')).toBe('13:00')
    // ...e viene solo aggiunta una seconda fascia (non i due default pranzo+cena).
    expect(readTime(card, 'monday-open-1')).toBe('11:00')
    expect(readTime(card, 'monday-close-1')).toBe('00:00')
    expect(hasSlotRow(card, 'monday-open-2')).toBe(false)
  })

  it('rompi: Annulla (rispunta "Chiuso") poi riapre → ripristina lo snapshot precedente, non i default pranzo+cena', async () => {
    const user = userEvent.setup()
    const initial = getDefaultBusinessHours()
    initial.monday = [{ open: '09:00', close: '13:00' }]
    render(<Harness initial={initial} />)

    const card = mondayCard()
    const closedCheckbox = within(card).getByRole('checkbox', { name: /chiuso/i })

    // Chiude il giorno (snapshot della fascia 09:00-13:00 preso prima di nascondere).
    await user.click(closedCheckbox)
    expect(closedCheckbox).toBeChecked()

    // Annulla: riapre il giorno → deve tornare 09:00-13:00, non i nuovi default pranzo+cena.
    await user.click(closedCheckbox)
    expect(readTime(card, 'monday-open-0')).toBe('09:00')
    expect(readTime(card, 'monday-close-0')).toBe('13:00')
    expect(hasSlotRow(card, 'monday-open-1')).toBe(false)
  })

  it('rompi: sovrappongo manualmente pranzo/cena → banner overlap appare (validazione non rotta dal nuovo default)', async () => {
    const user = userEvent.setup()
    render(<Harness initial={getDefaultBusinessHours()} />)

    const card = mondayCard()
    await user.click(within(card).getByRole('checkbox', { name: /chiuso/i }))
    // Default pranzo+cena non si sovrappongono.
    expect(within(card).queryByRole('alert')).not.toBeInTheDocument()

    // Sovrappongo manualmente la chiusura pranzo (16:30→18:00) con l'apertura cena (17:30).
    const lunchCloseHour = card.querySelector<HTMLSelectElement>('#monday-close-0')!
    await user.selectOptions(lunchCloseHour, '18')

    expect(within(card).getByRole('alert')).toHaveTextContent(/si sovrappongono/i)
  })
})
