import { useState, useCallback } from 'react'
import { toast } from 'react-toastify'

interface RateLimitOptions {
  maxAttempts: number
  timeWindow: number // in milliseconds
}

interface RateLimitState {
  attempts: number
  resetTime: number
}

const RATE_LIMIT_KEY = 'booking-form-rate-limit'

export const useRateLimit = (options: RateLimitOptions = { maxAttempts: 3, timeWindow: 60000 }) => {
  const [isBlocked, setIsBlocked] = useState(false)

  const checkRateLimit = useCallback((): boolean => {
    try {
      const stored = localStorage.getItem(RATE_LIMIT_KEY)
      
      if (!stored) {
        // First attempt
        const newState: RateLimitState = {
          attempts: 1,
          resetTime: Date.now() + options.timeWindow
        }
        localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(newState))
        return true
      }

      const state: RateLimitState = JSON.parse(stored)

      // Check if time window has expired
      if (Date.now() > state.resetTime) {
        // Reset window
        const newState: RateLimitState = {
          attempts: 1,
          resetTime: Date.now() + options.timeWindow
        }
        localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(newState))
        return true
      }

      // Check if max attempts reached
      if (state.attempts >= options.maxAttempts) {
        const remainingTime = Math.ceil((state.resetTime - Date.now()) / 1000)
        setIsBlocked(true)
        toast.error(
          `Hai raggiunto il limite di ${options.maxAttempts} richieste. Riprova tra ${remainingTime} secondi.`
        )
        return false
      }

      // Increment attempts
      state.attempts++
      localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(state))
      return true
    } catch (error) {
      console.error('[RateLimit] Error:', error)
      // Allow submission if localStorage fails
      return true
    }
  }, [options])

  const resetRateLimit = useCallback(() => {
    localStorage.removeItem(RATE_LIMIT_KEY)
    setIsBlocked(false)
  }, [])

  return { checkRateLimit, isBlocked, resetRateLimit }
}
