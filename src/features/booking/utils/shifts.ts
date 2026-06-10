/**
 * Utility per rilevare il turno (pranzo/cena) da business_hours del tenant.
 * Usato da Analytics F2 e ShiftBriefing F4.
 */

export type ShiftFilter = 'all' | 'lunch' | 'dinner'

export interface ShiftTimeRange {
  startHour: number
  endHour: number
}

/**
 * Calcola i range orari pranzo/cena dai business_hours del tenant.
 * business_hours è un oggetto { monday: { lunch: { open, close }, dinner: { open, close } }, ... }
 * oppure un array di slot. Usiamo un'euristica semplice: se c'è un pattern
 * con due blocchi orari separati da un gap, il primo è pranzo e il secondo è cena.
 *
 * Fallback: pranzo 11:00-15:00, cena 18:00-23:00.
 */
export function getShiftRanges(businessHoursRaw: unknown): {
  lunch: ShiftTimeRange
  dinner: ShiftTimeRange
} {
  const defaults = {
    lunch: { startHour: 11, endHour: 15 },
    dinner: { startHour: 18, endHour: 23 },
  }

  if (!businessHoursRaw || typeof businessHoursRaw !== 'object') return defaults

  // Cerca slot tipo { lunch_start, lunch_end, dinner_start, dinner_end }
  const raw = businessHoursRaw as Record<string, unknown>
  if (
    typeof raw['lunch_start'] === 'string' &&
    typeof raw['lunch_end'] === 'string' &&
    typeof raw['dinner_start'] === 'string' &&
    typeof raw['dinner_end'] === 'string'
  ) {
    return {
      lunch: {
        startHour: parseInt(raw['lunch_start'] as string, 10),
        endHour: parseInt(raw['lunch_end'] as string, 10),
      },
      dinner: {
        startHour: parseInt(raw['dinner_start'] as string, 10),
        endHour: parseInt(raw['dinner_end'] as string, 10),
      },
    }
  }

  return defaults
}

/**
 * Dato un timestamp ISO e i range turno, restituisce a quale turno appartiene.
 * Usato per filtrare i KPI analytics.
 */
export function getShiftForTimestamp(
  isoTimestamp: string,
  shiftRanges: { lunch: ShiftTimeRange; dinner: ShiftTimeRange },
): ShiftFilter {
  const hour = new Date(isoTimestamp).getHours()
  if (hour >= shiftRanges.lunch.startHour && hour < shiftRanges.lunch.endHour) return 'lunch'
  if (hour >= shiftRanges.dinner.startHour && hour < shiftRanges.dinner.endHour) return 'dinner'
  return 'all'
}

/**
 * Dato un orario "HH:MM" in formato stringa, determina il turno.
 */
export function getShiftForTimeString(
  timeStr: string,
  shiftRanges: { lunch: ShiftTimeRange; dinner: ShiftTimeRange },
): 'lunch' | 'dinner' | null {
  if (!timeStr) return null
  const hour = parseInt(timeStr.split(':')[0], 10)
  if (isNaN(hour)) return null
  if (hour >= shiftRanges.lunch.startHour && hour < shiftRanges.lunch.endHour) return 'lunch'
  if (hour >= shiftRanges.dinner.startHour && hour < shiftRanges.dinner.endHour) return 'dinner'
  return null
}
