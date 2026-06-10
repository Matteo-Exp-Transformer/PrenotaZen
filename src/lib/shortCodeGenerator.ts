const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

/** Genera un codice URL-safe di lunghezza `length` (default 7). */
export function generateShortCode(length = 7): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes)
    .map((b) => ALPHABET[b % ALPHABET.length])
    .join('')
}
