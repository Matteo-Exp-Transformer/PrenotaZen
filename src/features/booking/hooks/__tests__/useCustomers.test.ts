import { describe, expect, it } from 'vitest'
import { customerProfileKey, resolveContactKey } from '@/lib/customerEmail'
import { mergeProfiles } from '../useCustomers'

function bookingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    client_email: 'alice@example.com',
    client_name: 'Alice',
    client_phone: '123',
    desired_date: '2026-06-19',
    updated_at: '2026-06-19T10:00:00Z',
    status: 'accepted',
    num_guests: 2,
    cancelled_at: null,
    marketing_consent: true,
    ...overrides,
  }
}

describe('mergeProfiles', () => {
  it('usa il consenso corrente del cliente e non vecchie prenotazioni consenzienti', () => {
    const profiles = mergeProfiles(
      [bookingRow()],
      [
        {
          id: 'customer-1',
          name: 'Alice',
          email: 'alice@example.com',
          phone: '123',
          notes: null,
          source: 'synced',
          marketing_consent: false,
        },
      ],
    )

    expect(profiles).toHaveLength(1)
    expect(profiles[0].marketing_consent).toBe(false)
  })

  it('crea una riga per ogni identità distinta email+nome', () => {
    const profiles = mergeProfiles(
      [
        bookingRow({
          id: 'b1',
          client_name: 'cava',
          desired_date: '2026-06-10',
          updated_at: '2026-06-10T10:00:00Z',
        }),
        bookingRow({
          id: 'b2',
          client_name: 'Mario Rossi',
          desired_date: '2026-06-15',
          updated_at: '2026-06-15T10:00:00Z',
        }),
        bookingRow({
          id: 'b3',
          client_name: 'cava',
          desired_date: '2026-06-18',
          updated_at: '2026-06-18T10:00:00Z',
        }),
      ],
      [
        {
          id: 'customer-1',
          name: 'Mario Rossi',
          email: 'alice@example.com',
          phone: null,
          notes: null,
          source: 'synced',
          marketing_consent: true,
        },
      ],
    )

    expect(profiles).toHaveLength(2)

    const cava = profiles.find((p) => p.name === 'cava')
    const mario = profiles.find((p) => p.name === 'Mario Rossi')
    expect(cava).toBeDefined()
    expect(mario).toBeDefined()
    expect(cava?.booking_count).toBe(2)
    expect(mario?.booking_count).toBe(1)
    expect(cava?.last_booking_date).toBe('2026-06-18')
    expect(mario?.last_booking_date).toBe('2026-06-15')
    expect(cava?.profileKey).toBe(customerProfileKey('alice@example.com', 'cava'))
    expect(mario?.profileKey).toBe(customerProfileKey('alice@example.com', 'Mario Rossi'))
  })

  it('raggruppa nomi case-insensitive nella stessa riga', () => {
    const profiles = mergeProfiles(
      [
        bookingRow({ id: 'b1', client_name: 'Mario Rossi' }),
        bookingRow({
          id: 'b2',
          client_name: '  mario rossi ',
          desired_date: '2026-06-20',
          updated_at: '2026-06-20T10:00:00Z',
        }),
      ],
      [],
    )

    expect(profiles).toHaveLength(1)
    expect(profiles[0].booking_count).toBe(2)
    expect(profiles[0].last_booking_date).toBe('2026-06-20')
  })

  it('booking solo-telefono (senza email) entra in rubrica con email vuota', () => {
    const profiles = mergeProfiles(
      [bookingRow({ client_email: '', client_phone: '3456789012' })],
      [],
    )

    expect(profiles).toHaveLength(1)
    expect(profiles[0].email).toBe('')
    expect(profiles[0].phone).toBe('3456789012')
    expect(profiles[0].booking_count).toBe(1)
    expect(profiles[0].profileKey).toBe(
      customerProfileKey(resolveContactKey('', '3456789012')!, 'Alice'),
    )
  })

  it('booking senza email né telefono non entra in rubrica', () => {
    const profiles = mergeProfiles(
      [bookingRow({ client_email: '', client_phone: null })],
      [],
    )

    expect(profiles).toHaveLength(0)
  })

  it('due clienti solo-telefono distinti generano due profili separati', () => {
    const profiles = mergeProfiles(
      [
        bookingRow({ id: 'b1', client_email: '', client_phone: '1111111111', client_name: 'Alice' }),
        bookingRow({ id: 'b2', client_email: '', client_phone: '2222222222', client_name: 'Bob' }),
      ],
      [],
    )

    expect(profiles).toHaveLength(2)
    expect(profiles.every((p) => p.email === '')).toBe(true)
  })
})
