import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TimePicker24h } from '../TimePicker24h'

/**
 * Questi test bloccano i bug realmente trovati in sessione:
 * - valore vuoto/parziale mostrava un'opzione invisibile (campo "morto")
 * - i due select potevano essere incoerenti (ora senza minuti o viceversa)
 * - scegliere una parte da vuoto non produceva un "HH:mm" valido
 * - tornare al placeholder doveva azzerare il valore (form required)
 */
describe('TimePicker24h', () => {
  const getSelects = () => {
    const hour = screen.getByLabelText('Ora (formato 24 ore)') as HTMLSelectElement
    const minute = screen.getByLabelText('Minuti') as HTMLSelectElement
    return { hour, minute }
  }

  it('con valore vuoto mostra il placeholder su entrambi i select, non un valore', () => {
    render(<TimePicker24h value="" onChange={() => {}} />)
    const { hour, minute } = getSelects()
    expect(hour.value).toBe('')
    expect(minute.value).toBe('')
    // Placeholder visibile (non stringa vuota invisibile)
    expect(hour.options[0].textContent).toBe('––')
    expect(minute.options[0].textContent).toBe('––')
  })

  it('con un orario valorizzato NON mostra il placeholder (niente voce morta)', () => {
    render(<TimePicker24h value="14:37" onChange={() => {}} />)
    const { hour, minute } = getSelects()
    // Solo le 24 ore / 60 minuti reali, nessuna option vuota
    expect(hour.options).toHaveLength(24)
    expect(minute.options).toHaveLength(60)
    expect(
      Array.from(hour.options).some((o) => o.value === '')
    ).toBe(false)
    expect(
      Array.from(minute.options).some((o) => o.value === '')
    ).toBe(false)
    expect(hour.value).toBe('14')
    expect(minute.value).toBe('37')
  })

  it('scegliere solo l ora da vuoto produce un HH:mm valido (minuti 00)', () => {
    const onChange = vi.fn()
    render(<TimePicker24h value="" onChange={onChange} />)
    fireEvent.change(getSelects().hour, { target: { value: '09' } })
    expect(onChange).toHaveBeenCalledWith('09:00')
  })

  it('scegliere solo i minuti da vuoto produce un HH:mm valido (ora 00)', () => {
    const onChange = vi.fn()
    render(<TimePicker24h value="" onChange={onChange} />)
    fireEvent.change(getSelects().minute, { target: { value: '45' } })
    expect(onChange).toHaveBeenCalledWith('00:45')
  })

  it('cambiare l ora preserva i minuti gia scelti', () => {
    const onChange = vi.fn()
    render(<TimePicker24h value="10:30" onChange={onChange} />)
    fireEvent.change(getSelects().hour, { target: { value: '21' } })
    expect(onChange).toHaveBeenCalledWith('21:30')
  })

  it('tornare al placeholder azzera il valore (per i form required)', () => {
    const onChange = vi.fn()
    render(<TimePicker24h value="12:15" onChange={onChange} />)
    fireEvent.change(getSelects().hour, { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('un valore parziale/sporco viene trattato come vuoto, non come stato ibrido', () => {
    render(<TimePicker24h value="abc" onChange={() => {}} />)
    const { hour, minute } = getSelects()
    expect(hour.value).toBe('')
    expect(minute.value).toBe('')
  })

  it('disabled disattiva entrambi i select', () => {
    render(<TimePicker24h value="08:00" onChange={() => {}} disabled />)
    const { hour, minute } = getSelects()
    expect(hour.disabled).toBe(true)
    expect(minute.disabled).toBe(true)
  })
})
