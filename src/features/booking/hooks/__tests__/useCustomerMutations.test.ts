import { describe, expect, it } from 'vitest'
import {
  filterBookingIdsByIdentity,
  matchesCustomerIdentity,
} from '../useCustomerMutations'

describe('matchesCustomerIdentity', () => {
  it('confronta email e nome normalizzati', () => {
    expect(matchesCustomerIdentity('Alice@Example.com', ' Mario Rossi ', 'alice@example.com', 'mario rossi')).toBe(
      true,
    )
    expect(matchesCustomerIdentity('alice@example.com', 'cava', 'alice@example.com', 'mario rossi')).toBe(false)
  })
})

describe('filterBookingIdsByIdentity', () => {
  it('restituisce solo prenotazioni della coppia email+nome', () => {
    const rows = [
      { id: '1', client_email: 'a@b.com', client_name: 'cava' },
      { id: '2', client_email: 'a@b.com', client_name: 'Mario Rossi' },
      { id: '3', client_email: 'a@b.com', client_name: 'cava' },
    ]
    expect(filterBookingIdsByIdentity(rows, 'a@b.com', 'cava')).toEqual(['1', '3'])
  })
})
