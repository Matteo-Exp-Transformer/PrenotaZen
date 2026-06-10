import { describe, expect, it, vi } from 'vitest'
import {
  getAdminDashboardTabPath,
  getAdminSectionPath,
  getDefaultAdminSection,
  isAdminSectionEnabled,
  resolveAdminDashboardTabFromPath,
  resolveAdminRouteFromPath,
  resolveAdminSectionFromPath,
  runGuardedAdminLogout,
} from '../adminShellRouting'
import type { FeatureFlags } from '@/config/features'

const classic: FeatureFlags = {
  sidebar: false,
  home: false,
  crm: false,
  analytics: false,
  servizio: false,
  walkIn: false,
  noShow: false,
  tableAssignments: false,
  qrMenu: false,
}

const pro: FeatureFlags = {
  sidebar: true,
  home: true,
  crm: true,
  analytics: true,
  servizio: true,
  walkIn: true,
  noShow: true,
  tableAssignments: true,
  qrMenu: true,
}

describe('adminShellRouting', () => {
  it('Classic resta sulle prenotazioni anche se arriva una sotto-route Pro', () => {
    // @admin-blindatura: shell-edition
    // Copre: sidebar inattiva in Classic e nessuna sezione Pro accessibile da URL.
    expect(getDefaultAdminSection(classic)).toBe('prenotazioni')
    expect(resolveAdminSectionFromPath('/admin/crm', classic)).toBe('prenotazioni')
    expect(resolveAdminSectionFromPath('/admin/servizio', classic)).toBe('prenotazioni')
  })

  it('Home dipende da features.home, non solo dalla sidebar', () => {
    // @admin-blindatura: shell-sidebar
    // Copre: se Home viene rimossa dal pacchetto, la shell parte da Prenotazioni.
    const proWithoutHome = { ...pro, home: false }

    expect(isAdminSectionEnabled('home', proWithoutHome)).toBe(false)
    expect(getDefaultAdminSection(proWithoutHome)).toBe('prenotazioni')
    expect(resolveAdminSectionFromPath('/admin/home', proWithoutHome)).toBe('prenotazioni')
    expect(resolveAdminSectionFromPath('/admin', proWithoutHome)).toBe('prenotazioni')
  })

  it('risolve sotto-route Admin per refresh e back browser', () => {
    // @admin-blindatura: shell-refresh-back
    // Copre: le sezioni Pro hanno URL stabili senza creare pagine admin separate.
    expect(resolveAdminSectionFromPath('/admin', pro)).toBe('home')
    expect(resolveAdminSectionFromPath('/admin/crm', pro)).toBe('crm')
    expect(resolveAdminSectionFromPath('/admin/servizio', pro)).toBe('servizio')
    expect(resolveAdminSectionFromPath('/admin/analytics', pro)).toBe('analytics')
    expect(resolveAdminSectionFromPath('/admin/prenotazioni', pro)).toBe('prenotazioni')
    expect(resolveAdminSectionFromPath('/admin/sezione-sconosciuta', pro)).toBe('home')
  })

  it('mantiene la tab dashboard indicata dall URL su refresh e back browser', () => {
    // @admin-blindatura: shell-refresh-back
    // Copre: le tab interne non ricadono su Calendario dopo reload.
    expect(resolveAdminRouteFromPath('/admin/calendario', pro)).toEqual({
      section: 'prenotazioni',
      dashboardTab: 'calendar',
      canonicalPath: '/admin/calendario',
    })
    expect(resolveAdminRouteFromPath('/admin/prenotazioni', pro)).toEqual({
      section: 'prenotazioni',
      dashboardTab: 'pending',
      canonicalPath: '/admin/prenotazioni',
    })
    expect(resolveAdminRouteFromPath('/admin/archivio', pro)).toEqual({
      section: 'prenotazioni',
      dashboardTab: 'archive',
      canonicalPath: '/admin/archivio',
    })
    expect(resolveAdminRouteFromPath('/admin/menu', pro)).toEqual({
      section: 'prenotazioni',
      dashboardTab: 'menu',
      canonicalPath: '/admin/menu',
    })
    expect(resolveAdminRouteFromPath('/admin/impostazioni', pro)).toEqual({
      section: 'prenotazioni',
      dashboardTab: 'settings-restaurant',
      canonicalPath: '/admin/impostazioni',
    })
  })

  it('risolve e genera path canonici per tutte le tab dashboard', () => {
    // @admin-blindatura: shell-refresh-back
    // Copre: ogni NavItem interno ha URL simmetrico per refresh/back.
    expect(getAdminDashboardTabPath('calendar')).toBe('/admin/calendario')
    expect(getAdminDashboardTabPath('pending')).toBe('/admin/prenotazioni')
    expect(getAdminDashboardTabPath('archive')).toBe('/admin/archivio')
    expect(getAdminDashboardTabPath('menu')).toBe('/admin/menu')
    expect(getAdminDashboardTabPath('settings-restaurant')).toBe('/admin/impostazioni')

    expect(resolveAdminDashboardTabFromPath('/admin/calendario')).toBe('calendar')
    expect(resolveAdminDashboardTabFromPath('/admin/prenotazioni')).toBe('pending')
    expect(resolveAdminDashboardTabFromPath('/admin/archivio')).toBe('archive')
    expect(resolveAdminDashboardTabFromPath('/admin/menu')).toBe('menu')
    expect(resolveAdminDashboardTabFromPath('/admin/impostazioni')).toBe('settings-restaurant')
    expect(resolveAdminDashboardTabFromPath('/admin/crm')).toBeNull()
  })

  it('genera path canonici per la cronologia browser', () => {
    // @admin-blindatura: shell-refresh-back
    // Copre: la Home resta /admin, la dashboard torna a Calendario, le sezioni Pro entrano nella history.
    expect(getAdminSectionPath('home')).toBe('/admin')
    expect(getAdminSectionPath('prenotazioni')).toBe('/admin/calendario')
    expect(getAdminSectionPath('crm')).toBe('/admin/crm')
    expect(getAdminSectionPath('servizio')).toBe('/admin/servizio')
    expect(getAdminSectionPath('analytics')).toBe('/admin/analytics')
  })

  it('logout procede solo dopo conferma del guard modifiche non salvate', async () => {
    // @admin-blindatura: shell-logout
    // Copre: uscire dall'admin non scarta modifiche senza conferma utente.
    const confirmNavigation = vi.fn<() => Promise<boolean>>().mockResolvedValueOnce(false)
    const logout = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)

    await runGuardedAdminLogout(confirmNavigation, logout)
    expect(confirmNavigation).toHaveBeenCalledOnce()
    expect(logout).not.toHaveBeenCalled()

    confirmNavigation.mockResolvedValueOnce(true)
    await runGuardedAdminLogout(confirmNavigation, logout)
    expect(logout).toHaveBeenCalledOnce()
  })
})
