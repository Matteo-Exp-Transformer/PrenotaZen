/**
 * @admin-blindatura: menu-magazzino
 * Copre: toggle disponibilità magazzino in browser (Admin), propagazione Menu QR,
 * restore finale is_available e QA responsive 375/834/1280.
 *
 * Pre-requisiti staging (.env.local.test):
 *   E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_TENANT_SLUG, E2E_SUPABASE_SERVICE_KEY
 */
import { test, expect, type Locator, type Page } from '@playwright/test'
import {
  E2E_MENU_PREFIX,
  deleteMenuE2eData,
  getMenuCategoryAvailability,
  getMenuItemAvailability,
  getRestaurantSettingSnapshot,
  getTenantIdBySlug,
  restoreRestaurantSettingSnapshot,
  setMenuCategoryAvailability,
  setMenuItemAvailability,
  upsertMenuCategory,
  upsertMenuItem,
  upsertMenuQrCode,
  upsertRestaurantSettingValue,
  type RestaurantSettingSnapshot,
} from './helpers/supabaseStaging'

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? ''
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ''
const TENANT_SLUG = process.env.E2E_TENANT_SLUG ?? ''
const SERVICE_KEY = process.env.E2E_SUPABASE_SERVICE_KEY ?? ''

const hasE2eCreds = Boolean(ADMIN_EMAIL && ADMIN_PASSWORD && TENANT_SLUG && SERVICE_KEY)

const VIEWPORTS = [
  { label: 'desktop-1280', tag: '', width: 1280, height: 800 },
  { label: 'mobile-375', tag: '@viewport:mobile-375', width: 375, height: 812 },
  { label: 'tablet-834', tag: '@viewport:tablet-834', width: 834, height: 1194 },
] as const

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function byExactText(value: string): RegExp {
  return new RegExp(`^${escapeRegExp(value)}$`, 'i')
}

function quotedIdSelector(id: string): string {
  return `[id="${id.replace(/"/g, '\\"')}"]`
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

function categoryHeader(page: Page, categoryLabel: string): Locator {
  return page
    .locator('[role="button"][aria-expanded][aria-controls]')
    .filter({ has: page.getByRole('heading', { name: byExactText(categoryLabel) }) })
    .first()
}

async function categoryContent(page: Page, header: Locator): Promise<Locator> {
  const contentId = await header.getAttribute('aria-controls')
  expect(contentId, 'aria-controls categoria').toBeTruthy()
  return page.locator(quotedIdSelector(contentId!))
}

async function openCategory(page: Page, categoryLabel: string): Promise<Locator> {
  const header = categoryHeader(page, categoryLabel)
  await expect(header).toBeVisible({ timeout: 15000 })
  if ((await header.getAttribute('aria-expanded')) !== 'true') {
    await header.click()
  }
  await expect(header).toHaveAttribute('aria-expanded', 'true')
  const content = await categoryContent(page, header)
  await expect(content).toHaveAttribute('aria-hidden', 'false')
  return content
}

function collectBrowserErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (/Failed to load resource|favicon/i.test(text)) return
    errors.push(text)
  })
  return errors
}

async function expectPublicQrItemVisible(
  page: Page,
  shortCode: string,
  categoryKey: string,
  categoryLabel: string,
  itemName: string,
) {
  await page.goto(`/menu/${TENANT_SLUG}/qr/${shortCode}`, { waitUntil: 'domcontentloaded' })
  await expect(
    page.getByRole('link', { name: new RegExp(escapeRegExp(categoryLabel), 'i') }).first(),
  ).toBeVisible({ timeout: 15000 })

  await page.goto(`/menu/${TENANT_SLUG}/qr/${shortCode}/c/${categoryKey}`, {
    waitUntil: 'domcontentloaded',
  })
  await expect(page.getByText(itemName, { exact: true })).toBeVisible({ timeout: 15000 })
}

