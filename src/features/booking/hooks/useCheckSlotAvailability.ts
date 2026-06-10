import { useState, useCallback } from 'react'
import { supabasePublic } from '@/lib/supabasePublic'

export interface SlotAvailabilityResult {
  available: boolean
  message?: string
  /** 'daily_limit' | 'slot_limit' | undefined */
  reason?: string
}

export interface UseCheckSlotAvailabilityReturn {
  check: (params: {
    tenantSlug: string
    desired_date: string
    desired_time: string
    num_guests: number
  }) => Promise<SlotAvailabilityResult>
  isChecking: boolean
  result: SlotAvailabilityResult | null
  reset: () => void
}

export function useCheckSlotAvailability(): UseCheckSlotAvailabilityReturn {
  const [isChecking, setIsChecking] = useState(false)
  const [result, setResult] = useState<SlotAvailabilityResult | null>(null)

  const check = useCallback(
    async (params: {
      tenantSlug: string
      desired_date: string
      desired_time: string
      num_guests: number
    }): Promise<SlotAvailabilityResult> => {
      setIsChecking(true)
      try {
        const supabaseUrl = (supabasePublic as unknown as { supabaseUrl: string }).supabaseUrl
          ?? import.meta.env.VITE_SUPABASE_URL
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

        const res = await fetch(
          `${supabaseUrl}/functions/v1/check-slot-availability`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: anonKey,
            },
            body: JSON.stringify(params),
          }
        )

        if (!res.ok && res.status >= 500) {
          // Errore server: non bloccare il cliente, lascia proseguire
          return { available: true }
        }

        const data = await res.json()
        const r: SlotAvailabilityResult = {
          available: data.available ?? true,
          message: data.message,
          reason: data.reason,
        }
        setResult(r)
        return r
      } catch {
        // Network error: non bloccare il cliente
        return { available: true }
      } finally {
        setIsChecking(false)
      }
    },
    []
  )

  const reset = useCallback(() => setResult(null), [])

  return { check, isChecking, result, reset }
}
