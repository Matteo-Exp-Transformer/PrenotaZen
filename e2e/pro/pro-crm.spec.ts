/**
 * Test E2E — Admin Pro: sezione CRM mostra la lista clienti.
 *
 * Verifica che la sezione CRM (gated da features.crm) mostri almeno
 * 3 clienti nel DB staging del tenant Pro.
 *
 * Richiede staging Supabase con:
 *   E2E_PRO_ADMIN_EMAIL / E2E_PRO_ADMIN_PASSWORD → admin del tenant Pro
 *   Tenant Pro (ID 11111111-...) deve avere almeno 3 clienti in tabella `customers`
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

test.describe('Admin Pro — CRM Clienti', () => {
  test('sezione CRM è accessibile dalla sidebar', async ({ page }) => {
    await loginAsProAdmin(page)
    await page.getByRole('navigation', { name: /navigazione principale/i })
      .getByRole('button', { name: /crm clienti/i })
      .click()
    // La pagina CRM deve caricarsi senza errori
    await expect(
      page.getByRole('heading', { name: /crm|clienti/i }).or(
        page.locator('[data-testid="crm-page"]')
      ).first()
    ).toBeVisible({ timeout: 5000 })
  })

  test('lista clienti contiene almeno 3 clienti nel DB staging', async ({ page }) => {
    await loginAsProAdmin(page)
    await page.getByRole('navigation', { name: /navigazione principale/i })
      .getByRole('button', { name: /crm clienti/i })
      .click()

    // Attende il caricamento della lista (può richiedere una chiamata API)
    await page.waitForTimeout(2000)

    // Le righe clienti devono essere almeno 3 (dati staging pre-popolati)
    const customerRows = page.locator(
      'tr[role="row"]:not(:first-child), [data-testid="customer-row"], [class*="customer-row"]',
    )
    await expect(customerRows.first()).toBeVisible({ timeout: 5000 })
    const count = await customerRows.count()
    expect(count).toBeGreaterThanOrEqual(3)
  })

  test('admin Classic NON può accedere al CRM (RLS)', async ({ page }) => {
    // Questo test è informativo: Classic non vede il bottone CRM nella sidebar
    // (la sidebar stessa non esiste per Classic). Verificato in edition-classic-data-protection.spec.ts.
    // Incluso qui come reminder documentale — non fallisce mai.
    test.skip(true, 'controllo RLS Classic già coperto da edition-classic-data-protection.spec.ts')
  })
})
