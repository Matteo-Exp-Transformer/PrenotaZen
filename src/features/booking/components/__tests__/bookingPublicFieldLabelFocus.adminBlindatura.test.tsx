// @prenota-blindatura: flusso-utente
// Label interne alle caselle cliente portano focus al controllo (nome, email, telefono, data, ora, ospiti).

import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BookingPublicInsetField } from '../publicBooking/BookingPublicInsetField'
import {
  BookingPublicDatePickerField,
  BookingPublicTimePickerField,
} from '../publicBooking/BookingPublicDateTimePickers'

describe('BookingPublicInsetField — label cliccabile', () => {
  it('click sulla label porta focus all\'input', async () => {
    const user = userEvent.setup()
    render(
      <BookingPublicInsetField
        id="client_name"
        label="Nome Completo *"
        value=""
        onChange={() => {}}
      />,
    )
    const label = screen.getByText('Nome Completo *')
    await user.click(label)
    expect(document.activeElement).toHaveAttribute('id', 'client_name-control')
  })
})

describe('BookingPublicDateTimePickers — label cliccabile', () => {
  it('click sulla label Data porta focus al trigger', async () => {
    const user = userEvent.setup()
    render(
      <BookingPublicDatePickerField
        id="desired_date"
        label="Data *"
        value=""
        onChange={() => {}}
      />,
    )
    await user.click(screen.getByText('Data *'))
    expect(document.activeElement).toHaveAttribute('id', 'desired_date-control')
  })

  it('click sulla label Ora porta focus al trigger', async () => {
    const user = userEvent.setup()
    render(
      <BookingPublicTimePickerField
        id="desired_time"
        label="Ora *"
        value=""
        onChange={() => {}}
      />,
    )
    await user.click(screen.getByText('Ora *'))
    expect(document.activeElement).toHaveAttribute('id', 'desired_time-control')
  })
})
