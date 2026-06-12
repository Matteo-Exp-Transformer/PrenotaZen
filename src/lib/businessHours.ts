/**
 * Business Hours Validation Logic
 * Validates booking date/time against restaurant opening hours
 */

import { slotRangesOverlap } from '@/features/booking/utils/bookingTimeSlots'
import { logger } from '@/lib/logger'

export interface BusinessHourSlot {
  open: string // Format: "HH:mm" (e.g., "11:00")
  close: string // Format: "HH:mm" (e.g., "00:00" or "01:00")
}

export interface BusinessHours {
  monday: BusinessHourSlot[] | null
  tuesday: BusinessHourSlot[] | null
  wednesday: BusinessHourSlot[] | null
  thursday: BusinessHourSlot[] | null
  friday: BusinessHourSlot[] | null
  saturday: BusinessHourSlot[] | null
  sunday: BusinessHourSlot[] | null
}

/**
 * Extract day of week from date string (YYYY-MM-DD format)
 * Returns lowercase day name: "monday", "tuesday", etc.
 */
export function getDayOfWeek(dateString: string): keyof BusinessHours {
  const date = new Date(dateString)
  const dayIndex = date.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  const dayMap: Record<number, keyof BusinessHours> = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday'
  }
  
  return dayMap[dayIndex]
}

/**
 * Parse time string "HH:mm" to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Check if a time falls within a time slot, handling midnight crossover
 */
function isTimeInSlot(
  time: string,
  slot: BusinessHourSlot
): boolean {
  const timeMinutes = timeToMinutes(time)
  const openMinutes = timeToMinutes(slot.open)
  let closeMinutes = timeToMinutes(slot.close)
  
  // Handle midnight crossover:
  // - "00:00" means closing at end of day (24:00 = 1440 minutes)
  // - "01:00" means closing at 1am next day (25:00 = 1500 minutes, wraps to 60)
  if (closeMinutes === 0) {
    // "00:00" = end of current day (24:00)
    closeMinutes = 1440
  } else if (closeMinutes === 60) {
    // "01:00" = 1am next day, represented as 60 minutes (since it's after midnight)
    closeMinutes = 1500 // 25:00
  }
  
  // Determine if slot crosses midnight
  // A slot crosses midnight if close time (after conversion) > 1440 (next day)
  const crossesMidnight = closeMinutes > 1440
  
  if (crossesMidnight) {
    // Slot crosses midnight (e.g., 22:00-01:00 or 11:00-01:00)
    // Valid times: >= open OR < (close % 1440)
    const closeNextDay = closeMinutes % 1440 // e.g., 1500 % 1440 = 60
    return timeMinutes >= openMinutes || timeMinutes < closeNextDay
  } else {
    // Normal case: slot within same day (e.g., 11:00-00:00 means 11:00-24:00)
    return timeMinutes >= openMinutes && timeMinutes < closeMinutes
  }
}

/**
 * Validate if booking date/time is within business hours
 */
export function isValidBookingDateTime(
  date: string,
  time: string,
  hours: BusinessHours
): boolean {
  const dayName = getDayOfWeek(date)
  const dayHours = hours[dayName]
  
  // If day is closed (null or empty array)
  if (!dayHours || dayHours.length === 0) {
    return false
  }
  
  // Check if time falls within any time slot for this day
  return dayHours.some(slot => isTimeInSlot(time, slot))
}

/**
 * Format business hours for display
 * Example: "11:00 - 00:00" or "11:00 - 01:00"
 */
export function formatHours(slots: BusinessHourSlot[]): string {
  if (slots.length === 0) {
    return 'Chiuso'
  }
  
  return slots
    .map(slot => {
      const closeDisplay = slot.close === '00:00' ? '00:00' : slot.close
      return `${slot.open} - ${closeDisplay}`
    })
    .join(', ')
}

/**
 * Get default hardcoded business hours (fallback)
 */
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/

export const BUSINESS_HOURS_DAY_LABELS: Record<keyof BusinessHours, string> = {
  monday: 'Lunedì',
  tuesday: 'Martedì',
  wednesday: 'Mercoledì',
  thursday: 'Giovedì',
  friday: 'Venerdì',
  saturday: 'Sabato',
  sunday: 'Domenica',
}

