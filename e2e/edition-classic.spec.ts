/**
 * Test E2E — Edition Classic: UI base senza feature Pro.
 *
 * Verifica che un tenant con edition='classic' veda solo la dashboard base:
 * nessuna sidebar, 5 tab operativi, nessuna icona walk-in, nessun bottone no-show.
 *
 * Richiede staging Supabase con:
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD → admin di un tenant classic
 *   E2E_CLASSIC_TENANT_SLUG → slug del tenant classic (es. 'test-classic')
 * Configurare in .env.local.test (vedi playwright.config.ts).
 */

import { test, expect } from '@playwright/test'

// SKIP: richiede staging Supabase configurato con tenant edition='classic'
test.skip(!process.env.E2E_ADMIN_EMAIL, 'richiede staging Supabase (E2E_ADMIN_EMAIL non impostato)')

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? ''
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ''

async function loginAsClassicAdmin(page: import('@playwright/test').Page) {
  await page.goto('/admin')
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL)
  await page.getByLabel(/password/i).fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /accedi|login/i }).click()
  // Attende che la dashboard sia visibile (Classic: sidebar assente)
  await expect(page.getByRole('navigation', { name: /navigazione principale/i })).not.toBeVisible({
    timeout: 10000,
  })
}

/**
 * Restituisce il locator dei NavItem dell'header AdminDashboard.
 * Scende nel <nav> del header per evitare ambiguità con bottoni omonimi
 * presenti in altri tab (es. "Calendario" in ArchiveTab su mobile).
 */
function dashboardNav(page: import('@playwright/test').Page) {
  return page.locator('header nav')
}

test.describe('Edition Classic — UI base', () => {
  test('nessuna sidebar visibile dopo login', async ({ page }) => {
    await loginAsClassicAdmin(page)
    await expect(page.getByRole('navigation', { name: /navigazione principale/i })).not.toBeVisible()
  })

  test('5 tab operativi visibili (Calendario, Prenotazioni, Archivio, Menu, Impostazioni)', async ({
    page,
  }) => {
    await loginAsClassicAdmin(page)
    const nav = dashboardNav(page)
    await expect(nav.getByRole('button', { name: /calendario/i })).toBeVisible()
    await expect(nav.getByRole('button', { name: /prenotazioni/i })).toBeVisible()
    await expect(nav.getByRole('button', { name: /archivio/i })).toBeVisible()
    await expect(nav.getByRole('button', { name: /menu/i })).toBeVisible()
    await expect(nav.getByRole('button', { name: /impostazioni/i })).toBeVisible()
  })

  test('click Calendario mostra la vista calendario', async ({ page }) => {
    await loginAsClassicAdmin(page)
    await dashboardNav(page).getByRole('button', { name: /calendario/i }).click()
    // Il calendario è visibile (cerca il contenitore del BookingCalendar)
    await expect(page.locator('[data-testid="booking-calendar"], .booking-calendar, [class*="calendar"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('nessuna icona walk-in nel calendario', async ({ page }) => {
    await loginAsClassicAdmin(page)
    await dashboardNav(page).getByRole('button', { name: /calendario/i }).click()
    // L'icona walk-in (gated da features.walkIn) non deve apparire
    await expect(page.locator('[aria-label*="walk"i], [title*="walk"i]')).not.toBeVisible()
  })

  test('nessun bottone no-show nel modal dettagli prenotazione', async ({ page }) => {
    await loginAsClassicAdmin(page)
    await dashboardNav(page).getByRole('button', { name: /prenotazioni/i }).click()
    // Clicca la prima prenotazione se esiste
    const firstBooking = page.locator('tr[role="row"], [data-testid="booking-row"]').first()
    if (await firstBooking.isVisible()) {
      await firstBooking.click()
      // Il bottone no-show (gated da features.noShow) non deve apparire
      await expect(page.getByRole('button', { name: /no.?show/i })).not.toBeVisible()
    }
  })
})
