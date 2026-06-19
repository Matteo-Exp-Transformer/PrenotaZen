const PRENOTA_RETURN_PATH_RE = /^\/prenota\/[a-zA-Z0-9_-]+$/

/** Percorsi interni ammessi come destinazione «Torna…» dalla Privacy Policy. */
export function isValidPrivacyReturnPath(path: string | null | undefined): path is string {
  if (!path || !path.startsWith('/')) return false
  return PRENOTA_RETURN_PATH_RE.test(path)
}

export function buildPrenotaReturnPath(tenantSlug: string | undefined): string | undefined {
  if (!tenantSlug) return undefined
  return `/prenota/${tenantSlug}`
}

export function buildPrivacyPolicyLink(returnPath?: string): string {
  if (!returnPath || !isValidPrivacyReturnPath(returnPath)) return '/privacy'
  return `/privacy?from=${encodeURIComponent(returnPath)}`
}

export function resolvePrivacyReturnPath(
  search: string,
  state: unknown,
): string | null {
  const fromQuery = new URLSearchParams(search).get('from')
  if (isValidPrivacyReturnPath(fromQuery)) return fromQuery

  if (
    state != null &&
    typeof state === 'object' &&
    'from' in state &&
    typeof (state as { from?: unknown }).from === 'string'
  ) {
    const fromState = (state as { from: string }).from
    if (isValidPrivacyReturnPath(fromState)) return fromState
  }

  return null
}

export type PrivacyBackAction =
  | { kind: 'history-back' }
  | { kind: 'replace'; path: string }
  | { kind: 'navigate'; path: string }

/**
 * Strategia «indietro» dalla pagina standalone `/privacy`: non impilare una nuova entry su Prenota.
 * (Dal form Prenota la policy è una modale in-page, qui non passa.)
 */
export function resolvePrivacyBackAction(
  returnPath: string | null,
  context: { historyLength: number; locationKey: string | undefined },
): PrivacyBackAction {
  if (returnPath) {
    if (context.historyLength > 1 && context.locationKey !== 'default') {
      return { kind: 'history-back' }
    }
    return { kind: 'replace', path: returnPath }
  }
  return { kind: 'navigate', path: '/' }
}
