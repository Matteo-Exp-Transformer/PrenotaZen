
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

// ─── S3: Intervalli di arrivo ─────────────────────────────────────────────────

export interface ArrivalSlotConfig {
  slot_start: string
  slot_end: string
  arrival_step_minutes: number
  /** Durata card/tipologia risolta — usata per filtro "ultimo arrivo utile" */
  card_duration_minutes?: number
  /** Pavimento fascia (min_duration) — fallback se card non ha durata */
  slot_min_duration?: number
  /** Anticipo minimo dalla ora corrente (default 60 min, D20) */
  cutoff_minutes?: number
  /** Toggle tardivo (default false, D16) */
  late_arrival_allowed?: boolean
  /** Pavimento tardivo: min di ordine garantito (default 45, D16) */
  min_order_time_minutes?: number
}

export interface ArrivalTime {
  time: string
  /** false → slot da nascondere (cutoff scaduto o durata insufficiente) */
  isValid: boolean
}

/**
 * Genera gli slot di arrivo step-aligned per una fascia.
 * Pura e deterministica: zero import Supabase, testabile in isolamento (S3/D18).
 *
 * @param nowMinutes  Minuti dalla mezzanotte dell'ora corrente (per cutoff oggi).
 * @param isToday     true se la data scelta è oggi (attiva il filtro cutoff).
 */
export function deriveArrivalTimes(
  config: ArrivalSlotConfig,
  nowMinutes: number,
  isToday: boolean,
): ArrivalTime[] {
  const {
    slot_start,
    slot_end,
    arrival_step_minutes: step,
    card_duration_minutes,
    slot_min_duration,
    cutoff_minutes = 60,
    late_arrival_allowed = false,
    min_order_time_minutes = 45,
  } = config

  const hhmm = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/
  if (!hhmm.test(slot_start) || !hhmm.test(slot_end)) return []
  if (!Number.isInteger(step) || step < 5 || step > 120) return []
  if (!Number.isFinite(nowMinutes) || !Number.isFinite(cutoff_minutes)) return []
  if (card_duration_minutes != null && (!Number.isFinite(card_duration_minutes) || card_duration_minutes < 0)) return []
  if (slot_min_duration != null && (!Number.isFinite(slot_min_duration) || slot_min_duration < 0)) return []
  if (!Number.isFinite(min_order_time_minutes) || min_order_time_minutes < 0) return []

  const startMin = parseHmToMinutes(slot_start)
  let endMin = parseHmToMinutes(slot_end)

  // Overnight: end <= start → aggiunge 24h per confronti lineari
  if (endMin <= startMin) endMin += 24 * 60

  const effectiveDuration = card_duration_minutes ?? slot_min_duration ?? 0

  const times: ArrivalTime[] = []
  let current = startMin

  while (current < endMin) {
    const displayMin = current % (24 * 60)
    const h = Math.floor(displayMin / 60)
    const m = displayMin % 60
    const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

    // Cutoff: solo oggi, l'orario deve essere almeno cutoff_minutes nel futuro
    const cutoffOk = !isToday || current >= nowMinutes + cutoff_minutes

    // Durata: il cliente deve avere abbastanza tempo nel slot
    // Con tardivo ON: basta che arrivi entro (slot_end - min_order_time)
    const durationOk = late_arrival_allowed
      ? current + min_order_time_minutes <= endMin
      : current + effectiveDuration <= endMin

    times.push({ time, isValid: cutoffOk && durationOk })
    current += step
  }

  return times
}