const BUSINESS_HOURS_DAY_ORDER: (keyof BusinessHours)[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

/** Ordina fasce per orario di apertura prima di validare o confrontare. */
export function sortBusinessHourSlots(slots: BusinessHourSlot[]): BusinessHourSlot[] {
  return [...slots].sort((a, b) => a.open.localeCompare(b.open))
}

/**
 * Valida le fasce di un singolo giorno: formato HH:mm, no apertura=chiusura, no sovrapposizioni.
 * Usa slotRangesOverlap mappando open→start e close→end (include fasce oltre mezzanotte).
 */
export function validateBusinessHourSlots(slots: BusinessHourSlot[]): string | null {
  if (slots.length < 2) return null

  const sorted = sortBusinessHourSlots(slots)
  for (const slot of sorted) {
    if (!HH_MM.test(slot.open) || !HH_MM.test(slot.close)) {
      return 'Orari nel formato HH:mm richiesti'
    }
    if (slot.open === slot.close) {
      return 'Apertura e chiusura non possono coincidere'
    }
  }

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (
        slotRangesOverlap(
          sorted[i].open,
          sorted[i].close,
          sorted[j].open,
          sorted[j].close
        )
      ) {
        return 'Due fasce di apertura si sovrappongono'
      }
    }
  }

  return null
}

/** Errore per giorno (chiave = giorno) per feedback live nell'editor. */
export function getBusinessHoursDayErrors(
  hours: BusinessHours
): Partial<Record<keyof BusinessHours, string>> {
  const errors: Partial<Record<keyof BusinessHours, string>> = {}
  for (const day of BUSINESS_HOURS_DAY_ORDER) {
    const slots = hours[day]
    if (!slots || slots.length < 2) continue
    const err = validateBusinessHourSlots(slots)
    if (err) errors[day] = err
  }
  return errors
}

/** Prima occorrenza di errore su tutti i giorni, con etichetta giorno (salvataggio / toast). */
export function validateBusinessHours(hours: BusinessHours): string | null {
  for (const day of BUSINESS_HOURS_DAY_ORDER) {
    const slots = hours[day]
    if (!slots || slots.length < 2) continue
    const err = validateBusinessHourSlots(slots)
    if (err) return `${BUSINESS_HOURS_DAY_LABELS[day]}: ${err}`
  }
  return null
}

export function getDefaultBusinessHours(): BusinessHours {
  return {
    monday: [{ open: '11:00', close: '00:00' }],
    tuesday: [{ open: '11:00', close: '00:00' }],
    wednesday: [{ open: '11:00', close: '00:00' }],
    thursday: [{ open: '11:00', close: '00:00' }],
    friday: [{ open: '11:00', close: '01:00' }],
    saturday: [{ open: '17:00', close: '01:00' }],
    sunday: null
  }
}

/**
 * Parse business hours from JSONB setting value
 * Validates structure and returns typed BusinessHours
 */
export function parseBusinessHours(settingValue: any): BusinessHours | null {
  if (!settingValue || typeof settingValue !== 'object') {
    return null
  }
  
  try {
    const hours: BusinessHours = {
      monday: settingValue.monday || null,
      tuesday: settingValue.tuesday || null,
      wednesday: settingValue.wednesday || null,
      thursday: settingValue.thursday || null,
      friday: settingValue.friday || null,
      saturday: settingValue.saturday || null,
      sunday: settingValue.sunday || null
    }
    
    // Validate structure
    const dayNames: (keyof BusinessHours)[] = [
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
    ]
    
    for (const day of dayNames) {
      if (hours[day] !== null && !Array.isArray(hours[day])) {
        return null
      }
      
      if (Array.isArray(hours[day])) {
        for (const slot of hours[day] as BusinessHourSlot[]) {
          if (!slot.open || !slot.close) {
            return null
          }
        }
      }
    }
    
    return hours
  } catch (error) {
    logger.error('Error parsing business hours:', error)
    return null
  }
}

