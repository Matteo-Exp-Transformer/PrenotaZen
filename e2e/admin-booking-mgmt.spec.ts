/**
 * @admin-blindatura: prenotazioni-e2e
 * Copre: accept con warning capienza/orario passato (non bloccanti) + modali conferma responsive.
 *
 * Pre-requisiti staging (.env.local.test):
 *   E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_TENANT_SLUG, E2E_SUPABASE_SERVICE_KEY
 */
import { test, expect, type Page, type Locator } from '@playwright/test'
import {
  E2E_BOOKING_PREFIX,
  deleteBookingsByPrefix,
  getBookingStatus,
  getServiceSlots,
  getSlotGuestCapacities,
  getTenantIdBySlug,
  insertBooking,
  isoStartEnd,
  offsetIsoDate,
  todayIsoDate,
  upsertSlotGuestCapacities,
} from './helpers/supabaseStaging'

function tomorrowDinnerDate(): string {
  return offsetIsoDate(1)
}

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? ''
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ''
const TENANT_SLUG = process.env.E2E_TENANT_SLUG ?? ''
const SERVICE_KEY = process.env.E2E_SUPABASE_SERVICE_KEY ?? ''

const hasE2eCreds = Boolean(ADMIN_EMAIL && ADMIN_PASSWORD && TENANT_SLUG && SERVICE_KEY)

const LONG_REASON = 'Motivo lungo per test responsive. '.repeat(30) // ~870 char

async function loginAdmin(page: Page) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL)
  await page.getByLabel(/password/i).fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /accedi|login/i }).click()
  await expect(page).toHaveURL(/\/admin/, { timeout: 15000 })
}

async function goToPrenotazioni(page: Page) {
  await page.goto('/admin/prenotazioni')
  await expect(page).toHaveURL(/\/admin\/prenotazioni/)
}

async function expandPendingCard(page: Page, clientName: string) {
  const cardToggle = page.getByRole('button', { name: new RegExp(clientName, 'i') }).first()
  await expect(cardToggle).toBeVisible({ timeout: 15000 })
  await cardToggle.click()
  await expect(page.getByRole('button', { name: /accetta prenotazione/i }).first()).toBeVisible({
    timeout: 5000,
  })
}

async function expectDialogButtonsInViewport(page: Page, dialog: Locator, confirmPattern: RegExp) {
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()

  const cancelBtn = dialog.getByRole('button', { name: /annulla/i }).first()
  const confirmBtn = dialog.getByRole('button', { name: confirmPattern }).first()

  await expect(cancelBtn).toBeVisible()
  await expect(confirmBtn).toBeVisible()

  for (const btn of [cancelBtn, confirmBtn]) {
    const box = await btn.boundingBox()
    expect(box, 'bounding box bottone modale').not.toBeNull()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1)
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1)
  }
}

