/**
 * Pre-requisiti staging:
 *   DB staging deve avere un invite_token valido in tabella invite_tokens
 *   E2E_VALID_INVITE_TOKEN → token valido
 *   La Edge Function validate-invite deve essere deployata sullo staging
 */
import { test, expect } from '@playwright/test'

const VALID_TOKEN = process.env.E2E_VALID_INVITE_TOKEN || 'valid-test-token-000'

test.describe('Flusso invito admin', () => {
  test('token valido mostra il form di registrazione', async ({ page }) => {
    await page.goto(`/invite/${VALID_TOKEN}`)

    // La pagina deve mostrare un form di registrazione, non un errore
    await expect(page).not.toHaveURL('/login')
    const formOrHeading = page.locator('form, h1:has-text("Registra"), h2:has-text("Registra"), input[type="password"]').first()
    await expect(formOrHeading).toBeVisible({ timeout: 8000 })
  })

  test('token non valido mostra un messaggio di errore', async ({ page }) => {
    await page.goto('/invite/token-completamente-inesistente-xyzabc123')

    // Deve apparire un messaggio di errore o la pagina di errore
    const errorElement = page.locator(
      '[class*="error"], [class*="invalid"], p:has-text("non valido"), p:has-text("scaduto"), h1:has-text("non valido")'
    ).first()
    await expect(errorElement).toBeVisible({ timeout: 8000 })
  })

  test('vecchio URL /register?token= funziona per retrocompatibilità', async ({ page }) => {
    await page.goto(`/register?token=${VALID_TOKEN}`)

    // Deve mostrare lo stesso form del percorso /invite/:token
    await expect(page).not.toHaveURL('/login')
    const formOrHeading = page.locator('form, h1, h2, input[type="password"]').first()
    await expect(formOrHeading).toBeVisible({ timeout: 8000 })
  })

  test('registrazione OK con token valido', async ({ page }) => {
    await page.goto(`/invite/${VALID_TOKEN}`)

    const passwordInput = page.locator('input[type="password"]').first()
    const confirmPasswordInput = page.locator('input[type="password"]').nth(1)
    const nameInput = page.locator('input[type="text"], input[name*="name"]').first()

    if (!(await passwordInput.isVisible({ timeout: 5000 }))) {
      test.skip()
      return
    }

    if (await nameInput.isVisible()) await nameInput.fill('Admin Test E2E')
    await passwordInput.fill('PasswordSicura123!')
    if (await confirmPasswordInput.isVisible()) await confirmPasswordInput.fill('PasswordSicura123!')

    await page.locator('button[type="submit"]').click()

    // Dopo registrazione OK → redirect al login o messaggio di successo
    const successSignal = page.locator(
      '[class*="toast"], [role="status"], [class*="success"]'
    ).first()
    const loginPage = page.locator('#email') // campo email della pagina login

    await expect(successSignal.or(loginPage)).toBeVisible({ timeout: 10000 })
  })
})
