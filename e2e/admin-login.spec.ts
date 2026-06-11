/**
 * // @admin-blindatura: shell-login
 * // Copre: redirect ospite, login admin e logout base.
 *
 * Pre-requisiti staging:
 *   E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD → admin registrato nel DB staging
 */
import { test, expect } from '@playwright/test'

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@staging.it'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'password-staging'

test.describe('Login admin', () => {
  test('/ reindirizza a /login se non autenticati', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('/admin reindirizza a /login senza sessione attiva', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })

  test('login OK naviga a /admin', async ({ page }) => {
    await page.goto('/login')

    await page.fill('#email', ADMIN_EMAIL)
    await page.fill('#password', ADMIN_PASSWORD)
    await page.locator('button[type="submit"]').click()

    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 })
  })

  test('credenziali errate mostrano toast di errore', async ({ page }) => {
    await page.goto('/login')

    await page.fill('#email', 'sbagliato@test.it')
    await page.fill('#password', 'password-sbagliata')
    await page.locator('button[type="submit"]').click()

    await expect(
      page.getByText(/credenziali non valide|errore imprevisto/i).or(page.locator('.Toastify__toast')),
    ).toBeVisible({ timeout: 10000 })
  })

  test('logout redirige a /login', async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('#email', ADMIN_EMAIL)
    await page.fill('#password', ADMIN_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 })

    // Logout — cerca bottone di logout nella dashboard
    const logoutBtn = page.getByRole('button', { name: /log-?out|esci/i }).first()
    await logoutBtn.click()

    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })
})
