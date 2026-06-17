/**
 * // @admin-blindatura: home-analytics
 * // Copre: apertura Analytics Pro, heading, KPI/stati vuoti, navigazione periodo precedente/successivo e filtro turno.
 *
 * Test E2E — Admin Pro: analytics con sidebar Pro.
 *
 * Richiede staging Supabase con:
 *   E2E_PRO_ADMIN_EMAIL / E2E_PRO_ADMIN_PASSWORD → admin del tenant Pro
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
  await expect(page.getByRole('complementary', { name: /navigazione principale/i })).toBeVisible({
    timeout: 15000,
  })
}

function proSidebar(page: import('@playwright/test').Page) {
  return page.getByRole('complementary', { name: /navigazione principale/i })
}

test.describe('Admin Pro — Analytics', () => {
  test('apre Analytics e mostra KPI, periodi e filtro turno', async ({ page }) => {
    await loginAsProAdmin(page)

    await proSidebar(page).getByRole('button', { name: /analytics/i }).click()
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible({ timeout: 5000 })

    await expect(page.getByRole('button', { name: /settimana/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /mese/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /anno/i })).toBeVisible()

    await expect(page.getByRole('button', { name: /tutti/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /pranzo/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /cena/i })).toBeVisible()

    await expect(page.getByRole('button', { name: /periodo precedente/i })).toBeVisible()
    const nextPeriod = page.getByRole('button', { name: /periodo successivo/i })
    await expect(nextPeriod).toBeVisible()
    await expect(nextPeriod).toBeDisabled()

    await expect(page.getByText(/prenotazioni/i).first()).toBeVisible()
    await expect(page.getByText(/coperti totali/i).first()).toBeVisible()
    await expect(page.getByText(/tasso conferma/i).first()).toBeVisible()
    await expect(page.getByText(/media coperti\/booking/i).first()).toBeVisible()
    await expect(page.getByText(/tasso no-show/i).first()).toBeVisible()

    await page.getByRole('button', { name: /pranzo/i }).click()

    await page.getByRole('button', { name: /periodo precedente/i }).click()
    await expect(nextPeriod).toBeEnabled()
    await nextPeriod.click()

    await expect(page.getByRole('button', { name: /tutti/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /cena/i })).toBeVisible()
  })
})