test.describe('Gestione prenotazioni admin — flussi base', () => {
  test.skip(!hasE2eCreds, 'richiede credenziali staging in .env.local.test')

  test.beforeEach(async ({ page }) => {
    await loginAdmin(page)
  })

  test('la dashboard mostra le richieste in attesa o stato vuoto', async ({ page }) => {
    await goToPrenotazioni(page)
    const pendingHeading = page.getByRole('heading', { name: /richieste in attesa/i })
    const emptyState = page.getByText(/nessuna richiesta in attesa/i)
    await expect(pendingHeading.or(emptyState)).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Gestione prenotazioni admin — warning accept (staging)', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(!hasE2eCreds, 'richiede credenziali staging in .env.local.test')

  let tenantId = ''
  let cenaSlotId = ''
  let savedCapacities: Record<string, number | null> = {}
  const createdIds: string[] = []

  test.beforeAll(async () => {
    tenantId = await getTenantIdBySlug(TENANT_SLUG)
    const slots = await getServiceSlots(tenantId)
    const cena = slots.find((s) => /cena/i.test(s.name)) ?? slots[slots.length - 1]
    if (!cena) throw new Error('Nessuna service_slot per tenant E2E')
    cenaSlotId = cena.id
    savedCapacities = await getSlotGuestCapacities(tenantId)
    await deleteBookingsByPrefix(tenantId)
  })

  test.afterAll(async () => {
    if (tenantId) {
      await deleteBookingsByPrefix(tenantId).catch(() => {})
      if (cenaSlotId) {
        await upsertSlotGuestCapacities(tenantId, savedCapacities).catch(() => {})
      }
    }
  })

  test.beforeEach(async ({ page }) => {
    await loginAdmin(page)
    await goToPrenotazioni(page)
  })

  test('accept con capienza superata mostra warning e procede (non blocca)', async ({ page }) => {
    const date = tomorrowDinnerDate()
    const time = '20:00'
    const { start, end } = isoStartEnd(date, time)

    await upsertSlotGuestCapacities(tenantId, { ...savedCapacities, [cenaSlotId]: 10 })

    const acceptedId = await insertBooking({
      tenantId,
      clientName: `${E2E_BOOKING_PREFIX}Capienza-Fill`,
      status: 'accepted',
      desiredDate: date,
      desiredTime: time,
      numGuests: 8,
      confirmedStart: start,
      confirmedEnd: end,
    })
    createdIds.push(acceptedId)

    const pendingId = await insertBooking({
      tenantId,
      clientName: `${E2E_BOOKING_PREFIX}Capienza-Pending`,
      status: 'pending',
      desiredDate: date,
      desiredTime: time,
      numGuests: 4,
    })
    createdIds.push(pendingId)

    await goToPrenotazioni(page)
    const pendingName = `${E2E_BOOKING_PREFIX}Capienza-Pending`
    await expandPendingCard(page, pendingName)
    await page.getByRole('button', { name: /accetta prenotazione/i }).first().click()

    const capacityDialog = page.getByRole('dialog').filter({ hasText: /capacità superata/i })
    await expect(capacityDialog).toBeVisible({ timeout: 8000 })
    await capacityDialog.getByRole('button', { name: /procedi comunque/i }).click()

    await expect(page.getByText(/accettata con successo/i)).toBeVisible({ timeout: 10000 })
    await expect.poll(() => getBookingStatus(pendingId), { timeout: 10000 }).toBe('accepted')
  })

  test('accept con orario passato mostra warning e procede (non blocca)', async ({ page }) => {
    const date = todayIsoDate()
    const pastTime = '07:30'

    const pendingId = await insertBooking({
      tenantId,
      clientName: `${E2E_BOOKING_PREFIX}Past-Time`,
      status: 'pending',
      desiredDate: date,
      desiredTime: pastTime,
      numGuests: 2,
    })
    createdIds.push(pendingId)

    await goToPrenotazioni(page)
    const pastName = `${E2E_BOOKING_PREFIX}Past-Time`
    await expandPendingCard(page, pastName)
    await page.getByRole('button', { name: /accetta prenotazione/i }).first().click()

    const pastDialog = page.getByRole('dialog').filter({ hasText: /orario già trascorso/i })
    await expect(pastDialog).toBeVisible({ timeout: 8000 })
    await pastDialog.getByRole('button', { name: /procedi comunque/i }).click()

    await expect(page.getByText(/accettata con successo/i)).toBeVisible({ timeout: 10000 })
    await expect.poll(() => getBookingStatus(pendingId), { timeout: 10000 }).toBe('accepted')
  })
})

const VIEWPORTS = [
  { label: 'mobile-375', width: 375, height: 812 },
  { label: 'tablet-834', width: 834, height: 1194 },
] as const

for (const vp of VIEWPORTS) {
  test.describe(`Modali conferma responsive @viewport:${vp.label}`, () => {
    test.describe.configure({ mode: 'serial' })
    test.skip(!hasE2eCreds, 'richiede credenziali staging in .env.local.test')

    let tenantId = ''

    test.beforeAll(async () => {
      tenantId = await getTenantIdBySlug(TENANT_SLUG)
    })

    test.afterEach(async () => {
      if (tenantId) await deleteBookingsByPrefix(tenantId).catch(() => {})
    })

    test.beforeEach(async ({ page }) => {
      await loginAdmin(page)
    })

    test(`Rifiuta — textarea piena, bottoni in viewport (${vp.width}px)`, async ({ page }) => {
      const date = todayIsoDate()
      const pendingId = await insertBooking({
        tenantId,
        clientName: `${E2E_BOOKING_PREFIX}Reject-${vp.label}`,
        status: 'pending',
        desiredDate: date,
        desiredTime: '20:00',
        numGuests: 2,
      })

      const rejectName = `${E2E_BOOKING_PREFIX}Reject-${vp.label}`
      await goToPrenotazioni(page)
      await expandPendingCard(page, rejectName)
      await page.getByRole('button', { name: /^rifiuta$/i }).first().click()

      const dialog = page.getByRole('dialog').filter({ hasText: /rifiuta prenotazione/i })
      await expect(dialog).toBeVisible({ timeout: 8000 })

      const textarea = dialog.locator('#rejection-reason-textarea')
      await textarea.fill(LONG_REASON)
      await expectDialogButtonsInViewport(page, dialog, /rifiuta prenotazione/i)

      await dialog.getByRole('button', { name: /annulla/i }).click()
      await expect(dialog).not.toBeVisible()
      await expect.poll(() => getBookingStatus(pendingId)).toBe('pending')
    })

    test(`Elimina — textarea piena, bottoni in viewport (${vp.width}px)`, async ({ page }) => {
      const date = todayIsoDate()
      const time = '20:00'
      const { start, end } = isoStartEnd(date, time)

      const deleteName = `${E2E_BOOKING_PREFIX}Delete-${vp.label}`
      const acceptedId = await insertBooking({
        tenantId,
        clientName: deleteName,
        status: 'accepted',
        desiredDate: date,
        desiredTime: time,
        numGuests: 2,
        confirmedStart: start,
        confirmedEnd: end,
      })

      await page.goto('/admin/calendario')
      await page.getByRole('button', { name: new RegExp(deleteName, 'i') }).first().click()

      await expect(page.getByRole('heading', { name: /dettagli prenotazione/i })).toBeVisible({
        timeout: 10000,
      })
      await page.getByRole('button', { name: /^elimina$/i }).click()

      const confirmDialog = page.getByRole('dialog').filter({ hasText: /elimina prenotazione accettata/i })
      await expect(confirmDialog).toBeVisible({ timeout: 8000 })

      const textarea = confirmDialog.locator('textarea').first()
      await textarea.fill(LONG_REASON)
      await expectDialogButtonsInViewport(page, confirmDialog, /elimina prenotazione/i)

      await confirmDialog.getByRole('button', { name: /annulla/i }).click()
      await expect(confirmDialog).not.toBeVisible()
      await expect.poll(() => getBookingStatus(acceptedId)).toBe('accepted')
    })
  })
}
