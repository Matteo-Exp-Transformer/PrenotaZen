/** Email normalizzata per CRM / vincolo univoco (lowercase + trim). Vuota → null. */
export function normalizeCustomerEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase()
  return e.length > 0 ? e : null
}

/** Nome cliente normalizzato per raggruppamento rubrica (trim + case-insensitive). */
export function normalizeClientName(raw: string): string {
  return raw.trim().toLowerCase()
}

/** Telefono normalizzato: solo cifre. Null se meno di 4 cifre (non è un numero valido). */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  return digits.length >= 4 ? digits : null
}

/**
 * Chiave di contatto per un profilo rubrica.
 * Priorità: email normalizzata → "tel:<cifre>" → null (cliente escluso dalla rubrica).
 */
export function resolveContactKey(
  email: string | null | undefined,
  phone: string | null | undefined,
): string | null {
  const emailKey = normalizeCustomerEmail(email ?? '')
  if (emailKey) return emailKey
  const phoneKey = normalizePhone(phone)
  return phoneKey ? `tel:${phoneKey}` : null
}

/**
 * Chiave stabile profilo rubrica: coppia (contatto, nome) normalizzata.
 * contatto = email normalizzata se presente, altrimenti "tel:<telefono>".
 */
export function customerProfileKey(contact: string, name: string): string {
  const c = contact.trim().toLowerCase()
  const n = normalizeClientName(name)
  return `${c}\0${n}`
}
