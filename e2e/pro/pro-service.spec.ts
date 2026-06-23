/**
 * @admin-blindatura: servizio
 * Copre: accesso Pro a Servizio da sidebar, controlli principali della pagina e ritorno alla dashboard.
 *
 * Test E2E — Admin Pro: smoke Servizio senza scritture DB.
 *
 * Verifica che la sezione Servizio si apra dalla sidebar Pro, mostri il titolo
 * e i controlli principali, e che il pulsante X riporti alla dashboard.
 *
 * Richiede staging Supabase con:
 *   E2E_PRO_ADMIN_EMAIL / E2E_PRO_ADMIN_PASSWORD → admin di un tenant pro
 * Configurare in .env.local.test (vedi playwright.config.ts).
 */

import { test, expect, type Page } from '@playwright/test'

test.skip(!process.env.E2E_PRO_ADMIN_EMAIL, 'richiede staging Pro configurato (E2E_PRO_ADMIN_EMAIL non impostato)')

const PRO_EMAIL = process.env.E2E_PRO_ADMIN_EMAIL ?? ''
const PRO_PASSWORD = process.env.E2E_PRO_ADMIN_PASSWORD ?? ''

function sidebarNav(page: Page) {
  return page.getByRole('complementary', { name: /navigazione principale/i })
}

function collectBrowserErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (/Failed to load resource|favicon/i.test(text)) return
    errors.push(text)
  })
  return errors
}

async function loginAsProAdmin(page: Page) {
  await page.goto('/admin')
  await page.getByLabel(/email/i).fill(PRO_EMAIL)
  await page.getByLabel(/password/i).fill(PRO_PASSWORD)
  await page.getByRole('button', { name: /accedi|login/i }).click()
  await expect(sidebarNav(page)).toBeVisible({ timeout: 15000 })
}

test.describe('Admin Pro — Servizio', () => {
  test('Intervallo di arrivo resta raggiungibile nei tre viewport', async ({ page }) => {
    await loginAsProAdmin(page)
    await sidebarNav(page).getByRole('button', { name: /servizio/i }).click()
    await expect(page.getByRole('heading', { name: /^Fasce orarie$/i })).toBeVisible({ timeout: 10000 })

    for (const viewport of [
      { width: 375, height: 812 },
      { width: 834, height: 1194 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(viewport)
      await page.getByRole('button', { name: /^Modifica /i }).first().click()
      const field = page.getByLabel('Intervallo di arrivo')
      await expect(field).toBeVisible()
      await expect(field).toHaveValue(/15|30|60|custom/)
      const box = await field.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1)
      await page.getByRole('button', { name: /^Annulla$/i }).click()
    }
  })

  test('smoke Servizio dalla sidebar e ritorno alla dashboard', async ({ page }) => {
    const errors = collectBrowserErrors(page)

    await loginAsProAdmin(page)
    await sidebarNav(page).getByRole('button', { name: /servizio/i }).click()

    await expect(page).toHaveURL(/\/admin\/servizio/, { timeout: 10000 })
    await expect(page.getByRole('heading', { name: /^Servizio$/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /^Lista$/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /^Mappa$/i })).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: /^Mappa$/i }).click()
    await expect(page.getByRole('button', { name: /^Nuova sala$/i })).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: /torna alla dashboard/i }).click()
    await expect(page).toHaveURL(/\/admin\/(calendario|prenotazioni)/, { timeout: 10000 })
    await expect(page.locator('header nav')).toBeVisible({ timeout: 10000 })

    expect(errors, 'errori console/browser').toEqual([])
  })
})
