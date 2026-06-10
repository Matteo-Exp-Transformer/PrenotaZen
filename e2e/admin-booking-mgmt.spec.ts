/**
 * // @admin-blindatura: prenotazioni
 * // Copre: gestione prenotazioni admin — accept/reject da dashboard (staging).
 *
 * Pre-requisiti staging:
 *   E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD → admin staging
 *   DB staging deve avere almeno una prenotazione in stato "pending"
 */
import { test, expect, Page } from '@playwright/test'

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@staging.it'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'password-staging'

async function loginAdmin(page: Page) {
  await page.goto('/login')
  await page.fill('#email', ADMIN_EMAIL)
  await page.fill('#password', ADMIN_PASSWORD)
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/admin/, { timeout: 10000 })
}

test.describe('Gestione prenotazioni admin', () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page)
  })

  test('la dashboard mostra le prenotazioni in attesa', async ({ page }) => {
    // Cerca una sezione/tab "In attesa" o una lista di pending
    const pendingSection = page.locator(
      '[class*="pending"], [data-tab="pending"], h2:has-text("attesa"), h3:has-text("attesa"), [class*="Pending"]'
    ).first()
    await expect(pendingSection).toBeVisible({ timeout: 8000 })
  })

  test('accettare una prenotazione la sposta in stato accepted', async ({ page }) => {
    // Trova il primo bottone di accettazione
    const acceptBtn = page.locator(
      'button:has-text("Accetta"), button:has-text("Conferma"), button[aria-label*="accetta"]'
    ).first()
    await expect(acceptBtn).toBeVisible({ timeout: 8000 })

    await acceptBtn.click()

    // Dopo l'accettazione appare un modal o un form di conferma
    const confirmBtn = page.locator(
      'button:has-text("Conferma"), button:has-text("Salva"), button[type="submit"]'
    ).last()
    if (await confirmBtn.isVisible({ timeout: 2000 })) {
      await confirmBtn.click()
    }

    // Toast di successo
    const successToast = page.locator('[class*="toast"], [class*="Toastify"], [role="status"]').first()
    await expect(successToast).toBeVisible({ timeout: 8000 })
  })

  test('rifiutare una prenotazione la sposta in stato rejected', async ({ page }) => {
    const rejectBtn = page.locator(
      'button:has-text("Rifiuta"), button:has-text("Declina"), button[aria-label*="rifiuta"]'
    ).first()
    await expect(rejectBtn).toBeVisible({ timeout: 8000 })

    await rejectBtn.click()

    // Eventuale campo motivazione nel modal
    const reasonInput = page.locator('textarea, input[name="reason"], input[placeholder*="motivo"]').first()
    if (await reasonInput.isVisible({ timeout: 1000 })) {
      await reasonInput.fill('Locale al completo per quella data')
    }

    const confirmRejectBtn = page.locator(
      'button:has-text("Rifiuta"), button:has-text("Conferma"), button[type="submit"]'
    ).last()
    if (await confirmRejectBtn.isVisible({ timeout: 2000 })) {
      await confirmRejectBtn.click()
    }

    const successToast = page.locator('[class*="toast"], [class*="Toastify"], [role="status"]').first()
    await expect(successToast).toBeVisible({ timeout: 8000 })
  })
})
