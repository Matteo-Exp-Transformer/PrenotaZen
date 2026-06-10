import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminFieldWithCharCount } from '../settings/AdminFieldWithCharCount'
import {
  QR_CATEGORY_TITLE_MAX,
  QR_CATEGORY_DESCRIPTION_MAX,
} from '../MenuHomepageConfigPanel'

/**
 * FU-MQR-1: i campi "Titolo card" e "Descrizione breve" della categoria per-QR
 * devono essere cappati (taglio difensivo anti-rottura mobile), come il carosello.
 * Blinda i valori decisi (30 / 70) e che l'input dell'utente venga troncato a quel
 * limite sul valore controllato propagato a onChange — non solo via attributo maxLength.
 */

// Wrapper controllato: rispecchia l'uso reale (value+onChange su stato) così che il
// taglio difensivo del componente (slice su ogni change) si veda nello stato finale.
function ControlledField({ label, maxLength }: { label: string; maxLength: number }) {
  const [value, setValue] = useState('')
  return (
    <AdminFieldWithCharCount
      id="f"
      label={label}
      value={value}
      maxLength={maxLength}
      onChange={setValue}
      singleLine
    />
  )
}

describe('FU-MQR-1 — cap campi card categoria QR', () => {
  it('i cap valgono 30 (titolo) e 70 (descrizione)', () => {
    expect(QR_CATEGORY_TITLE_MAX).toBe(30)
    expect(QR_CATEGORY_DESCRIPTION_MAX).toBe(70)
  })

  it('titolo card: tronca l\'input a 30 caratteri', async () => {
    const user = userEvent.setup()
    render(<ControlledField label="Titolo card" maxLength={QR_CATEGORY_TITLE_MAX} />)
    const field = screen.getByLabelText('Titolo card') as HTMLInputElement
    await user.type(field, 'x'.repeat(50))
    expect(field.value.length).toBe(QR_CATEGORY_TITLE_MAX)
  })

  it('descrizione card: tronca l\'input a 70 caratteri', async () => {
    const user = userEvent.setup()
    render(<ControlledField label="Descrizione breve" maxLength={QR_CATEGORY_DESCRIPTION_MAX} />)
    const field = screen.getByLabelText('Descrizione breve') as HTMLInputElement
    await user.type(field, 'y'.repeat(120))
    expect(field.value.length).toBe(QR_CATEGORY_DESCRIPTION_MAX)
  })
})
