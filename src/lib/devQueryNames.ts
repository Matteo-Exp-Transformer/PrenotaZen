/**
 * Traduce le `queryKey` di TanStack Query in frasi leggibili per il pannello dev.
 * SOLO dev (usato da App.tsx dietro gate). Esempio: ['bookingRequests', 'abc'] → «prenotazioni».
 *
 * Mappa il PRIMO segmento della queryKey (la convenzione del progetto: la chiave inizia con
 * il nome-risorsa). Se non lo conosciamo, mostriamo il nome grezzo: meglio un nome tecnico che niente.
 */

const NAME_MAP: Record<string, string> = {
  bookingRequests: 'prenotazioni',
  adminBookingRequests: 'prenotazioni (admin)',
  menuCategories: 'categorie menu',
  menuItems: 'piatti menu',
  menuQrCodes: 'QR menu',
  menuQrcodeCategories: 'categorie QR',
  restaurantSetting: 'impostazioni ristorante',
  restaurantSettings: 'impostazioni ristorante',
  serviceSlots: 'fasce di servizio',
  serviceSlotOverrides: 'modifiche fasce (Quando?)',
  tableAssignments: 'assegnazioni tavoli',
  servizioTables: 'tavoli servizio',
  rooms: 'sale',
  customers: 'clienti (CRM)',
  tenant: 'ristorante',
  businessHours: 'orari di apertura',
}

/** Nome leggibile della risorsa dalla queryKey. */
export function devQueryName(queryKey: readonly unknown[]): string {
  const first = queryKey?.[0]
  if (typeof first === 'string' && NAME_MAP[first]) return NAME_MAP[first]
  if (typeof first === 'string') return first
  return 'dato'
}

/** Conta righe dal risultato di una query, quando è un array (per «N trovate»). */
export function devCountFromData(data: unknown): number | null {
  if (Array.isArray(data)) return data.length
  return null
}

/**
 * Etichetta breve per i conteggi della fotografia salute (i «dati utili sotto» il log unico).
 * Solo le poche risorse che ha senso vedere a colpo d'occhio; le altre → null (non in testa).
 */
const HEALTH_COUNT_KEY: Record<string, string> = {
  bookingRequests: 'prenotazioni',
  adminBookingRequests: 'prenotazioni',
  menuCategories: 'cat. menu',
  menuItems: 'piatti',
  serviceSlots: 'fasce',
  customers: 'clienti',
}

export function devHealthCountKey(queryKey: readonly unknown[]): string | null {
  const first = queryKey?.[0]
  if (typeof first === 'string' && HEALTH_COUNT_KEY[first]) return HEALTH_COUNT_KEY[first]
  return null
}
