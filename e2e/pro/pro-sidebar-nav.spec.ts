/**
 * // @admin-blindatura: shell-sidebar
 * // Copre: sidebar Pro, sezioni avanzate e ritorno alla dashboard prenotazioni.
 *
 * Test E2E — Admin Pro: sidebar visibile e navigazione tra sezioni.
 *
 * Verifica che la sidebar Pro contenga i bottoni di navigazione corretti
 * e che il click su ciascuno cambi la sezione visibile.
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

function sidebarNav(page: import('@playwright/test').Page) {
  return page.getByRole('navigation', { name: /navigazione principale/i })
}

test.describe('Admin Pro — Sidebar e navigazione', () => {
  test('sidebar contiene i bottoni delle 4 sezioni Pro', async ({ page }) => {
    await loginAsProAdmin(page)
    const nav = sidebarNav(page)
    await expect(nav.getByRole('button', { name: /home/i })).toBeVisible()
    await expect(nav.getByRole('button', { name: /prenotazioni/i })).toBeVisible()
    await expect(nav.getByRole('button', { name: /crm clienti/i })).toBeVisible()
    await expect(nav.getByRole('button', { name: /servizio/i })).toBeVisible()
    await expect(nav.getByRole('button', { name: /analytics/i })).toBeVisible()
  })

  test('click CRM Clienti cambia la sezione attiva', async ({ page }) => {
    await loginAsProAdmin(page)
    await sidebarNav(page).getByRole('button', { name: /crm clienti/i }).click()
    // La sezione CRM deve diventare visibile
    await expect(
      page.getByRole('heading', { name: /crm|clienti/i }).or(
        page.locator('[data-testid="crm-page"]')
      ).first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('click Servizio cambia la sezione attiva', async ({ page }) => {
    await loginAsProAdmin(page)
    await sidebarNav(page).getByRole('button', { name: /servizio/i }).click()
    await expect(
      page.getByRole('heading', { name: /servizio/i }).or(
        page.locator('[data-testid="servizio-page"]')
      ).first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('click Analytics cambia la sezione attiva', async ({ page }) => {
    await loginAsProAdmin(page)
    await sidebarNav(page).getByRole('button', { name: /analytics/i }).click()
    await expect(
      page.getByRole('heading', { name: /analytics/i }).or(
        page.locator('[data-testid="analytics-page"]')
      ).first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('click Prenotazioni dalla sidebar apre la dashboard classica', async ({ page }) => {
    await loginAsProAdmin(page)
    await sidebarNav(page).getByRole('button', { name: /prenotazioni/i }).click()
    // L'header con i 5 tab dell'admin classica deve diventare visibile
    await expect(page.locator('header nav')).toBeVisible({ timeout: 5000 })
  })
})
