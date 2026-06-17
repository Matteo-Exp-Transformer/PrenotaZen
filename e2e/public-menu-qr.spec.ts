/**
 * @menu-qr-blindatura: public-menu-qr
 * Copre: homepage QR cliente, apertura categoria, browser back, shortCode mancante
 * e route /menu/:slug senza shortCode.
 */
import { test, expect } from '@playwright/test'
import {
  deleteMenuE2eData,
  getExistingTenantSlug,
  getTenantIdBySlug,
  upsertMenuCategory,
  upsertMenuItem,
  upsertMenuQrCode,
} from './helpers/supabaseStaging'

const PREFERRED_TENANT_SLUG = process.env.E2E_TENANT_SLUG ?? 'da-tommaso'
const HAS_STAGING_CONFIG = Boolean(process.env.VITE_SUPABASE_URL && process.env.E2E_SUPABASE_SERVICE_KEY)

test.skip(!HAS_STAGING_CONFIG, 'richiede .env.local.test con staging Supabase TEST')

test.describe('Menu QR pubblico — flusso cliente', () => {
  let tenantSlug = PREFERRED_TENANT_SLUG

  test.beforeAll(async () => {
    tenantSlug = await getExistingTenantSlug(PREFERRED_TENANT_SLUG, ['da-tommaso', 'test-classic', 'test-pro'])
  })

  test('homepage, categoria, back, shortCode assente e fallback /menu/:slug', async ({ page }) => {
    test.setTimeout(120000)

    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (/Failed to load resource|favicon/i.test(text)) return
      errors.push(text)
    })

    const tenantId = await getTenantIdBySlug(tenantSlug)
    const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
    const categoryKey = `e2e_qr_${suffix}`
    const categoryLabel = `E2E QR ${suffix}`
    const itemName = `Piatto E2E ${suffix}`
    const shortCode = `e2eqr${suffix}`
    const fakeShortCode = `missing${suffix}`

    const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    try {
      await deleteMenuE2eData(tenantId, categoryKey, shortCode)

      await upsertMenuCategory({
        tenantId,
        key: categoryKey,
        label: categoryLabel,
        isAvailable: true,
      })
      await upsertMenuItem({
        tenantId,
        categoryKey,
        name: itemName,
        isAvailable: true,
      })
      await upsertMenuQrCode({
        tenantId,
        shortCode,
        name: `QR E2E ${suffix}`,
        categoryFilter: [categoryKey],
      })

      await page.goto(`/menu/${tenantSlug}/qr/${shortCode}`, {
        waitUntil: 'domcontentloaded',
      })

      const categoryLink = page
        .getByRole('link', { name: new RegExp(escapeRegExp(categoryLabel), 'i') })
        .first()
      await expect(categoryLink).toBeVisible({ timeout: 15000 })
      await categoryLink.click()

      await expect(page).toHaveURL(
        new RegExp(`/menu/${tenantSlug}/qr/${shortCode}/c/${categoryKey}$`),
      )
      await expect(page.getByText(itemName, { exact: true })).toBeVisible({ timeout: 15000 })

      await page.goBack({ waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(new RegExp(`/menu/${tenantSlug}/qr/${shortCode}$`))
      await expect(categoryLink).toBeVisible({ timeout: 15000 })

      await page.goto(`/menu/${tenantSlug}/qr/${fakeShortCode}`, {
        waitUntil: 'domcontentloaded',
      })
      await expect(page).toHaveURL(new RegExp(`/menu/${tenantSlug}/qr/${fakeShortCode}$`))
      await expect(page.getByText('Menù QR non trovato')).toBeVisible({ timeout: 15000 })

      await page.goto(`/menu/${tenantSlug}`, { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(new RegExp(`/menu/${tenantSlug}$`))
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15000 })
      await expect(page.getByText('Menù QR non trovato')).not.toBeVisible()

      expect(errors, 'errori console/browser').toEqual([])
    } finally {
      await deleteMenuE2eData(tenantId, categoryKey, shortCode).catch(() => {})
    }
  })

  test('visual: carosello, tema, ordine categorie e footer data/ora', async ({ page }) => {
    test.setTimeout(120000)

    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (/Failed to load resource|favicon/i.test(text)) return
      errors.push(text)
    })

    const tenantId = await getTenantIdBySlug(tenantSlug)
    const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
    const firstCategoryKey = `e2e_qr_order_a_${suffix}`
    const secondCategoryKey = `e2e_qr_order_b_${suffix}`
    const firstCategoryLabel = `E2E Ordine A ${suffix}`
    const secondCategoryLabel = `E2E Ordine B ${suffix}`
    const shortCode = `e2ev${suffix}`

    try {
      await deleteMenuE2eData(tenantId, firstCategoryKey, shortCode)
      await deleteMenuE2eData(tenantId, secondCategoryKey, shortCode)

      await upsertMenuCategory({
        tenantId,
        key: firstCategoryKey,
        label: firstCategoryLabel,
        isAvailable: true,
        sortOrder: 1,
      })
      await upsertMenuCategory({
        tenantId,
        key: secondCategoryKey,
        label: secondCategoryLabel,
        isAvailable: true,
        sortOrder: 2,
      })
      await upsertMenuItem({
        tenantId,
        categoryKey: firstCategoryKey,
        name: `Piatto A ${suffix}`,
        isAvailable: true,
      })
      await upsertMenuItem({
        tenantId,
        categoryKey: secondCategoryKey,
        name: `Piatto B ${suffix}`,
        isAvailable: true,
      })
      await upsertMenuQrCode({
        tenantId,
        shortCode,
        name: `QR Visual ${suffix}`,
        categoryFilter: [secondCategoryKey, firstCategoryKey],
        themeKey: 'dark_gold',
        carouselItems: [
          {
            image_url: '/menu-themes/cream-sage-header.png',
            eyebrow: 'E2E visual',
            title: `Slide Prima ${suffix}`,
            description: 'Controllo carosello QR',
          },
          {
            image_url: '/menu-themes/rustic-terracotta-header.png',
            eyebrow: 'E2E visual',
            title: `Slide Seconda ${suffix}`,
            description: 'Seconda slide QR',
          },
        ],
      })

      await page.goto(`/menu/${tenantSlug}/qr/${shortCode}`, {
        waitUntil: 'domcontentloaded',
      })

      await expect(page.getByText(`Slide Prima ${suffix}`, { exact: true })).toBeVisible({
        timeout: 15000,
      })
      await expect(page.locator('img[src*="cream-sage-header.png"]').first()).toBeVisible()
      await expect(page.getByRole('tablist', { name: /Slide specialità/i })).toBeVisible()
      await expect(page.getByRole('tab', { name: /Slide 2 di 2/i })).toBeVisible()

      await expect
        .poll(
          () =>
            page.evaluate(() =>
              Array.from(document.querySelectorAll<HTMLElement>('div')).some((el) =>
                el.style.backgroundImage.includes('dark-gold-body.png'),
              ),
            ),
          { timeout: 15000 },
        )
        .toBe(true)

      const categoryCards = page.locator('main a')
      await expect(categoryCards).toHaveCount(2)
      await expect(categoryCards.nth(0)).toContainText(secondCategoryLabel)
      await expect(categoryCards.nth(1)).toContainText(firstCategoryLabel)

      const today = new Intl.DateTimeFormat('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(new Date())
      await expect(page.getByText(today, { exact: true })).toBeVisible()
      await expect(page.getByText(/^\d{2}:\d{2}$/).last()).toBeVisible()

      expect(errors, 'errori console/browser').toEqual([])
    } finally {
      await deleteMenuE2eData(tenantId, firstCategoryKey, shortCode).catch(() => {})
      await deleteMenuE2eData(tenantId, secondCategoryKey, shortCode).catch(() => {})
    }
  })

  // @menu-qr-blindatura: public-menu-qr-icons
  // Copre: card categoria senza foto -> default lucide_salad visibile, nessuna immagine/emoji inventata.
  test('category card senza foto mostra icona default lucide_salad', async ({ page }) => {
    test.setTimeout(120000)

    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (/Failed to load resource|favicon/i.test(text)) return
      errors.push(text)
    })

    const tenantId = await getTenantIdBySlug(tenantSlug)
    const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
    const categoryKey = `e2e_qr_icon_${suffix}`
    const categoryLabel = `E2E Icon ${suffix}`
    const shortCode = `e2ei${suffix}`

    try {
      await deleteMenuE2eData(tenantId, categoryKey, shortCode)

      await upsertMenuCategory({
        tenantId,
        key: categoryKey,
        label: categoryLabel,
        isAvailable: true,
        sortOrder: 1,
      })
      await upsertMenuItem({
        tenantId,
        categoryKey,
        name: `Piatto icona ${suffix}`,
        isAvailable: true,
      })
      await upsertMenuQrCode({
        tenantId,
        shortCode,
        name: `QR Icon ${suffix}`,
        categoryFilter: [categoryKey],
      })

      await page.goto(`/menu/${tenantSlug}/qr/${shortCode}`, {
        waitUntil: 'domcontentloaded',
      })

      const categoryCard = page.getByRole('link', { name: new RegExp(categoryLabel, 'i') }).first()
      await expect(categoryCard).toBeVisible({ timeout: 15000 })
      await expect(categoryCard.locator('img')).toHaveCount(0)
      await expect(categoryCard.locator('svg.lucide-salad')).toBeVisible()
      await expect(categoryCard).not.toContainText(/\p{Extended_Pictographic}/u)

      expect(errors, 'errori console/browser').toEqual([])
    } finally {
      await deleteMenuE2eData(tenantId, categoryKey, shortCode).catch(() => {})
    }
  })
})
