import { format } from 'date-fns'
import { it } from 'date-fns/locale'

export const formatBookingDateTime = (dateStr?: string): string => {
  if (!dateStr) return 'Non disponibile'
  try {
    return format(new Date(dateStr), 'd MMM yyyy, HH:mm', { locale: it })
  } catch {
    return dateStr
  }
}


