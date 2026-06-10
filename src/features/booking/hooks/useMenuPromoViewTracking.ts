import { useEffect, useRef } from 'react'
import { resolveMenuPromoForBookingView, type MenuPromo } from '@/features/booking/constants/menuPromo'
import type { BookingType } from '@/types/booking'

export type UseMenuPromoViewTrackingInput = {
  bookingType: BookingType
  modeId: string
  subTabId: string | null
  promos: MenuPromo[]
}

/** Traccia le promo mostrate al cliente durante la navigazione in Pagina Prenota. */
export function useMenuPromoViewTracking(input: UseMenuPromoViewTrackingInput) {
  const viewedPromoIdsRef = useRef<string[]>([])
  const { bookingType, modeId, subTabId, promos } = input

  const resolvedPromo = resolveMenuPromoForBookingView({
    bookingType,
    modeId,
    subTabId,
    promos,
  })

  useEffect(() => {
    const promoId = resolvedPromo?.id
    if (!promoId) return
    if (!viewedPromoIdsRef.current.includes(promoId)) {
      viewedPromoIdsRef.current = [...viewedPromoIdsRef.current, promoId]
    }
  }, [resolvedPromo?.id, bookingType, modeId, subTabId])

  const resetViewedPromos = () => {
    viewedPromoIdsRef.current = []
  }

  return {
    resolvedPromo,
    viewedPromoIdsRef,
    resetViewedPromos,
  }
}
