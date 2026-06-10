import type { TenantEdition } from '@/types/edition'

export interface FeatureFlags {
  /** Sidebar laterale e sezioni avanzate (Home, CRM, Servizio, Analytics) */
  sidebar: boolean
  /** Pagina Home con KPI giornalieri e quick-nav */
  home: boolean
  /** CRM clienti esteso */
  crm: boolean
  /** Analytics con KPI e trend */
  analytics: boolean
  /** Gestione servizio e tavoli */
  servizio: boolean
  /** Prenotazioni walk-in */
  walkIn: boolean
  /** Segna no-show su una prenotazione */
  noShow: boolean
  /** Assegnazione tavoli alle prenotazioni */
  tableAssignments: boolean
  /** Menu digitale pubblico via QR. Pro/Enterprise: sempre true. Classic: true solo con override in tenant_features. */
  qrMenu: boolean
}

type FeatureKey = keyof FeatureFlags

const PRO_BUNDLE: Set<FeatureKey> = new Set([
  'sidebar',
  'home',
  'crm',
  'analytics',
  'servizio',
  'walkIn',
  'noShow',
  'tableAssignments',
  'qrMenu',
])

const BASE_BUNDLE: Record<TenantEdition, Set<FeatureKey>> = {
  classic:    new Set<FeatureKey>(),
  pro:        PRO_BUNDLE,
  enterprise: PRO_BUNDLE,
}

/**
 * Costruisce i FeatureFlags combinando il bundle dell'edition con gli override
 * per singolo tenant provenienti dalla tabella tenant_features.
 *
 * overrides: array di feature_key (es. ['qrMenu', 'analytics']).
 * Per disabilitare esplicitamente una feature del bundle: prefisso '-' (es. '-analytics').
 */
export const buildFeatures = (edition: TenantEdition, overrides: string[] = []): FeatureFlags => {
  const active = new Set<string>(BASE_BUNDLE[edition])

  for (const key of overrides) {
    if (key.startsWith('-')) {
      active.delete(key.slice(1))
    } else {
      active.add(key)
    }
  }

  return {
    sidebar:          active.has('sidebar'),
    home:             active.has('home'),
    crm:              active.has('crm'),
    analytics:        active.has('analytics'),
    servizio:         active.has('servizio'),
    walkIn:           active.has('walkIn'),
    noShow:           active.has('noShow'),
    tableAssignments: active.has('tableAssignments'),
    qrMenu:           active.has('qrMenu'),
  }
}
