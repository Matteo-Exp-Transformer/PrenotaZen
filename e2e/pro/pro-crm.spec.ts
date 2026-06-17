/**
 * // @admin-blindatura: crm
 * // Copre: apertura CRM Pro, tab Rubrica clienti, tab Personalizza email, sezioni Email automatiche / Email personalizzate e stati vuoti stabili.
 *
 * Test E2E — Admin Pro: CRM con sidebar Pro e tab interne.
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

test.describe('Admin Pro — CRM Clienti', () => {
  test('apre CRM, passa tra Rubrica e Personalizza email e mostra stati stabili', async ({ page }) => {
    await loginAsProAdmin(page)

    await proSidebar(page).getByRole('button', { name: /crm clienti/i }).click()
    await expect(page.getByRole('heading', { name: /crm clienti/i })).toBeVisible({ timeout: 5000 })

    await expect(page.getByRole('button', { name: /rubrica clienti/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /personalizza email/i })).toBeVisible()

    await page.getByRole('button', { name: /rubrica clienti/i }).click()
    await expect(page.getByLabel(/cerca/i)).toBeVisible()
    await expect(page.getByLabel(/filtra data ultima prenotazione/i)).toBeVisible()
    await expect(
      page.getByRole('table').or(page.getByText(/nessun cliente trovato\./i)).first(),
    ).toBeVisible()

    await page.getByRole('button', { name: /personalizza email/i }).click()
    await expect(page.getByRole('heading', { name: /email automatiche/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /email personalizzate/i })).toBeVisible()
    await expect(page.getByText(/accetta prenotazione/i)).toBeVisible()
    await expect(page.getByText(/rifiuta prenotazione/i)).toBeVisible()
    await expect(
      page
        .getByText(/nessuna campagna ancora/i)
        .or(page.getByRole('button', { name: /\+ nuova campagna/i }))
        .or(page.getByRole('button', { name: /invia ora/i }))
        .first(),
    ).toBeVisible()
  })
})
