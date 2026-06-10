import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFeatures } from '@/hooks/useFeatures'

vi.mock('@/contexts/TenantContext', () => ({
  useTenantContext: vi.fn(),
}))

import { useTenantContext } from '@/contexts/TenantContext'

const mockUseTenantContext = vi.mocked(useTenantContext)

describe('useFeatures', () => {
  it("edition='classic' → sidebar false, crm false, noShow false", () => {
    mockUseTenantContext.mockReturnValue({ edition: 'classic' } as ReturnType<typeof useTenantContext>)
    const { result } = renderHook(() => useFeatures())
    expect(result.current.sidebar).toBe(false)
    expect(result.current.crm).toBe(false)
    expect(result.current.noShow).toBe(false)
    expect(result.current.walkIn).toBe(false)
  })

  it("edition='pro' → sidebar true, crm true, noShow true", () => {
    mockUseTenantContext.mockReturnValue({ edition: 'pro' } as ReturnType<typeof useTenantContext>)
    const { result } = renderHook(() => useFeatures())
    expect(result.current.sidebar).toBe(true)
    expect(result.current.crm).toBe(true)
    expect(result.current.noShow).toBe(true)
    expect(result.current.walkIn).toBe(true)
  })

  it("edition='enterprise' → stessi flag di pro", () => {
    mockUseTenantContext.mockReturnValue({ edition: 'enterprise' } as ReturnType<typeof useTenantContext>)
    const { result } = renderHook(() => useFeatures())
    expect(result.current.sidebar).toBe(true)
    expect(result.current.crm).toBe(true)
    expect(result.current.tableAssignments).toBe(true)
  })
})
