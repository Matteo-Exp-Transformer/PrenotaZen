/**
 * Test E2E — Admin Pro: sezione Home (AdminHomePage) visibile e navigabile.
 *
 * La sezione Home è l'entry point default per Pro/Enterprise.
 * AdminDashboard viene montata con bodyOverride={<AdminHomePage />},
 * quindi Header e 5 NavItem restano visibili anche in Home.
 *
 * Richiede staging Supabase con:
 *   E2E_PRO_ADMIN_EMAIL / E2E_PRO_ADMIN_PASSWORD → admin di un tenant pro
 * Configurare in .env.local.test (vedi playwright.config.ts).
 */

import { test, expect } from '@playwright/test'

test.skip(!process.env.E2E_PRO_ADMIN_EMAIL, 'richiede staging Pro configurato (E2E_PRO_ADMIN_EMAIL non impostato)')

const PRO_EMAIL = process.env.E2E_PRO_ADMIN_EMAIL ?? ''
const PRO_PASSWORD = process.env.E2E_PRO_ADMIN_PASSWORD ?? ''

async function loginAsProAdmin(page: import('@playwright/test').Page) {
  await page.goto('/admin')
  await page.getByLabel(/email/i).fill(PRO_EMAIL)
  await page.getByLabel(/password/i).fill(PRO_PASSWORD)
  await page.getByRole('button', { name: /accedi|login/i }).click()
  await expect(page.getByRole('navigation', { name: /navigazione principale/i })).toBeVisible({
    timeout: 15000,
  })
}

test.describe('Admin Pro — Home page', () => {
  test('dopo login la sezione Home è quella attiva di default', async ({ page }) => {
    await loginAsProAdmin(page)
    // Pro default section = 'home' → AdminHomePage è montata come bodyOverride
    await expect(
      page.getByRole('heading', { name: /home|benvenuto|dashboard/i }).or(
        page.locator('[data-testid="admin-home-page"]')
      ).first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('da Home, click sidebar "Home" non produce errori', async ({ page }) => {
    await loginAsProAdmin(page)
    const sidebar = page.getByRole('navigation', { name: /navigazione principale/i })
    // Clicca Home dalla sidebar (dovrebbe essere già attivo, ma il click deve essere idempotente)
    await sidebar.getByRole('button', { name: /home/i }).click()
    await expect(sidebar).toBeVisible({ timeout: 3000 })
  })

  test('da Home, click NavItem Calendario apre la dashboard prenotazioni', async ({ page }) => {
    await loginAsProAdmin(page)
    // L'header con i 5 NavItem è sempre visibile anche in Home (bodyOverride non nasconde l'header)
    const headerNav = page.locator('header nav')
    await expect(headerNav).toBeVisible({ timeout: 5000 })
    // Cliccando un NavItem da Home, la section passa a 'prenotazioni'
    await headerNav.getByRole('button', { name: /calendario/i }).click()
    await expect(
      page.locator('[data-testid="booking-calendar"], .booking-calendar, [class*="calendar"]').first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('sidebar rimane visibile durante la navigazione tra sezioni', async ({ page }) => {
    await loginAsProAdmin(page)
    const sidebar = page.getByRole('navigation', { name: /navigazione principale/i })

    // Naviga CRM → Servizio → Home e verifica che la sidebar rimanga
    await sidebar.getByRole('button', { name: /crm clienti/i }).click()
    await expect(sidebar).toBeVisible({ timeout: 3000 })

    await sidebar.getByRole('button', { name: /servizio/i }).click()
    await expect(sidebar).toBeVisible({ timeout: 3000 })

    await sidebar.getByRole('button', { name: /home/i }).click()
    await expect(sidebar).toBeVisible({ timeout: 3000 })
  })
})
