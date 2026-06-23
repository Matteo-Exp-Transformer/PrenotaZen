/**
 * E2E smoke Pagina Prenota — gap manuali testabili senza giudizio visivo.
 *
 * @prenota-blindatura:e2e
 * Copre:
 * - slug inesistente → pagina non disponibile;
 * - submit invalido → primo campo con alert visivo;
 * - link Privacy → ritorno a /prenota/:slug;
 * - submit raggiungibile nelle viewport 375 / 834 / 1280.
 */

import { test, expect, type Page } from '@playwright/test'
import {
  getExistingTenantSlug,
  getRestaurantSettingSnapshot,
  getTenantIdBySlug,
  type RestaurantSettingSnapshot,
  restoreRestaurantSettingSnapshot,
  upsertRestaurantSettingValue,
} from './helpers/supabaseStaging'

const PREFERRED_TENANT_SLUG = process.env.E2E_TENANT_SLUG || 'da-tommaso'
const MISSING_SLUG_URL = '/prenota/__slug-inesistente__'
const HAS_STAGING_CONFIG = Boolean(process.env.VITE_SUPABASE_URL && process.env.E2E_SUPABASE_SERVICE_KEY)

let tenantSlug = PREFERRED_TENANT_SLUG
let bookingUrl = `/prenota/${tenantSlug}`

function makeE2eBookingFormConfig() {
  return {
    page_title: 'Prenota E2E',
    page_description: 'Config temporanea per smoke Playwright.',
    booking_modes: [
      {
        id: 'tavolo',
        booking_type: 'tavolo',
        enabled: true,
        label: 'Tavolo',
        description: 'Prenota un tavolo.',
        icon: 'fork_knife',
        sub_tabs_enabled: false,
        sub_tabs_presentation: null,
        sub_tabs: [],
      },
    ],
  }
}

function makeE2ePricedCarouselFormConfig() {
  return {
    page_title: 'Prenota E2E Totale',
    page_description: 'Config temporanea per verificare il riepilogo.',
    booking_modes: [
      {
        id: 'e2e-riepilogo',
        booking_type: 'rinfresco_laurea',
        enabled: true,
        label: 'Rinfresco E2E',
        description: 'Offerta con prezzo a persona.',
        icon: 'sparkles',
        sub_tabs_enabled: true,
        sub_tabs_presentation: 'carousel',
        sub_tabs: [
          {
            id: 'e2e-riepilogo-carousel',
            display: 'carousel',
            label: 'Menu E2E',
            price_per_person: 25,
            carousel_items: [
              {
                image_url: '/booking/tiles/tile-01.png',
                eyebrow: 'E2E',
                title: 'Offerta Totale',
                description: 'Slide temporanea per smoke Playwright.',
                sort_order: 0,
              },
            ],
          },
        ],
      },
    ],
  }
}

function makeE2eCardsXorFormConfig() {
  return {
    page_title: 'Prenota E2E Card',
    page_description: 'Config temporanea per verificare card e XOR.',
    booking_modes: [
      {
        id: 'e2e-card-mode',
        booking_type: 'rinfresco_laurea',
        enabled: true,
        label: 'Card E2E',
        description: 'Modalità con card scorrevoli.',
        icon: 'sparkles',
        sub_tabs_enabled: true,
        sub_tabs_presentation: 'cards',
        sub_tabs: [
          {
            id: 'e2e-card-valida',
            display: 'cards',
            label: 'Card valida E2E',
            description: 'Questa card deve comparire.',
            price_per_person: 18,
          },
          {
            id: 'e2e-card-senza-titolo',
            display: 'cards',
            label: '   ',
            description: 'Questa card non deve comparire.',
            price_per_person: 22,
          },
        ],
      },
    ],
  }
}

async function seedBookingFormConfigForSmoke(): Promise<{
  tenantId: string
  formConfigSnapshot: RestaurantSettingSnapshot
}> {
  tenantSlug = await getExistingTenantSlug(PREFERRED_TENANT_SLUG, ['da-tommaso', 'test-classic', 'test-pro'])
  bookingUrl = `/prenota/${tenantSlug}`
  const tenantId = await getTenantIdBySlug(tenantSlug)
  const formConfigSnapshot = await getRestaurantSettingSnapshot(tenantId, 'booking_public_form_config')
  await upsertRestaurantSettingValue(tenantId, 'booking_public_form_config', makeE2eBookingFormConfig())
  return { tenantId, formConfigSnapshot }
}

test.use({ viewport: { width: 1280, height: 900 } })

function visibleSubmitForViewport(page: Page) {
  const viewport = page.viewportSize()
  const isWideDesktop = (viewport?.width ?? 1280) >= 1600

  return isWideDesktop
    ? page.locator('#booking-request-form button.booking-cross-shine-btn[type="submit"]:visible')
    : page.locator('button[type="submit"][form="booking-request-form"]:visible')
}

