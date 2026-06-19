import type { DietaryRestriction } from '@/types/booking'

/** Testo libero mostrato nel form pubblico, ricostruito da JSON salvato. */
export function dietaryRestrictionsToText(
  restrictions: DietaryRestriction[] | undefined | null
): string {
  if (!restrictions?.length) return ''
  return restrictions
    .map((r) => (r.restriction === 'Altro' && r.notes ? r.notes : r.restriction))
    .join(', ')
}

/** Suffisso «- N ospite/i» in admin: solo se il conteggio è stato specificato (>= 1). */
export function shouldShowDietaryGuestCount(restriction: Pick<DietaryRestriction, 'guest_count'>): boolean {
  return restriction.guest_count >= 1
}

export function formatDietaryGuestCountLabel(guest_count: number): string {
  return `${guest_count} ${guest_count === 1 ? 'ospite' : 'ospiti'}`
}

/** Salva il testo libero come singola voce in dietary_restrictions (JSONB). */
export function dietaryTextToRestrictions(text: string): DietaryRestriction[] {
  if (!text.trim()) return []
  return [{ restriction: text, guest_count: 0 }]
}

/** Trim solo in invio prenotazione — mai in onChange, altrimenti la barra spaziatrice non funziona mentre si digita. */
export function normalizeDietaryRestrictionsForSubmit(
  restrictions: DietaryRestriction[] | undefined | null,
): DietaryRestriction[] {
  if (!restrictions?.length) return []
  return restrictions
    .map((r) => ({
      ...r,
      restriction: r.restriction.trim(),
      notes: r.notes?.trim() || undefined,
    }))
    .filter((r) => r.restriction.length > 0 || (r.notes?.length ?? 0) > 0)
}
