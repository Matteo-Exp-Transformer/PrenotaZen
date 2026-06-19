import { describe, expect, it } from 'vitest'
import { mergeProfiles } from '../useCustomers'

describe('mergeProfiles', () => {
  it('usa il consenso corrente del cliente e non vecchie prenotazioni consenzienti', () => {
    const profiles = mergeProfiles(
      [
        {
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
        },
      ],
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
})
