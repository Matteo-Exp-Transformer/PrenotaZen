/**
 * @admin-blindatura: shell-login
 * Copre: login Pro e presenza della sidebar con role complementary.
 *
 * Test E2E — Admin Pro: login e redirect alla dashboard con sidebar.
 *
 * Verifica che un admin Pro possa accedere e che la sidebar sia visibile
 * immediatamente dopo il login (differenzia Pro da Classic).
 *
 * Richiede staging Supabase con:
 *   E2E_PRO_ADMIN_EMAIL / E2E_PRO_ADMIN_PASSWORD → admin di un tenant pro
 * Configurare in .env.local.test (vedi playwright.config.ts).
 */

import { test, expect } from '@playwright/test'

test.skip(!process.env.E2E_PRO_ADMIN_EMAIL, 'richiede staging Pro configurato (E2E_PRO_ADMIN_EMAIL non impostato)')

const PRO_EMAIL = process.env.E2E_PRO_ADMIN_EMAIL ?? ''
const PRO_PASSWORD = process.env.E2E_PRO_ADMIN_PASSWORD ?? ''

test.describe('Admin Pro — Login', () => {
  test('login come admin Pro reindirizza alla dashboard con sidebar', async ({ page }) => {
    await page.goto('/admin')
    await page.getByLabel(/email/i).fill(PRO_EMAIL)
    await page.getByLabel(/password/i).fill(PRO_PASSWORD)
    await page.getByRole('button', { name: /accedi|login/i }).click()

    // Pro ha la sidebar — la sua presenza conferma edition Pro attiva
    await expect(page.getByRole('complementary', { name: /navigazione principale/i })).toBeVisible({
      timeout: 15000,
    })
  })

  test('senza sessione attiva, /admin reindirizza a /login', async ({ page }) => {
    await page.goto('/admin')
    // Deve atterrare sulla pagina login senza credenziali
    await expect(page.getByLabel(/email/i)).toBeVisible({ timeout: 5000 })
  })

  test('credenziali errate mostrano un errore', async ({ page }) => {
    await page.goto('/admin')
    await page.getByLabel(/email/i).fill(PRO_EMAIL)
    await page.getByLabel(/password/i).fill('password-sbagliata-xyz')
    await page.getByRole('button', { name: /accedi|login/i }).click()
    // Deve comparire un toast o messaggio di errore
    await expect(
      page.getByRole('alert').or(page.locator('[class*="toast"], [class*="error"]')).first()
    ).toBeVisible({ timeout: 5000 })
  })
})