test.describe('Pagina Prenota smoke', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(!HAS_STAGING_CONFIG, 'richiede .env.local.test con staging Supabase TEST')

  let seededTenantId = ''
  let formConfigSnapshot: RestaurantSettingSnapshot = { exists: false, value: null }

  test.beforeAll(async () => {
    const seeded = await seedBookingFormConfigForSmoke()
    seededTenantId = seeded.tenantId
    formConfigSnapshot = seeded.formConfigSnapshot
  })

  test.afterAll(async () => {
    if (!seededTenantId) return
    await restoreRestaurantSettingSnapshot(
      seededTenantId,
      'booking_public_form_config',
      formConfigSnapshot,
    ).catch(() => {})
  })

  test('slug inesistente mostra la pagina non disponibile', async ({ page }) => {
    await page.goto(MISSING_SLUG_URL)

    await expect(page.getByRole('heading', { name: /prenotazioni temporaneamente non disponibili/i })).toBeVisible()
    await expect(page.getByText(/il ristorante richiesto non esiste/i)).toBeVisible()
  })

  test('submit invalido attiva alert sul primo campo', async ({ page }) => {
    await page.goto(bookingUrl)

    await expect(page.locator('#booking-request-form')).toBeVisible({ timeout: 10000 })
    await visibleSubmitForViewport(page).click()

    const firstField = page.locator('#client_name-control')
    await expect(firstField).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('#client_name')).toHaveClass(/booking-public-field-attention/)
    await expect(page.locator('#client_name-error')).toHaveText('Nome obbligatorio')
  })

  test('link privacy ritorna a /prenota/:slug', async ({ page }) => {
    await page.goto(bookingUrl)

    const privacyLink = page.getByRole('link', { name: /privacy policy/i })
    await expect(privacyLink).toHaveAttribute('href', new RegExp(`/privacy\\?from=%2Fprenota%2F${tenantSlug}$`))
    await expect(privacyLink).not.toHaveAttribute('target', '_blank')

    await privacyLink.click()
    await expect(page).toHaveURL(new RegExp(`/privacy\\?from=%2Fprenota%2F${tenantSlug}$`))

    await page.getByRole('button', { name: /torna alla prenotazione/i }).click()
    await expect(page).toHaveURL(new RegExp(`/prenota/${tenantSlug}$`))

    await page.goBack()
    await expect(page).not.toHaveURL(new RegExp(`/prenota/${tenantSlug}$`))
  })

  // @prenota-blindatura: e2e-summary-total-label
  // Copre: il riepilogo pubblico mostra la label "Totale", mai "Totale stimato".
  test('riepilogo mostra Totale, non Totale stimato', async ({ page }) => {
    test.setTimeout(120000)

    const tenantId = await getTenantIdBySlug(tenantSlug)
    const currentConfigSnapshot = await getRestaurantSettingSnapshot(tenantId, 'booking_public_form_config')

    try {
      await upsertRestaurantSettingValue(
        tenantId,
        'booking_public_form_config',
        makeE2ePricedCarouselFormConfig(),
      )

      await page.goto(`${bookingUrl}?e2e=summary-total`, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('#booking-request-form')).toBeVisible({ timeout: 15000 })

      const summary = page.getByTestId('booking-summary-sidebar').first()
      await expect(summary).toBeVisible()
      await page.locator('#num_guests-control').fill('2')

      await expect(summary.getByText('Totale', { exact: true })).toBeVisible({ timeout: 10000 })
      await expect(summary.getByText('Totale stimato', { exact: true })).toHaveCount(0)
      await expect(summary.getByText('50,00 €', { exact: true })).toBeVisible()
    } finally {
      await restoreRestaurantSettingSnapshot(
        tenantId,
        'booking_public_form_config',
        currentConfigSnapshot,
      ).catch(() => {})
    }
  })

  // @prenota-blindatura: e2e-xor-card-carousel
  // Copre: card scorrevoli oppure carosello, mai entrambi; card senza titolo non appare.
  test('card e carosello restano XOR e la card senza titolo non appare', async ({ page }) => {
    test.setTimeout(120000)

    const tenantId = await getTenantIdBySlug(tenantSlug)
    const currentConfigSnapshot = await getRestaurantSettingSnapshot(tenantId, 'booking_public_form_config')

    try {
      await upsertRestaurantSettingValue(
        tenantId,
        'booking_public_form_config',
        makeE2ePricedCarouselFormConfig(),
      )
      await page.goto(`${bookingUrl}?e2e=xor-carousel`, { waitUntil: 'domcontentloaded' })

      await expect(page.locator('#booking-request-form')).toBeVisible({ timeout: 15000 })
      await expect(page.getByRole('heading', { name: 'Offerta Totale' })).toBeVisible()
      await expect(page.getByTestId('booking-sub-tab-cards')).toHaveCount(0)

      await upsertRestaurantSettingValue(
        tenantId,
        'booking_public_form_config',
        makeE2eCardsXorFormConfig(),
      )
      await page.goto(`${bookingUrl}?e2e=xor-cards`, { waitUntil: 'domcontentloaded' })

      await expect(page.getByTestId('booking-sub-tab-cards')).toBeVisible({ timeout: 15000 })
      await expect(page.getByTestId('booking-sub-tab-card-e2e-card-valida')).toBeVisible()
      await expect(page.getByTestId('booking-sub-tab-card-e2e-card-senza-titolo')).toHaveCount(0)
      await expect(page.getByRole('heading', { name: 'Offerta Totale' })).toHaveCount(0)
    } finally {
      await restoreRestaurantSettingSnapshot(
        tenantId,
        'booking_public_form_config',
        currentConfigSnapshot,
      ).catch(() => {})
    }
  })

  for (const viewport of [
    { width: 375, height: 812 },
    { width: 834, height: 1194 },
    { width: 1280, height: 800 },
  ]) {
    test(`submit raggiungibile a ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto(bookingUrl)

      await expect(page.locator('#booking-request-form')).toBeVisible({ timeout: 10000 })
      await expect(page.getByTestId('booking-summary-sidebar').first()).toBeVisible()

      const desktopSubmit = page.locator('#booking-request-form button.booking-cross-shine-btn[type="submit"]:visible')
      const summarySubmit = page.locator('button[type="submit"][form="booking-request-form"]:visible')

      if (viewport.width >= 1600) {
        await expect(desktopSubmit).toHaveCount(1)
        await expect(summarySubmit).toHaveCount(0)
      } else {
        await expect(summarySubmit).toHaveCount(1)
        await expect(desktopSubmit).toHaveCount(0)
      }

      await page.locator('#desired_time-control').click()
      const timeDialog = page.getByRole('dialog', { name: /scegli l'orario/i })
      await expect(timeDialog).toBeVisible()
      const availableTimes = timeDialog.getByRole('button', { name: /^\d{2}:\d{2}$/ })
      await expect(availableTimes.first()).toBeVisible()
      const dialogBox = await timeDialog.boundingBox()
      expect(dialogBox).not.toBeNull()
      expect(dialogBox!.x).toBeGreaterThanOrEqual(0)
      expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(viewport.width + 1)
      const chosenTime = await availableTimes.first().textContent()
      await availableTimes.first().click()
      await expect(page.locator('#desired_time-control')).toContainText(chosenTime ?? '')
    })
  }
})

test.describe('Pagina Prenota visual checklist', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(!HAS_STAGING_CONFIG, 'richiede .env.local.test con staging Supabase TEST')

  async function hasFullPageBackground(page: Page, id: string): Promise<boolean> {
    return page.evaluate((backgroundId) => {
      return Array.from(document.querySelectorAll<HTMLElement>('div')).some((el) =>
        el.style.backgroundImage.includes(`${backgroundId}-landscape.webp`) ||
        el.style.backgroundImage.includes(`${backgroundId}-portrait.webp`),
      )
    }, id)
  }

  async function rootBackgroundColor(page: Page): Promise<string> {
    return page.evaluate(() => {
      const roots = Array.from(document.querySelectorAll<HTMLElement>('div'))
      const root = roots.find((el) => el.style.backgroundColor)
      return root ? getComputedStyle(root).backgroundColor : ''
    })
  }

  test('sfondo: striscia vince su foto intera, foto intera senza striscia, crema senza scelta', async ({ page }) => {
    test.setTimeout(120000)

    tenantSlug = await getExistingTenantSlug(PREFERRED_TENANT_SLUG, ['da-tommaso', 'test-classic', 'test-pro'])
    bookingUrl = `/prenota/${tenantSlug}`
    const tenantId = await getTenantIdBySlug(tenantSlug)
    const stripSnapshot = await getRestaurantSettingSnapshot(tenantId, 'public_booking_strip_photo')
    const pageBgSnapshot = await getRestaurantSettingSnapshot(tenantId, 'public_booking_page_background')

    try {
      await upsertRestaurantSettingValue(tenantId, 'public_booking_strip_photo', 'strip-04')
      await upsertRestaurantSettingValue(tenantId, 'public_booking_page_background', 'full-02')

      await page.goto(`${bookingUrl}?e2e=strip`, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('img[src*="asset/strip/strip-04.webp"]').first()).toBeVisible({
        timeout: 15000,
      })
      await expect.poll(() => hasFullPageBackground(page, 'full-02'), { timeout: 15000 }).toBe(false)

      await upsertRestaurantSettingValue(tenantId, 'public_booking_strip_photo', '')
      await upsertRestaurantSettingValue(tenantId, 'public_booking_page_background', 'full-02')

      await page.goto(`${bookingUrl}?e2e=full`, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('img[src*="asset/strip/"]')).toHaveCount(0)
      await expect.poll(() => hasFullPageBackground(page, 'full-02'), { timeout: 15000 }).toBe(true)

      await upsertRestaurantSettingValue(tenantId, 'public_booking_strip_photo', '')
      await upsertRestaurantSettingValue(tenantId, 'public_booking_page_background', '')

      await page.goto(`${bookingUrl}?e2e=neutral`, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('img[src*="asset/strip/"]')).toHaveCount(0)
      await expect.poll(() => hasFullPageBackground(page, 'full-02'), { timeout: 15000 }).toBe(false)
      await expect.poll(() => rootBackgroundColor(page), { timeout: 15000 }).toBe('rgb(250, 247, 241)')
    } finally {
      await restoreRestaurantSettingSnapshot(
        tenantId,
        'public_booking_strip_photo',
        stripSnapshot,
      ).catch(() => {})
      await restoreRestaurantSettingSnapshot(
        tenantId,
        'public_booking_page_background',
        pageBgSnapshot,
      ).catch(() => {})
    }
  })

  test('footer Orari assente quando tutti i giorni sono chiusi', async ({ page }) => {
    test.setTimeout(120000)

    tenantSlug = await getExistingTenantSlug(PREFERRED_TENANT_SLUG, ['da-tommaso', 'test-classic', 'test-pro'])
    bookingUrl = `/prenota/${tenantSlug}`
    const tenantId = await getTenantIdBySlug(tenantSlug)
    const hoursSnapshot = await getRestaurantSettingSnapshot(tenantId, 'business_hours')
    const closedHours = {
      monday: null,
      tuesday: null,
      wednesday: null,
      thursday: null,
      friday: null,
      saturday: null,
      sunday: null,
    }

    try {
      await upsertRestaurantSettingValue(tenantId, 'business_hours', closedHours)

      await page.goto(`${bookingUrl}?e2e=hours-closed`, { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { name: /^Orari$/i })).not.toBeVisible({
        timeout: 15000,
      })
    } finally {
      await restoreRestaurantSettingSnapshot(tenantId, 'business_hours', hoursSnapshot).catch(() => {})
    }
  })

  // @prenota-blindatura: e2e-empty-state
  // Copre: form non configurato → EmptyState con recapiti e nessun form demo pubblico.
  test('form non configurato mostra EmptyState con recapiti', async ({ page }) => {
    test.setTimeout(120000)

    tenantSlug = await getExistingTenantSlug(PREFERRED_TENANT_SLUG, ['da-tommaso', 'test-classic', 'test-pro'])
    bookingUrl = `/prenota/${tenantSlug}`
    const tenantId = await getTenantIdBySlug(tenantSlug)
    const formConfigSnapshot = await getRestaurantSettingSnapshot(tenantId, 'booking_public_form_config')
    const emailSnapshot = await getRestaurantSettingSnapshot(tenantId, 'contact_email')
    const phoneSnapshot = await getRestaurantSettingSnapshot(tenantId, 'contact_phone')

    const contactEmail = 'e2e.empty-state@test.it'
    const contactPhone = '+39 333 888 7777'

    try {
      await restoreRestaurantSettingSnapshot(tenantId, 'booking_public_form_config', {
        exists: false,
        value: null,
      })
      await upsertRestaurantSettingValue(tenantId, 'contact_email', contactEmail)
      await upsertRestaurantSettingValue(tenantId, 'contact_phone', contactPhone)

      await page.goto(`${bookingUrl}?e2e=empty-form`, { waitUntil: 'domcontentloaded' })

      const emptyState = page.getByRole('status')
      await expect(emptyState.getByRole('heading', { name: /form prenotazione non ancora configurato/i })).toBeVisible({
        timeout: 15000,
      })
      await expect(emptyState.getByText(/contatta il ristorante usando i recapiti qui sotto/i)).toBeVisible()
      await expect(page.locator('#booking-request-form')).toHaveCount(0)
      await expect(page.getByRole('button', { name: /invia prenotazione/i })).toHaveCount(0)
      await expect(page.getByText(contactEmail, { exact: true }).first()).toBeVisible()
      await expect(page.getByText(contactPhone, { exact: true }).first()).toBeVisible()
    } finally {
      await restoreRestaurantSettingSnapshot(tenantId, 'booking_public_form_config', formConfigSnapshot).catch(() => {})
      await restoreRestaurantSettingSnapshot(tenantId, 'contact_email', emailSnapshot).catch(() => {})
      await restoreRestaurantSettingSnapshot(tenantId, 'contact_phone', phoneSnapshot).catch(() => {})
    }
  })
})
