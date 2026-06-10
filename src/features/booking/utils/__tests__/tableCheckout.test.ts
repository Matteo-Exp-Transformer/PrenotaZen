import { describe, it, expect } from 'vitest'
import { hasWaitingNextTurnOnTable } from '../tableCheckout'
function makeAssignment(
  overrides: {
    id?: string
    booking_id?: string
    table_id?: string
    service_slot_id?: string
    turn_number?: number
    checked_out_at?: string | null
    date?: string
  },
) {
  return {
    id: 'a1',
    tenant_id: 't1',
    booking_id: 'b1',
    table_id: 'table-1',
    service_slot_id: 'slot-1',
    turn_number: 1,
    checked_out_at: null,
    date: '2026-05-18',
    created_at: '',
    ...overrides,
  }
}

describe('hasWaitingNextTurnOnTable', () => {
  it('false quando non c\'è turno successivo attivo', () => {
    const current = makeAssignment({ turn_number: 1 })
    expect(hasWaitingNextTurnOnTable([current], current)).toBe(false)
  })

  it('true quando esiste turno 2 attivo sullo stesso tavolo', () => {
    const t1 = makeAssignment({ id: 'a1', turn_number: 1, booking_id: 'b1' })
    const t2 = makeAssignment({ id: 'a2', turn_number: 2, booking_id: 'b2' })
    expect(hasWaitingNextTurnOnTable([t1, t2], t1)).toBe(true)
  })

  it('false quando turno 2 è già chiuso', () => {
    const t1 = makeAssignment({ turn_number: 1 })
    const t2 = makeAssignment({
      turn_number: 2,
      checked_out_at: '2026-05-18T14:00:00Z',
    })
    expect(hasWaitingNextTurnOnTable([t1, t2], t1)).toBe(false)
  })
})
