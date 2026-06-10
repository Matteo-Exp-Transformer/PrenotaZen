
/**
 * Configurazione di una fascia oraria dinamica (N fasce, non più 3 fisse).
 * Usa `id` (service_slots.id) come chiave nei calcoli capacity.
 */
export type SlotConfig = {
  id: string
  name: string
  start_time: string  // HH:mm
  end_time: string    // HH:mm
  display_order: number
  is_canonical: boolean
  slot_color?: string | null
}

/** Ritorna l'etichetta UI di una fascia: "Nome HH:mm - HH:mm" */
export function getSlotLabel(slot: Pick<SlotConfig, 'name' | 'start_time' | 'end_time'>): string {
  return `${slot.name} ${slot.start_time.slice(0, 5)} - ${slot.end_time.slice(0, 5)}`
}

/**
 * Valida un array di SlotConfig: formato orari, nomi univoci, no inizio=fine, no sovrapposizioni.
 * Ritorna stringa di errore o null.
 */
export function validateSlotConfigs(slots: SlotConfig[]): string | null {
  if (slots.length === 0) return 'Almeno una fascia oraria è richiesta'
  const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/
  const names = new Set<string>()
  for (const slot of slots) {
    if (!HH_MM.test(slot.start_time)) return `Fascia "${slot.name}": orario inizio non valido`
    if (!HH_MM.test(slot.end_time)) return `Fascia "${slot.name}": orario fine non valido`
    if (slot.start_time === slot.end_time) return `Fascia "${slot.name}": inizio e fine coincidono`
    const key = slot.name.trim().toLowerCase()
    if (names.has(key)) return `Nome fascia duplicato: "${slot.name}"`
    names.add(key)
  }
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      if (slotRangesOverlap(slots[i].start_time, slots[i].end_time, slots[j].start_time, slots[j].end_time)) {
        return `Le fasce "${slots[i].name}" e "${slots[j].name}" si sovrappongono`
      }
    }
  }
  return null
}

/** end_time < start_time → fascia che attraversa la mezzanotte */
export function slotCrossesMidnight(slot: Pick<SlotConfig, 'start_time' | 'end_time'>): boolean {
  return slot.end_time.slice(0, 5) < slot.start_time.slice(0, 5)
}

/** Avviso UI quando fine < inizio (orario nel giorno successivo). */
export const OVERNIGHT_TIME_END_HINT =
  "Orario notturno — l'orario di fine cade nel giorno successivo."

export function parseHmToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

type MinuteRange = [number, number]

function toDaySegments(start: number, end: number): MinuteRange[] {
  // Fascia che attraversa la mezzanotte: es. 18:00 -> 03:00
  if (end < start) return [[start, 24 * 60], [0, end]]
  return [[start, end]]
}

function rangesOverlap(a: MinuteRange, b: MinuteRange): boolean {
  return a[0] < b[1] && b[0] < a[1]
}

export function slotRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  const aSegments = toDaySegments(parseHmToMinutes(aStart), parseHmToMinutes(aEnd))
  const bSegments = toDaySegments(parseHmToMinutes(bStart), parseHmToMinutes(bEnd))
  for (const a of aSegments) {
    for (const b of bSegments) {
      if (rangesOverlap(a, b)) return true
    }
  }
  return false
}

export function isTimeInsideSlot(time: string, slotStart: string, slotEnd: string): boolean {
  const t = parseHmToMinutes(time)
  const start = parseHmToMinutes(slotStart)
  const end = parseHmToMinutes(slotEnd)
  if (end < start) {
    return t >= start || t <= end
  }
  return t >= start && t <= end
}


