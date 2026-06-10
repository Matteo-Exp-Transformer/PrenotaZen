import type { FeatureFlags } from '@/config/features'

export type AdminShellSection = 'home' | 'prenotazioni' | 'crm' | 'servizio' | 'analytics'
export type AdminDashboardTab = 'calendar' | 'pending' | 'archive' | 'menu' | 'settings-restaurant'

type ShellFeatureFlags = Pick<FeatureFlags, 'sidebar' | 'home' | 'crm' | 'servizio' | 'analytics'>

const ADMIN_SECTION_SLUGS: Record<AdminShellSection, string> = {
  home: 'home',
  prenotazioni: 'prenotazioni',
  crm: 'crm',
  servizio: 'servizio',
  analytics: 'analytics',
}

const ADMIN_DASHBOARD_TAB_SLUGS: Record<AdminDashboardTab, string> = {
  calendar: 'calendario',
  pending: 'prenotazioni',
  archive: 'archivio',
  menu: 'menu',
  'settings-restaurant': 'impostazioni',
}

const ADMIN_SECTION_FROM_SLUG = Object.fromEntries(
  Object.entries(ADMIN_SECTION_SLUGS).map(([section, slug]) => [slug, section]),
) as Record<string, AdminShellSection>

const ADMIN_DASHBOARD_TAB_FROM_SLUG = Object.fromEntries(
  Object.entries(ADMIN_DASHBOARD_TAB_SLUGS).map(([tab, slug]) => [slug, tab]),
) as Record<string, AdminDashboardTab>

export type AdminRouteState = {
  section: AdminShellSection
  dashboardTab: AdminDashboardTab | null
  canonicalPath: string
}

export function getDefaultAdminSection(features: ShellFeatureFlags): AdminShellSection {
  if (!features.sidebar) return 'prenotazioni'
  return features.home ? 'home' : 'prenotazioni'
}

export function isAdminSectionEnabled(
  section: AdminShellSection,
  features: ShellFeatureFlags,
): boolean {
  if (section === 'prenotazioni') return true
  if (section === 'home') return features.sidebar && features.home
  return features.sidebar && features[section]
}

export function getAdminSectionPath(section: AdminShellSection): string {
  if (section === 'home') return '/admin'
  if (section === 'prenotazioni') return getAdminDashboardTabPath('calendar')
  return `/admin/${ADMIN_SECTION_SLUGS[section]}`
}

export function getAdminDashboardTabPath(tab: AdminDashboardTab): string {
  return `/admin/${ADMIN_DASHBOARD_TAB_SLUGS[tab]}`
}

export function resolveAdminDashboardTabFromPath(pathname: string): AdminDashboardTab | null {
  const normalized = pathname.replace(/\/+$/, '') || '/admin'
  const [, adminRoot, sectionSlug] = normalized.split('/')
  if (adminRoot !== 'admin' || !sectionSlug) return null
  return ADMIN_DASHBOARD_TAB_FROM_SLUG[sectionSlug] ?? null
}

export function resolveAdminRouteFromPath(
  pathname: string,
  features: ShellFeatureFlags,
): AdminRouteState {
  const normalized = pathname.replace(/\/+$/, '') || '/admin'
  const [, adminRoot, sectionSlug] = normalized.split('/')
  const defaultSection = getDefaultAdminSection(features)

  if (adminRoot !== 'admin') {
    return {
      section: defaultSection,
      dashboardTab: defaultSection === 'prenotazioni' ? 'calendar' : null,
      canonicalPath: getAdminSectionPath(defaultSection),
    }
  }

  if (!sectionSlug) {
    return {
      section: defaultSection,
      dashboardTab: defaultSection === 'prenotazioni' ? 'calendar' : null,
      canonicalPath: '/admin',
    }
  }

  const dashboardTab = ADMIN_DASHBOARD_TAB_FROM_SLUG[sectionSlug]
  if (dashboardTab) {
    return {
      section: 'prenotazioni',
      dashboardTab,
      canonicalPath: getAdminDashboardTabPath(dashboardTab),
    }
  }

  const section = ADMIN_SECTION_FROM_SLUG[sectionSlug]
  if (section && isAdminSectionEnabled(section, features)) {
    return {
      section,
      dashboardTab: section === 'prenotazioni' ? 'calendar' : null,
      canonicalPath: getAdminSectionPath(section),
    }
  }

  return {
    section: defaultSection,
    dashboardTab: defaultSection === 'prenotazioni' ? 'calendar' : null,
    canonicalPath: getAdminSectionPath(defaultSection),
  }
}

export function resolveAdminSectionFromPath(
  pathname: string,
  features: ShellFeatureFlags,
): AdminShellSection {
  return resolveAdminRouteFromPath(pathname, features).section
}

export async function runGuardedAdminLogout(
  confirmNavigation: () => Promise<boolean>,
  logout: () => Promise<void>,
): Promise<void> {
  if (!(await confirmNavigation())) return
  await logout()
}
