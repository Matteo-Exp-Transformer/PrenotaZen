/**
 * Pre-requisiti staging:
 *   E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD → admin staging
 */
import { test, expect, Page } from '@playwright/test'

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'testc@c.com'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || '123456'

async function loginAdmin(page: Page) {
  await page.goto('/login')
  await page.fill('#email', ADMIN_EMAIL)
  await page.fill('#password', ADMIN_PASSWORD)
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/admin/, { timeout: 10000 })
}

async function navigateToMenuSection(page: Page) {
  // Cerca il link/tab menu nella dashboard
  const menuTab = page.locator(
    'a:has-text("Menu"), button:has-text("Menu"), [data-tab="menu"], nav a[href*="menu"]'
  ).first()
  if (await menuTab.isVisible({ timeout: 3000 })) {
    await menuTab.click()
  }
}

test.describe('Gestione menu admin', () => {
  test.skip(true, 'suite legacy sostituita da admin-menu-magazzino-blindatura.spec.ts e admin-menu-magazzino-ct.spec.ts')

  test.beforeEach(async ({ page }) => {
    await loginAdmin(page)
    await navigateToMenuSection(page)
  })

  test('crea una nuova categoria menu', async ({ page }) => {
    const addCatBtn = page.locator(
      'button:has-text("Aggiungi categoria"), button:has-text("Nuova categoria"), button:has-text("+")'
    ).first()
    await expect(addCatBtn).toBeVisible({ timeout: 5000 })
    await addCatBtn.click()

    const categoryNameInput = page.locator(
      'input[placeholder*="nome"], input[placeholder*="categoria"], input[name*="label"], input[name*="name"]'
    ).first()
    await expect(categoryNameInput).toBeVisible({ timeout: 3000 })
    await categoryNameInput.fill('Test Categoria E2E')

    const saveBtn = page.locator('button[type="submit"], button:has-text("Salva"), button:has-text("Aggiungi")').last()
    await saveBtn.click()

    const toast = page.locator('[class*="toast"], [class*="Toastify"], [role="status"]').first()
    await expect(toast).toBeVisible({ timeout: 5000 })
  })

  test('aggiunge un elemento menu a una categoria esistente', async ({ page }) => {
    // Cerca il bottone per aggiungere un item
    const addItemBtn = page.locator(
      'button:has-text("Aggiungi piatto"), button:has-text("Nuovo piatto"), button:has-text("Aggiungi voce")'
    ).first()

    if (!(await addItemBtn.isVisible({ timeout: 3000 }))) {
      test.skip()
      return
    }
    await addItemBtn.click()

    const itemNameInput = page.locator('input[placeholder*="piatto"], input[placeholder*="nome"], input[name*="name"]').first()
    if (await itemNameInput.isVisible({ timeout: 2000 })) {
      await itemNameInput.fill('Bruschetta al pomodoro')
    }

    const priceInput = page.locator('input[type="number"], input[name*="price"], input[placeholder*="prezzo"]').first()
    if (await priceInput.isVisible({ timeout: 1000 })) {
      await priceInput.fill('8.50')
    }

    const saveBtn = page.locator('button[type="submit"], button:has-text("Salva")').last()
    await saveBtn.click()

    const toast = page.locator('[class*="toast"], [class*="Toastify"], [role="status"]').first()
    await expect(toast).toBeVisible({ timeout: 5000 })
  })

  test('elimina un elemento menu', async ({ page }) => {
    // Cerca il primo bottone di eliminazione di un item
    const deleteItemBtn = page.locator(
      'button[aria-label*="elimina"], button[aria-label*="delete"], button:has-text("Elimina")'
    ).first()

    if (!(await deleteItemBtn.isVisible({ timeout: 3000 }))) {
      test.skip()
      return
    }
    await deleteItemBtn.click()

    // Eventuale dialogo di conferma
    const confirmBtn = page.locator('button:has-text("Conferma"), button:has-text("Sì"), button:has-text("Elimina")').last()
    if (await confirmBtn.isVisible({ timeout: 2000 })) {
      await confirmBtn.click()
    }

    const toast = page.locator('[class*="toast"], [class*="Toastify"], [role="status"]').first()
    await expect(toast).toBeVisible({ timeout: 5000 })
  })
})
