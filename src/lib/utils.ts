import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Caratteri Unicode di controllo direzionale: possono far sembrare la digitazione “al contrario” negli input. */
const DIRECTIONAL_FORMATTING_CHARS_RE = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g

export function stripDirectionalFormattingChars(value: string): string {
  return value.replace(DIRECTIONAL_FORMATTING_CHARS_RE, '')
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
