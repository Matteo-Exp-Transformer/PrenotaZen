/**
 * Business Hours Validation Logic
 * Validates booking date/time against restaurant opening hours
 */

import {
  isTimeInsideSlot,
  slotRangesOverlap,
} from '@/features/booking/utils/bookingTimeSlots'
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
 * Check if a time falls within a business-hour slot (open→close).
 * Delegates to isTimeInsideSlot — stessa logica overnight di slotRangesOverlap / admin.
 */
function isTimeInSlot(time: string, slot: BusinessHourSlot): boolean {
  return isTimeInsideSlot(time, slot.open, slot.close)
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
 * Primo giorno APERTO a partire dal giorno successivo a `fromDateISO`.
 * Cerca solo in avanti (le date passate non sono prenotabili). Ritorna l'ISO
 * YYYY-MM-DD del primo giorno con fasce configurate, o null entro `maxDays`.
 */
export function findNearestOpenDay(
  fromDateISO: string,
  hours: BusinessHours,
  maxDays = 365,
): string | null {
  const [y, m, d] = fromDateISO.split('-').map(Number)
  if (!y || !m || !d) return null
  const base = new Date(y, m - 1, d)
  for (let i = 1; i <= maxDays; i++) {
    const probe = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i)
    const iso = `${probe.getFullYear()}-${String(probe.getMonth() + 1).padStart(2, '0')}-${String(
      probe.getDate(),
    ).padStart(2, '0')}`
    const dayHours = hours[getDayOfWeek(iso)]
    if (dayHours && dayHours.length > 0) return iso
  }
  return null
}

/** YYYY-MM-DD → «lunedì 29 giugno» (locale, senza shift UTC). */
function formatNearestOpenDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/**
 * Messaggio "giorno chiuso" che propone il primo giorno aperto vicino, se esiste.
 * Mostrato sotto il campo data della Pagina Prenota.
 */
export function buildClosedDayMessage(dateISO: string, hours: BusinessHours): string {
  const base = 'Il ristorante è chiuso in questo giorno'
  const nearest = findNearestOpenDay(dateISO, hours)
  if (!nearest) return `${base}.`
  return `${base}. Il primo giorno disponibile è ${formatNearestOpenDay(nearest)}.`
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

/**
 * Stato neutro quando `business_hours` non è ancora in DB (admin) o non è parsabile.
 * Tutti i giorni chiusi — nessun orario demo da ristorante reale.
 * L'editor admin usa slot locali solo quando l'operatore apre un giorno.
 */
export function getDefaultBusinessHours(): BusinessHours {
  return {
    monday: null,
    tuesday: null,
    wednesday: null,
    thursday: null,
    friday: null,
    saturday: null,
    sunday: null,
  }
}

/** Almeno un giorno con fasce salvate/configurate. */
export function hasAnyBusinessHoursConfigured(hours: BusinessHours): boolean {
  return BUSINESS_HOURS_DAY_ORDER.some((day) => {
    const slots = hours[day]
    return slots != null && slots.length > 0
  })
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

