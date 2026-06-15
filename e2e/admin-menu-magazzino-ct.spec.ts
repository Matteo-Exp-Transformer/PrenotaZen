/**
 * @admin-blindatura: menu-magazzino-ct
 * Controtest «rompi» toggle disponibilità magazzino (FU-M3-QA-CT):
 * doppio click, refresh con item spento, interazione form durante mutation pending.
 *
 * Pre-requisiti staging (.env.local.test):
 *   E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_TENANT_SLUG, E2E_SUPABASE_SERVICE_KEY
 */
import { test, expect, type Page } from '@playwright/test'
import {
  E2E_MENU_PREFIX,
  deleteMenuE2eData,
  getMenuItemAvailability,
  getTenantIdBySlug,
  setMenuItemAvailability,
  upsertMenuCategory,
  upsertMenuItem,
} from './helpers/supabaseStaging'

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? ''
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ''
const TENANT_SLUG = process.env.E2E_TENANT_SLUG ?? ''
const SERVICE_KEY = process.env.E2E_SUPABASE_SERVICE_KEY ?? ''

const hasE2eCreds = Boolean(ADMIN_EMAIL && ADMIN_PASSWORD && TENANT_SLUG && SERVICE_KEY)

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function byExactText(value: string): RegExp {
  return new RegExp(`^${escapeRegExp(value)}$`, 'i')
}

async function loginAdmin(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL)
  await page.getByLabel(/password/i).fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /accedi|login/i }).click()
  await expect(page).toHaveURL(/\/admin/, { timeout: 15000 })
}

async function goToAdminMenu(page: Page) {
  await page.goto('/admin/menu', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/admin\/menu/)
  await expect(page.getByRole('heading', { name: /^Menu$/i })).toBeVisible({ timeout: 15000 })
}

function categoryHeader(page: Page, categoryLabel: string) {
  return page
    .locator('[role="button"][aria-expanded][aria-controls]')
    .filter({ has: page.getByRole('heading', { name: byExactText(categoryLabel) }) })
    .first()
}

async function openCategory(page: Page, categoryLabel: string) {
  const header = categoryHeader(page, categoryLabel)
  await expect(header).toBeVisible({ timeout: 15000 })
  if ((await header.getAttribute('aria-expanded')) !== 'true') {
    await header.click()
  }
  await expect(header).toHaveAttribute('aria-expanded', 'true')
  const contentId = await header.getAttribute('aria-controls')
  expect(contentId).toBeTruthy()
  return page.locator(`[id="${contentId!.replace(/"/g, '\\"')}"]`)
}

test.describe('Admin Menu magazzino — controtest toggle CT', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(!hasE2eCreds, 'richiede credenziali staging in .env.local.test')

  test('doppio click rapido, refresh coerente, form bloccato durante pending @admin-blindatura: menu-magazzino-ct', async ({
    page,
  }) => {
    test.setTimeout(120000)
    await page.setViewportSize({ width: 1280, height: 800 })

    const tenantId = await getTenantIdBySlug(TENANT_SLUG)
    const categoryKey = 'e2e_m3_ct_toggle'
    const categoryLabel = `${E2E_MENU_PREFIX}CT Cat`.slice(0, 24)
    const itemName = `${E2E_MENU_PREFIX}CT Item`.slice(0, 24)

    let itemId = ''

    try {
      await deleteMenuE2eData(tenantId, categoryKey)
      await upsertMenuCategory({
        tenantId,
        key: categoryKey,
        label: categoryLabel,
        isAvailable: true,
      })
      const item = await upsertMenuItem({
        tenantId,
        categoryKey,
        name: itemName,
        isAvailable: true,
      })
      itemId = item.id

      await loginAdmin(page)
      await goToAdminMenu(page)

      const content = await openCategory(page, categoryLabel)
      const hideButton = content.getByRole('button', {
        name: byExactText(`Nascondi ${itemName} in Prenota e Menu QR`),
      })
      await expect(hideButton).toBeVisible({ timeout: 15000 })
      await expect(hideButton).toBeEnabled()

      // 1) Doppio click rapido — stato finale coerente (non flip-flop visibile)
      await hideButton.dblclick({ delay: 50 })
      await expect
        .poll(() => getMenuItemAvailability(itemId), { timeout: 15000 })
        .toBe(false)
      await expect(
        content.getByRole('button', {
          name: byExactText(`Mostra ${itemName} in Prenota e Menu QR`),
        }),
      ).toBeVisible()

      // 2) Refresh con piatto disabilitato — admin mostra stato spento
      await page.reload({ waitUntil: 'domcontentloaded' })
      await goToAdminMenu(page)
      const contentAfterReload = await openCategory(page, categoryLabel)
      await expect
        .poll(() => getMenuItemAvailability(itemId), { timeout: 10000 })
        .toBe(false)
      await expect(
        contentAfterReload.getByRole('button', {
          name: byExactText(`Mostra ${itemName} in Prenota e Menu QR`),
        }),
      ).toBeVisible()

      // Ripristina visibilità per il test pending
      await contentAfterReload
        .getByRole('button', {
          name: byExactText(`Mostra ${itemName} in Prenota e Menu QR`),
        })
        .click()
      await expect.poll(() => getMenuItemAvailability(itemId), { timeout: 10000 }).toBe(true)

      const hideAgain = contentAfterReload.getByRole('button', {
        name: byExactText(`Nascondi ${itemName} in Prenota e Menu QR`),
      })

      // 3) Durante mutation pending il toggle è disabilitato; edit prodotto non parte
      await page.route('**/rest/v1/menu_items*', async (route) => {
        if (route.request().method() === 'PATCH') {
          await new Promise((resolve) => setTimeout(resolve, 1200))
        }
        await route.continue()
      })

      const hidePromise = hideAgain.click()
      await expect(hideAgain).toBeDisabled({ timeout: 5000 })

      // Tentativo altra interazione (modifica prodotti) durante mutation pending
      await page.getByRole('button', { name: /Crea \/ Modifica Prodotto/i }).click()

      await hidePromise
      await expect.poll(() => getMenuItemAvailability(itemId), { timeout: 15000 }).toBe(false)
      await expect(
        contentAfterReload.getByRole('button', {
          name: byExactText(`Mostra ${itemName} in Prenota e Menu QR`),
        }),
      ).toBeVisible()
    } finally {
      if (itemId) await setMenuItemAvailability(tenantId, itemId, true).catch(() => {})
      await deleteMenuE2eData(tenantId, categoryKey).catch(() => {})
    }
  })
})
