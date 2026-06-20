import { describe, it, expect, vi, beforeEach } from 'vitest'
import { customerProfileKey } from '@/lib/customerEmail'
import type { CustomerProfile } from '@/types/customer'

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}))

import {
  isEligiblePromoRecipient,
  filterEmailsWithMarketingConsent,
  filterRecipientsToEligible,
  countEligibleRecipients,
  dedupeProfilesByEmail,
} from '../promoRecipientEligibility'

function profile(overrides: Partial<CustomerProfile> = {}): CustomerProfile {
  const email = overrides.email ?? 'a@example.com'
  const name = overrides.name ?? 'Alice'
  return {
    profileKey: customerProfileKey(email, name),
    email,
    name,
    source: 'booking',
    booking_count: 1,
    total_guests: 2,
    bookings: [],
    accepted_count: 1,
    pending_count: 0,
    cancelled_count: 0,
    marketing_consent: true,
    ...overrides,
  }
}

describe('promoRecipientEligibility', () => {
  describe('isEligiblePromoRecipient', () => {
    it('richiede source booking, email valida e consenso marketing', () => {
      expect(isEligiblePromoRecipient(profile())).toBe(true)
      expect(isEligiblePromoRecipient(profile({ marketing_consent: false }))).toBe(false)
      expect(isEligiblePromoRecipient(profile({ source: 'manual' }))).toBe(false)
      expect(isEligiblePromoRecipient(profile({ email: '' }))).toBe(false)
    })

    it('profilo solo-telefono (email vuota) è escluso dal picker campagne', () => {
      // I profili solo-telefono compaiono in rubrica ma non nel picker promo (le campagne email richiedono un'email)
      expect(
        isEligiblePromoRecipient(
          profile({ email: '', phone: '3456789012', marketing_consent: true }),
        ),
      ).toBe(false)
    })
  })

  describe('dedupeProfilesByEmail', () => {
    it('mantiene una sola riga per email (ultima prenotazione più recente)', () => {
      const result = dedupeProfilesByEmail([
        profile({ email: 'x@y.com', name: 'cava', last_booking_date: '2026-06-10' }),
        profile({ email: 'x@y.com', name: 'Mario Rossi', last_booking_date: '2026-06-20' }),
      ])
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Mario Rossi')
    })
  })

  describe('filterRecipientsToEligible', () => {
    it('tiene solo email presenti nel set eleggibili', () => {
      const eligible = new Set(['alice@example.com', 'bob@example.com'])
      expect(
        filterRecipientsToEligible(
          ['alice@example.com', 'revoked@example.com', 'bob@example.com'],
          eligible,
        ),
      ).toEqual(['alice@example.com', 'bob@example.com'])
    })

    it('countEligibleRecipients conta la intersezione', () => {
      const eligible = new Set(['alice@example.com'])
      expect(
        countEligibleRecipients(['alice@example.com', 'ghost@example.com'], eligible),
      ).toBe(1)
      expect(countEligibleRecipients(new Set(['alice@example.com', 'ghost@example.com']), eligible)).toBe(
        1,
      )
    })
  })

  describe('filterEmailsWithMarketingConsent', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('restituisce solo email con marketing_consent true su customers', async () => {
      const chain: Record<string, unknown> = {}
      chain['select'] = vi.fn(() => chain)
      chain['eq'] = vi.fn(() => chain)
      chain['in'] = vi.fn().mockResolvedValue({
        data: [{ email: 'alice@example.com' }],
        error: null,
      })
      mockFrom.mockReturnValue(chain)

      const result = await filterEmailsWithMarketingConsent('tenant-1', [
        'alice@example.com',
        'bob@example.com',
      ])

      expect(result.allowed).toEqual(['alice@example.com'])
      expect(result.skipped).toBe(1)
      expect(chain['eq']).toHaveBeenCalledWith('marketing_consent', true)
    })

    it('restituisce lista vuota se nessun consenso', async () => {
      const chain: Record<string, unknown> = {}
      chain['select'] = vi.fn(() => chain)
      chain['eq'] = vi.fn(() => chain)
      chain['in'] = vi.fn().mockResolvedValue({ data: [], error: null })
      mockFrom.mockReturnValue(chain)

      const result = await filterEmailsWithMarketingConsent('tenant-1', ['bob@example.com'])

      expect(result.allowed).toEqual([])
      expect(result.skipped).toBe(1)
    })
  })
})
