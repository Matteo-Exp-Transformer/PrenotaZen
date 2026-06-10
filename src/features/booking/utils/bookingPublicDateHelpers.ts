/**
 * Helper date condivisi dai componenti del form pubblico /prenota.
 * Restano separati da `dateUtils.ts` (LOCK admin) per non rischiare regressioni
 * sui contratti createBookingDateTime / extractTimeFromISO.
 */

/** Restituisce la data odierna locale in formato "YYYY-MM-DD". */
export function getTodayIso(): string {
  return dateToIso(new Date())
}

/** Converte una Date in stringa "YYYY-MM-DD" (calendario locale, no timezone). */
export function dateToIso(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Restituisce "HH:MM" dell'ora corrente (per validazione ora minima quando la data è oggi). */
export function getCurrentTimeHHMM(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}
