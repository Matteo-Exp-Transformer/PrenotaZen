/** Email normalizzata per CRM / vincolo univoco (lowercase + trim). Vuota → null. */
export function normalizeCustomerEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase()
  return e.length > 0 ? e : null
}
