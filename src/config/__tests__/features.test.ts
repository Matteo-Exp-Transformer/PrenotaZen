import { describe, it, expect } from 'vitest'
import { buildFeatures } from '@/config/features'

describe('buildFeatures', () => {
  describe("edition='classic'", () => {
    const f = buildFeatures('classic')

    it('sidebar è false', () => expect(f.sidebar).toBe(false))
    it('home è false', () => expect(f.home).toBe(false))
    it('crm è false', () => expect(f.crm).toBe(false))
    it('analytics è false', () => expect(f.analytics).toBe(false))
    it('servizio è false', () => expect(f.servizio).toBe(false))
    it('walkIn è false', () => expect(f.walkIn).toBe(false))
    it('noShow è false', () => expect(f.noShow).toBe(false))
    it('tableAssignments è false', () => expect(f.tableAssignments).toBe(false))
  })

  describe("edition='pro'", () => {
    const f = buildFeatures('pro')

    it('sidebar è true', () => expect(f.sidebar).toBe(true))
    it('home è true', () => expect(f.home).toBe(true))
    it('crm è true', () => expect(f.crm).toBe(true))
    it('analytics è true', () => expect(f.analytics).toBe(true))
    it('servizio è true', () => expect(f.servizio).toBe(true))
    it('walkIn è true', () => expect(f.walkIn).toBe(true))
    it('noShow è true', () => expect(f.noShow).toBe(true))
    it('tableAssignments è true', () => expect(f.tableAssignments).toBe(true))
  })

  describe("edition='enterprise'", () => {
    const f = buildFeatures('enterprise')

    it('sidebar è true', () => expect(f.sidebar).toBe(true))
    it('crm è true', () => expect(f.crm).toBe(true))
    it('noShow è true', () => expect(f.noShow).toBe(true))
    it('tableAssignments è true', () => expect(f.tableAssignments).toBe(true))
  })

  it('classic ha tutti i flag a false (nessuna eccezione)', () => {
    const f = buildFeatures('classic')
    const allFalse = Object.values(f).every((v) => v === false)
    expect(allFalse).toBe(true)
  })

  it('pro ha tutti i flag a true', () => {
    const f = buildFeatures('pro')
    const allTrue = Object.values(f).every((v) => v === true)
    expect(allTrue).toBe(true)
  })

  it('qrMenu puo essere aggiunto a Classic o rimosso da Pro via override', () => {
    // @admin-blindatura: shell-edition
    // Copre: Menu QR e una feature vendibile, non un vincolo fisso della sidebar.
    expect(buildFeatures('classic', ['qrMenu']).qrMenu).toBe(true)
    expect(buildFeatures('pro', ['-qrMenu']).qrMenu).toBe(false)
  })
})