async function expectPublicQrCategoryHidden(
  page: Page,
  shortCode: string,
  categoryKey: string,
  categoryLabel: string,
) {
  await page.goto(`/menu/${TENANT_SLUG}/qr/${shortCode}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('link', { name: new RegExp(escapeRegExp(categoryLabel), 'i') })).not.toBeVisible({
    timeout: 10000,
  })

  await page.goto(`/menu/${TENANT_SLUG}/qr/${shortCode}/c/${categoryKey}`, {
    waitUntil: 'domcontentloaded',
  })
  await expect(page.getByText(/Questa categoria non è al momento disponibile/i)).toBeVisible({
    timeout: 15000,
  })
}

async function expectPublicQrItemHidden(
  page: Page,
  shortCode: string,
  categoryKey: string,
  itemName: string,
) {
  await page.goto(`/menu/${TENANT_SLUG}/qr/${shortCode}/c/${categoryKey}`, {
    waitUntil: 'domcontentloaded',
  })
  await expect(page.getByText(itemName, { exact: true })).not.toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/Nessun piatto visibile in questa categoria/i)).toBeVisible({
    timeout: 15000,
  })
}

async function selectPublicBookingMenuMode(page: Page, presetId: string, options?: { expectGrid?: boolean }) {
  await page.goto(`/prenota/${TENANT_SLUG}`, { waitUntil: 'domcontentloaded' })
  const menuCard = page
    .locator(
      '[data-testid="booking-mode-card-rinfresco_laurea"], [data-testid="booking-mode-card-menu_prezzo_fisso"]',
    )
    .first()
  await expect(menuCard).toBeVisible({ timeout: 15000 })
  await menuCard.click()
  await page.getByTestId(`booking-sub-tab-card-subtab-${presetId}`).click()
  if (options?.expectGrid !== false) {
    await expect(page.getByTestId('booking-menu-compose-grid')).toBeVisible({ timeout: 15000 })
  }
}

async function expectPublicBookingItemVisible(
  page: Page,
  presetId: string,
  categoryKey: string,
  categoryLabel: string,
  itemName: string,
) {
  await selectPublicBookingMenuMode(page, presetId)
  const categoryButton = page.locator(`button${quotedIdSelector(`booking-menu-cat-header-${categoryKey}`)}:visible`)
  await expect(categoryButton).toBeVisible({ timeout: 15000 })
  await expect(categoryButton).toHaveAccessibleName(new RegExp(escapeRegExp(categoryLabel), 'i'))
  if ((await categoryButton.getAttribute('aria-expanded')) !== 'true') {
    await categoryButton.click()
  }
  await expect(page.getByText(itemName, { exact: true })).toBeVisible({ timeout: 15000 })
}

async function expectPublicBookingItemHidden(page: Page, presetId: string, itemName: string) {
  await selectPublicBookingMenuMode(page, presetId, { expectGrid: false })
  await expect(page.getByText(itemName, { exact: true })).not.toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/Nessun ingrediente disponibile per questa tipologia/i)).toBeVisible({
    timeout: 15000,
  })
}

function buildE2eStaffPreset(presetId: string, itemId: string, label: string) {
  return {
    id: presetId,
    name: label,
    item_ids: [itemId],
    booking_types: ['menu_prezzo_fisso'],
    description: 'Preset E2E temporaneo',
    is_fixed_menu: false,
    visible_on_booking: true,
  }
}

function buildE2eBookingPublicFormConfig(presetId: string, label: string) {
  return {
    page_title: 'Prenota QA E2E',
    page_description: 'Configurazione temporanea Playwright',
    header_styles: {},
    booking_modes: [
      {
        id: 'menu_prezzo_fisso',
        booking_type: 'menu_prezzo_fisso',
        enabled: true,
        label: 'Menu QA E2E',
        description: 'Test temporaneo Playwright',
        icon: 'bowl_food',
        sub_tabs_enabled: true,
        sub_tabs_presentation: 'cards',
        sub_tabs: [
          {
            id: `subtab-${presetId}`,
            display: 'cards',
            label,
            preset_id: presetId,
            is_fixed_menu: false,
          },
        ],
      },
    ],
  }
}

test.describe('Admin Menu magazzino — QA browser M3', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(!hasE2eCreds, 'richiede credenziali staging in .env.local.test')

  for (const viewport of VIEWPORTS) {
    test(`toggle disponibilità e propagazione QR (${viewport.label}) ${viewport.tag}`, async ({ page }) => {
      test.setTimeout(120000)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      const browserErrors = collectBrowserErrors(page)

      const tenantId = await getTenantIdBySlug(TENANT_SLUG)
      const suffix = viewport.label.replace(/[^a-z0-9]/gi, '_').toLowerCase()
      const categoryKey = `e2e_m3_${suffix}`
      const categoryLabel = `${E2E_MENU_PREFIX}${viewport.label}`.slice(0, 24)
      const itemName = `${E2E_MENU_PREFIX}Item ${viewport.label}`.slice(0, 24)
      const shortCode = `e2em3${suffix}`.replace(/_/g, '').slice(0, 20)

      let categoryId = ''
      let itemId = ''
      let staffPresetsSnapshot: RestaurantSettingSnapshot | null = null
      let bookingConfigSnapshot: RestaurantSettingSnapshot | null = null

      try {
        await deleteMenuE2eData(tenantId, categoryKey, shortCode)
        const category = await upsertMenuCategory({
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
        await upsertMenuQrCode({
          tenantId,
          shortCode,
          name: `${E2E_MENU_PREFIX}QR ${viewport.label}`,
          categoryFilter: [categoryKey],
        })
        categoryId = category.id
        itemId = item.id

        const presetId = crypto.randomUUID()
        const presetLabel = `${E2E_MENU_PREFIX}Card ${viewport.label}`.slice(0, 24)
        staffPresetsSnapshot = await getRestaurantSettingSnapshot(
          tenantId,
          'booking_custom_staff_presets',
        )
        bookingConfigSnapshot = await getRestaurantSettingSnapshot(
          tenantId,
          'booking_public_form_config',
        )
        await upsertRestaurantSettingValue(tenantId, 'booking_custom_staff_presets', [
          buildE2eStaffPreset(presetId, itemId, presetLabel),
        ])
        await upsertRestaurantSettingValue(
          tenantId,
          'booking_public_form_config',
          buildE2eBookingPublicFormConfig(presetId, presetLabel),
        )

        await loginAdmin(page)
        await goToAdminMenu(page)

        await expect(page.getByRole('button', { name: /Crea \/ Modifica Categoria/i })).toBeEnabled()
        await expect(page.getByRole('button', { name: /Crea \/ Modifica Prodotto/i })).toBeEnabled()

        const header = categoryHeader(page, categoryLabel)
        await expect(header).toBeVisible({ timeout: 15000 })
        await expect(header).toHaveAttribute('aria-expanded', 'false')

        const hideCategory = page.getByRole('button', {
          name: byExactText(`Nascondi ${categoryLabel} in Prenota e Menu QR`),
        })
        await expect(hideCategory).toBeVisible()
        await hideCategory.click()

        await expect(header).toHaveAttribute('aria-expanded', 'false')
        await expect
          .poll(() => getMenuCategoryAvailability(categoryId), { timeout: 10000 })
          .toBe(false)
        await expect(
          page.getByRole('button', {
            name: byExactText(`Mostra ${categoryLabel} in Prenota e Menu QR`),
          }),
        ).toBeVisible()
        await expectPublicQrCategoryHidden(page, shortCode, categoryKey, categoryLabel)

        await goToAdminMenu(page)
        await page
          .getByRole('button', { name: byExactText(`Mostra ${categoryLabel} in Prenota e Menu QR`) })
          .click()
        await expect
          .poll(() => getMenuCategoryAvailability(categoryId), { timeout: 10000 })
          .toBe(true)

        await goToAdminMenu(page)
        const content = await openCategory(page, categoryLabel)
        await expect(content.getByText(itemName, { exact: true })).toBeVisible({ timeout: 10000 })

        await content
          .getByRole('button', { name: byExactText(`Nascondi ${itemName} in Prenota e Menu QR`) })
          .click()
        await expect(header).toHaveAttribute('aria-expanded', 'true')
        await expect(content).toHaveAttribute('aria-hidden', 'false')
        await expect.poll(() => getMenuItemAvailability(itemId), { timeout: 10000 }).toBe(false)
        await expect(
          content.getByRole('button', { name: byExactText(`Mostra ${itemName} in Prenota e Menu QR`) }),
        ).toBeVisible()
        await expectPublicBookingItemHidden(page, presetId, itemName)
        await expectPublicQrItemHidden(page, shortCode, categoryKey, itemName)

        await goToAdminMenu(page)
        const reopenedContent = await openCategory(page, categoryLabel)
        await reopenedContent
          .getByRole('button', { name: byExactText(`Mostra ${itemName} in Prenota e Menu QR`) })
          .click()
        await expect.poll(() => getMenuItemAvailability(itemId), { timeout: 10000 }).toBe(true)
        await expectPublicBookingItemVisible(page, presetId, categoryKey, categoryLabel, itemName)
        await expectPublicQrItemVisible(page, shortCode, categoryKey, categoryLabel, itemName)

        await goToAdminMenu(page)
        await page.getByRole('button', { name: /Crea \/ Modifica Categoria/i }).click()
        await expect(page.getByRole('heading', { name: /Categorie Menu/i })).toBeVisible({
          timeout: 10000,
        })
        await expect(
          page.getByRole('button', { name: /in Prenota e Menu QR/i }),
        ).not.toBeVisible()

        expect(browserErrors, 'errori console/browser').toEqual([])
      } finally {
        if (categoryId) await setMenuCategoryAvailability(tenantId, categoryId, true).catch(() => {})
        if (itemId) await setMenuItemAvailability(tenantId, itemId, true).catch(() => {})
        if (bookingConfigSnapshot) {
          await restoreRestaurantSettingSnapshot(
            tenantId,
            'booking_public_form_config',
            bookingConfigSnapshot,
          ).catch(() => {})
        }
        if (staffPresetsSnapshot) {
          await restoreRestaurantSettingSnapshot(
            tenantId,
            'booking_custom_staff_presets',
            staffPresetsSnapshot,
          ).catch(() => {})
        }
        await deleteMenuE2eData(tenantId, categoryKey, shortCode).catch(() => {})
      }
    })
  }
})
