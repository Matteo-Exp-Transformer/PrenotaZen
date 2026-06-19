import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRateLimit } from '@/hooks/useRateLimit'

vi.mock('react-toastify', () => ({ toast: { error: vi.fn() } }))

beforeEach(() => {
  localStorage.clear()
})

describe('useRateLimit — maxAttempts 7', () => {
  it('consente 7 tentativi consecutivi e blocca all\'8°', () => {
    const { result } = renderHook(() => useRateLimit({ maxAttempts: 7, timeWindow: 60000 }))

    for (let i = 0; i < 7; i++) {
      let allowed: boolean
      act(() => { allowed = result.current.checkRateLimit() })
      expect(allowed!).toBe(true)
    }

    let blocked: boolean
    act(() => { blocked = result.current.checkRateLimit() })
    expect(blocked!).toBe(false)
    expect(result.current.isBlocked).toBe(true)
  })

  it('checkRateLimit ritorna true dopo la scadenza della finestra', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useRateLimit({ maxAttempts: 7, timeWindow: 60000 }))

    for (let i = 0; i < 8; i++) {
      act(() => { result.current.checkRateLimit() })
    }

    // Scade la finestra di 60s
    act(() => { vi.advanceTimersByTime(60001) })

    // Il prossimo tentativo reimposta il contatore localStorage e torna true
    let allowed: boolean
    act(() => { allowed = result.current.checkRateLimit() })
    expect(allowed!).toBe(true)

    vi.useRealTimers()
  })

  it('usa 7 come default maxAttempts', () => {
    const { result } = renderHook(() => useRateLimit())

    for (let i = 0; i < 7; i++) {
      act(() => { result.current.checkRateLimit() })
    }
    expect(result.current.isBlocked).toBe(false)

    act(() => { result.current.checkRateLimit() })
    expect(result.current.isBlocked).toBe(true)
  })
})
