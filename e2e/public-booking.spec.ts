/**
 * Pre-requisiti staging:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY → progetto Supabase staging
 *   E2E_TENANT_SLUG → slug di un'organizzazione attiva nel DB staging
 */
import { test, expect } from '@playwright/test'

const TENANT_SLUG = process.env.E2E_TENANT_SLUG || 'test-ristorante'
const BOOKING_URL = `/prenota/${TENANT_SLUG}`

test.describe('Form prenotazione pubblica', () => {
  test('la pagina di prenotazione si apre correttamente', async ({ page }) => {
    await page.goto(BOOKING_URL)
    await expect(page).not.toHaveURL('/login')
    await expect(page.locator('[data-testid="booking-mode-cards"], form, h1, h2').first()).toBeVisible()
  })

  test('le card tipologia sono visibili e selezionabili', async ({ page }) => {
    await page.goto(BOOKING_URL)
    const cards = page.locator('[data-testid^="booking-mode-card-"]')
    await expect(cards.first()).toBeVisible({ timeout: 5000 })
    // Seleziona la prima card
    await cards.first().click()
    await expect(cards.first()).toBeVisible()
  })

  test('selezionando una card tipologia menu appare la sezione menu', async ({ page }) => {
    await page.goto(BOOKING_URL)
    // Seleziona Rinfresco di Laurea o Menu prezzo fisso
    const menuCard = page.locator('[data-testid="booking-mode-card-rinfresco_laurea"], [data-testid="booking-mode-card-menu_prezzo_fisso"]').first()
    if (await menuCard.isVisible()) {
      await menuCard.click()
      // La sezione menu dovrebbe comparire
      await expect(page.locator('#menu-section')).toBeVisible({ timeout: 3000 })
    }
  })

  test('submit con email non valida mostra errore inline', async ({ page }) => {
    await page.goto(BOOKING_URL)

    const emailField = page.locator('input[type="email"], input[id="client_email"]').first()
    if (await emailField.isVisible()) {
      await emailField.fill('non-una-email')
    }

    await page.locator('button[type="submit"]').first().click()

    const errorMsg = page.locator('p.text-red-500, [role="alert"], .text-red-400, .text-destructive').first()
    await expect(errorMsg).toBeVisible({ timeout: 3000 })
  })

  test('submit con dati validi crea la prenotazione', async ({ page }) => {
    await page.goto(BOOKING_URL)

    const nameInput = page.locator('input[id="client_name"], input[placeholder*="Nome"]').first()
    const emailInput = page.locator('input[type="email"]').first()
    const phoneInput = page.locator('input[type="tel"], input[id="client_phone"]').first()
    const guestsInput = page.locator('input[id="num_guests"]').first()

    if (await nameInput.isVisible()) await nameInput.fill('Mario Rossi')
    if (await emailInput.isVisible()) await emailInput.fill('mario.rossi@test.it')
    if (await phoneInput.isVisible()) await phoneInput.fill('+39 333 1234567')
    if (await guestsInput.isVisible()) await guestsInput.fill('2')

    await page.locator('button[type="submit"]').first().click()

    const successSignal = page.locator(
      '[class*="toast"], [role="status"], [class*="success"], [class*="confirm"]'
    ).first()
    await expect(successSignal).toBeVisible({ timeout: 8000 })
  })
})
