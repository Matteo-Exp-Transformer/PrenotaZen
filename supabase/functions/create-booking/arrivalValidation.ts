export type ArrivalValidationCode = 'OUT_OF_SLOT' | 'INVALID_ARRIVAL_STEP' | 'CUTOFF_EXPIRED' | 'INVALID_DURATION'

export interface ArrivalValidationInput {
  desiredDate: string
  desiredTime: string
  restaurantToday: string
  restaurantNowMinutes: number
  slotStart: string
  slotEnd: string
  arrivalStepMinutes: number
  cutoffMinutes: number
  lateArrivalAllowed: boolean
  minOrderTimeMinutes: number
  slotMinDuration: number | null
  durationMinutes: number | null
}

function hm(value: string): number | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) return null
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

export function validateArrivalRules(input: ArrivalValidationInput): ArrivalValidationCode | null {
  const selected = hm(input.desiredTime)
  const start = hm(input.slotStart)
  let end = hm(input.slotEnd)
  if (selected == null || start == null || end == null) return 'OUT_OF_SLOT'

  let normalized = selected
  if (end <= start) {
    end += 1440
    if (normalized < start) normalized += 1440
  }
  if (normalized < start || normalized >= end) return 'OUT_OF_SLOT'
  if (!Number.isInteger(input.arrivalStepMinutes) || input.arrivalStepMinutes < 5 || input.arrivalStepMinutes > 120
    || (normalized - start) % input.arrivalStepMinutes !== 0) return 'INVALID_ARRIVAL_STEP'
  if (input.desiredDate === input.restaurantToday
    && normalized < input.restaurantNowMinutes + input.cutoffMinutes) return 'CUTOFF_EXPIRED'

  const minimum = Math.max(30, input.slotMinDuration ?? 0)
  if (input.durationMinutes != null && input.durationMinutes < minimum) return 'INVALID_DURATION'
  const effectiveDuration = input.durationMinutes ?? input.slotMinDuration ?? 0
  const fits = input.lateArrivalAllowed
    ? normalized + input.minOrderTimeMinutes <= end
    : normalized + effectiveDuration <= end
  return fits ? null : 'CUTOFF_EXPIRED'
}
