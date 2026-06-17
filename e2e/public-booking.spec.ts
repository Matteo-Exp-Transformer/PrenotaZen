/**
 * Pre-requisiti staging:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY → progetto Supabase staging
 *   E2E_TENANT_SLUG → slug di un'organizzazione attiva nel DB staging (default: 'test')
 */
import { test, expect, type Page } from '@playwright/test'

const TENANT_SLUG = process.env.E2E_TENANT_SLUG || 'test'
const BOOKING_URL = `/prenota/${TENANT_SLUG}`

/** ≥1256px: submit nel form; <1256px: submit nel riepilogo (`form="booking-request-form"`). */
async function clickInviaPrenotazione(page: Page) {
  const viewport = page.viewportSize()
  const useDesktopSubmit = (viewport?.width ?? 1280) >= 1256
  const submit = useDesktopSubmit
    ? page.locator('#booking-request-form button.booking-cross-shine-btn[type="submit"]')
    : page.locator('button[type="submit"][form="booking-request-form"]')

  await submit.scrollIntoViewIfNeeded()
  await expect(submit).toBeVisible({ timeout: 8000 })
  await submit.click()
}

async function fillPublicBookingBasics(page: Page) {
  const cards = page.locator('[data-testid^="booking-mode-card-"]')
  if (await cards.first().isVisible().catch(() => false)) {
    await cards.first().click()
  }

  const nameInput = page.locator('#client_name-control')
  await expect(nameInput).toBeVisible({ timeout: 8000 })
  await nameInput.fill('Mario Rossi E2E')
  await page.locator('#client_email-control').fill('mario.rossi@test.it')
  await page.locator('#client_phone-control').fill('+39 333 1234567')
  await page.locator('#num_guests-control').fill('2')

  const privacy = page.locator('#privacy-consent-dietary-input')
  if (await privacy.isVisible().catch(() => false)) {
    await privacy.check()
  }
}

test.describe('Form prenotazione pubblica', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('la pagina di prenotazione si apre correttamente', async ({ page }) => {
    await page.goto(BOOKING_URL)
    await expect(page).not.toHaveURL('/login')
    await expect(page.locator('[data-testid="booking-mode-cards"], form, h1, h2').first()).toBeVisible()
  })

  test('le card tipologia sono visibili e selezionabili', async ({ page }) => {
    await page.goto(BOOKING_URL)
    const cards = page.locator('[data-testid^="booking-mode-card-"]')
    await expect(cards.first()).toBeVisible({ timeout: 5000 })
    await cards.first().click()
    await expect(cards.first()).toBeVisible()
  })

  test('selezionando una card tipologia menu appare la sezione menu', async ({ page }) => {
    await page.goto(BOOKING_URL)
    const menuCard = page
      .locator(
        '[data-testid="booking-mode-card-rinfresco_laurea"], [data-testid="booking-mode-card-menu_prezzo_fisso"]',
      )
      .first()
    if (await menuCard.isVisible()) {
      await menuCard.click()
      await expect(page.locator('#menu-section')).toBeVisible({ timeout: 3000 })
    }
  })

  test('submit con email non valida mostra errore inline', async ({ page }) => {
    await page.goto(BOOKING_URL)
    await fillPublicBookingBasics(page)
    await page.locator('#client_email-control').fill('non-una-email')
    await clickInviaPrenotazione(page)

    const errorMsg = page
      .locator('#client_email-error, p.text-red-500, [role="alert"], .text-destructive')
      .first()
    await expect(errorMsg).toBeVisible({ timeout: 5000 })
  })

  test('submit con dati validi crea la prenotazione', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto(BOOKING_URL)
    await fillPublicBookingBasics(page)
    await clickInviaPrenotazione(page)

    const successSignal = page
      .locator('text=/richiesta.*inviata|prenotazione.*inviata/i')
      .or(page.locator('[class*="toast"], [role="status"], [class*="success"]'))
      .first()
    await expect(successSignal).toBeVisible({ timeout: 12000 })
  })
})
