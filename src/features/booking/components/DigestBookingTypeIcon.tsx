import { BookOpen, GraduationCap, UserRound, UtensilsCrossed } from 'lucide-react'
import type { BookingRequest, BookingType } from '@/types/booking'
import { useFeatures } from '@/hooks/useFeatures'
import { cn } from '@/lib/utils'

/** Icona lucide per la tipologia prenotazione (digest / card compatte). */
export function DigestBookingTypeIcon({
  booking,
  className,
}: {
  booking: BookingRequest
  className?: string
}) {
  const features = useFeatures()
  const t = (booking.booking_type ?? 'tavolo') as BookingType
  const iconClass = cn('shrink-0', className)
  if (features.walkIn && booking.source === 'walk_in') {
    return <UserRound className={iconClass} aria-hidden />
  }
  if (t === 'rinfresco_laurea') {
    return <GraduationCap className={iconClass} aria-hidden />
  }
  if (t === 'menu_prezzo_fisso') {
    return <BookOpen className={iconClass} aria-hidden />
  }
  return <UtensilsCrossed className={iconClass} aria-hidden />
}
