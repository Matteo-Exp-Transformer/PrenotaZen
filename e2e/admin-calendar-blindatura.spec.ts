/**
 * @admin-blindatura: calendario-e2e
 * Copre: badge riempimento mese, digest con accettate/no-show/pending, e scorciatoia
 * "+ Nuova prenotazione" con data pre-selezionata.
 *
 * Pre-requisiti staging (.env.local.test):
 *   E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_TENANT_SLUG, E2E_SUPABASE_SERVICE_KEY
 */
import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  deleteAllServiceSlots,
  deleteBookingsByPrefix,
  getExistingTenantSlug,
  getRestaurantSettingSnapshot,
  getServiceSlotsSnapshot,
  getTenantIdBySlug,
  insertBooking,
  insertServiceSlots,
  isoStartEnd,
  offsetIsoDate,
  patchBookingById,
  restoreRestaurantSettingSnapshot,
  restoreServiceSlotsSnapshot,
  type ServiceSlotsSnapshot,
  upsertRestaurantSettingValue,
} from './helpers/supabaseStaging'

const PREFERRED_TENANT_SLUG = process.env.E2E_CLASSIC_TENANT_SLUG ?? 'test-classic'
/** Slug DB per seed/cleanup: allineato al login Classic (testc@c.com → test-classic). */
const CALENDAR_SEED_TENANT_SLUG = 'test-classic'
const SERVICE_KEY = process.env.E2E_SUPABASE_SERVICE_KEY ?? ''
const ADMIN_CREDENTIALS = [
  { email: 'testc@c.com', password: '123456' },
  { email: process.env.E2E_CLASSIC_ADMIN_EMAIL ?? '', password: process.env.E2E_CLASSIC_ADMIN_PASSWORD ?? '' },
  { email: process.env.E2E_ADMIN_EMAIL ?? '', password: process.env.E2E_ADMIN_PASSWORD ?? '' },
].filter((cred, index, all) =>
  Boolean(cred.email && cred.password) && all.findIndex((item) => item.email === cred.email) === index,
)

const hasE2eCreds = Boolean(ADMIN_CREDENTIALS.length > 0 && SERVICE_KEY)

const CALENDAR_PREFIX = 'E2E-CAL-'

test.use({ viewport: { width: 1280, height: 800 } })

async function loginClassicAdmin(page: Page) {
  for (const credentials of ADMIN_CREDENTIALS) {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.fill('#email', credentials.email)
    await page.fill('#password', credentials.password)
    await page.locator('button[type="submit"]').click()
    try {
      await expect(page).toHaveURL(/\/admin/, { timeout: 8000 })
      return
    } catch {
      // Prova la credenziale successiva: lo staging puo avere .env.local.test obsoleto.
    }
  }
  throw new Error('Login Classic E2E fallito con tutte le credenziali configurate')
}

async function goToCalendar(page: Page) {
  await page.goto('/admin/calendario', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/admin\/calendario/)
  await expect(page.getByRole('heading', { name: /Calendario Prenotazioni/i })).toBeVisible({
    timeout: 15000,
  })
}

function dayCell(page: Page, date: string) {
  return page.locator(`.fc-daygrid-day[data-date="${date}"]`).first()
}

function dayNumber(page: Page, date: string) {
  return dayCell(page, date).locator('.fc-daygrid-day-number').first()
}

function formatDayMonth(date: string): string {
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit' }).format(new Date(date))
}

function slotLabel(name: string, start: string, end: string): string {
  return `${name} ${start} - ${end}`
}

async function openDayDigest(page: Page, date: string) {
  const cell = dayCell(page, date)
  await expect(cell).toBeVisible({ timeout: 15000 })
  await dayNumber(page, date).click()
  const dayDigestHeading = page.getByRole('heading', { name: /Prenotazioni del giorno/i })
  await expect(dayDigestHeading).toBeVisible({ timeout: 15000 })
  await dayDigestHeading.scrollIntoViewIfNeeded()
}

async function slotHeaderLabels(tableOnlySection: Locator): Promise<string[]> {
  const headers = tableOnlySection.locator('.space-y-3 > .space-y-2 > h6')
  await expect(headers.first()).toBeVisible({ timeout: 15000 })
  return headers.allTextContents()
}

async function expectBookingInSlotByIndex(
  tableOnlySection: Locator,
  slotIndex: number,
  bookingName: string,
): Promise<void> {
  const slotBlock = tableOnlySection.locator('.space-y-3 > .space-y-2').nth(slotIndex)
  await expect(slotBlock).toBeVisible()
  await expect(slotBlock).toContainText(bookingName)
}

test.describe('Admin Calendario - smoke', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(!hasE2eCreds, 'richiede credenziali staging in .env.local.test')

  let tenantId = ''
  let tenantSlug = PREFERRED_TENANT_SLUG
  let dailyGuestLimitSnapshot = { exists: false, value: null as unknown }

  test.beforeAll(async () => {
    tenantSlug = await getExistingTenantSlug(CALENDAR_SEED_TENANT_SLUG, ['test-classic'])
    tenantId = await getTenantIdBySlug(tenantSlug)
    dailyGuestLimitSnapshot = await getRestaurantSettingSnapshot(tenantId, 'daily_guest_limit')
    await deleteBookingsByPrefix(tenantId, CALENDAR_PREFIX)
  })

  test.afterAll(async () => {
    if (!tenantId) return
    await deleteBookingsByPrefix(tenantId, CALENDAR_PREFIX).catch(() => {})
    await restoreRestaurantSettingSnapshot(
      tenantId,
      'daily_guest_limit',
      dailyGuestLimitSnapshot,
    ).catch(() => {})
  })

  test.beforeEach(async ({ page }) => {
    await loginClassicAdmin(page)
  })

  // @admin-blindatura: calendario-e2e
  // Copre: mese con badge %/coperti, digest giornaliero, assenza pending/no-show e apertura
  // "Nuova prenotazione" con data pre-selezionata.
  test('badge mese, digest e nuova prenotazione con data selezionata', async ({ page }) => {
    const digestDate = offsetIsoDate(1)
    const formDate = offsetIsoDate(2)
    const badgeName = `${CALENDAR_PREFIX}Badge`
    const pendingName = `${CALENDAR_PREFIX}Pending`
    const noShowName = `${CALENDAR_PREFIX}NoShow`

    await upsertRestaurantSettingValue(tenantId, 'daily_guest_limit', 1)

    const { start, end } = isoStartEnd(digestDate, '20:00')
    await insertBooking({
      tenantId,
      clientName: badgeName,
      status: 'accepted',
      desiredDate: digestDate,
      desiredTime: '20:00',
      numGuests: 3,
      confirmedStart: start,
      confirmedEnd: end,
    })

    await insertBooking({
      tenantId,
      clientName: pendingName,
      status: 'pending',
      desiredDate: digestDate,
      desiredTime: '20:00',
      numGuests: 2,
    })

    const noShowId = await insertBooking({
      tenantId,
      clientName: noShowName,
      status: 'accepted',
      desiredDate: digestDate,
      desiredTime: '21:00',
      numGuests: 2,
      confirmedStart: isoStartEnd(digestDate, '21:00').start,
      confirmedEnd: isoStartEnd(digestDate, '21:00').end,
    })
    await patchBookingById(noShowId, { no_show: true })

    await goToCalendar(page)

    const digestCell = dayCell(page, digestDate)
    await expect(digestCell).toBeVisible({ timeout: 15000 })
    await expect(digestCell.locator('.booking-day-fill')).toBeVisible({ timeout: 15000 })
    await expect(digestCell.locator('.booking-day-fill')).toContainText('%', { timeout: 15000 })
    await expect(digestCell.locator('.booking-day-fill')).toContainText('300%', { timeout: 15000 })

    await dayNumber(page, digestDate).click()
    await expect(page.getByRole('button', { name: new RegExp(`Nuova prenotazione il ${formatDayMonth(digestDate)}`, 'i') })).toBeVisible()

    const digestSection = page.locator('section[aria-labelledby="digest-table-only-heading"]')
    await expect(digestSection).toContainText(badgeName)
    await expect(page.locator('body')).not.toContainText(pendingName)
    await expect(page.locator('body')).not.toContainText(noShowName)

    await dayNumber(page, formDate).click()
    const createButton = page.getByRole('button', {
      name: new RegExp(`Nuova prenotazione il ${formatDayMonth(formDate)}`, 'i'),
    })
    await expect(createButton).toBeVisible({ timeout: 10000 })
    await createButton.click()

    const dialog = page.getByRole('dialog').filter({ hasText: /Nuova prenotazione/i })
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await expect(dialog.locator('#desired_date-control')).toHaveValue(formDate)
  })

  // @admin-blindatura: calendario-e2e
  // Copre: senza limite giornaliero il badge mese mostra solo il conteggio coperti, niente percentuale.
  test('badge mese senza limite giornaliero mostra solo conteggio coperti', async ({ page }) => {
    const noLimitDate = offsetIsoDate(4)
    const noLimitName = `${CALENDAR_PREFIX}NoLimit`
    const { start, end } = isoStartEnd(noLimitDate, '19:30')

    await upsertRestaurantSettingValue(tenantId, 'daily_guest_limit', 0)
    await insertBooking({
      tenantId,
      clientName: noLimitName,
      status: 'accepted',
      desiredDate: noLimitDate,
      desiredTime: '19:30',
      numGuests: 4,
      confirmedStart: start,
      confirmedEnd: end,
    })

    await goToCalendar(page)

    const noLimitCell = dayCell(page, noLimitDate)
    await expect(noLimitCell).toBeVisible({ timeout: 15000 })
    const badge = noLimitCell.locator('.booking-day-fill')
    await expect(badge).toBeVisible({ timeout: 15000 })
    await expect(badge).toHaveText('4', { timeout: 15000 })
    await expect(badge).not.toContainText('%')

    await dayNumber(page, noLimitDate).click()
    await expect(page.locator('body')).toContainText(noLimitName)
  })
})

test.describe('Admin Calendario — ordine fasce digest', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(!hasE2eCreds, 'richiede credenziali staging in .env.local.test')

  const SLOT_IDS = {
    cena: 'e2e00001-0001-4001-8001-000000000001',
    pranzo: 'e2e00001-0001-4001-8001-000000000002',
    aperitivo: 'e2e00001-0001-4001-8001-000000000003',
  } as const

  const SEED_SLOTS = [
    {
      id: SLOT_IDS.cena,
      name: 'E2E Cena',
      start_time: '19:00:00',
      end_time: '22:00:00',
      display_order: 0,
    },
    {
      id: SLOT_IDS.pranzo,
      name: 'E2E Pranzo',
      start_time: '12:00:00',
      end_time: '15:00:00',
      display_order: 1,
    },
    {
      id: SLOT_IDS.aperitivo,
      name: 'E2E Aperitivo',
      start_time: '17:00:00',
      end_time: '19:00:00',
      display_order: 2,
    },
  ] as const

  let tenantId = ''
  let tenantSlug = PREFERRED_TENANT_SLUG
  let serviceSlotsSnapshot: ServiceSlotsSnapshot = { slots: [] }
  let bookingTimeSlotsEnabledSnapshot = { exists: false, value: null as unknown }

  test.beforeAll(async () => {
    tenantSlug = await getExistingTenantSlug(CALENDAR_SEED_TENANT_SLUG, ['test-classic'])
    tenantId = await getTenantIdBySlug(tenantSlug)
    serviceSlotsSnapshot = await getServiceSlotsSnapshot(tenantId)
    bookingTimeSlotsEnabledSnapshot = await getRestaurantSettingSnapshot(
      tenantId,
      'booking_time_slots_enabled',
    )
    await deleteBookingsByPrefix(tenantId, CALENDAR_PREFIX)
  })

  test.afterAll(async () => {
    if (!tenantId) return
    await deleteBookingsByPrefix(tenantId, CALENDAR_PREFIX).catch(() => {})
    await restoreServiceSlotsSnapshot(tenantId, serviceSlotsSnapshot).catch(() => {})
    await restoreRestaurantSettingSnapshot(
      tenantId,
      'booking_time_slots_enabled',
      bookingTimeSlotsEnabledSnapshot,
    ).catch(() => {})
  })

  test.beforeEach(async ({ page }) => {
    await loginClassicAdmin(page)
  })

  // @admin-blindatura: calendario-e2e
  // Copre: digest «Solo tavolo» rispetta display_order salvato (riordino manuale fasce, non cronologico).
  test('digest rispetta display_order fasce e colloca le prenotazioni sotto la fascia corretta', async ({
    page,
  }) => {
    const digestDate = offsetIsoDate(5)
    const cenaName = `${CALENDAR_PREFIX}SlotCena`
    const pranzoName = `${CALENDAR_PREFIX}SlotPranzo`
    const aperitivoName = `${CALENDAR_PREFIX}SlotAper`

    await upsertRestaurantSettingValue(tenantId, 'booking_time_slots_enabled', true)
    await deleteAllServiceSlots(tenantId)
    await insertServiceSlots(
      SEED_SLOTS.map((slot) => ({
        id: slot.id,
        tenant_id: tenantId,
        name: slot.name,
        start_time: slot.start_time,
        end_time: slot.end_time,
        display_order: slot.display_order,
        is_canonical: true,
        max_guests: null,
        max_turns: null,
        max_turns_resume: null,
        slot_color: null,
      })),
    )

    const cenaTimes = isoStartEnd(digestDate, '20:00')
    await insertBooking({
      tenantId,
      clientName: cenaName,
      status: 'accepted',
      desiredDate: digestDate,
      desiredTime: '20:00',
      numGuests: 2,
      confirmedStart: cenaTimes.start,
      confirmedEnd: cenaTimes.end,
    })

    const pranzoTimes = isoStartEnd(digestDate, '13:00')
    await insertBooking({
      tenantId,
      clientName: pranzoName,
      status: 'accepted',
      desiredDate: digestDate,
      desiredTime: '13:00',
      numGuests: 2,
      confirmedStart: pranzoTimes.start,
      confirmedEnd: pranzoTimes.end,
    })

    const aperitivoTimes = isoStartEnd(digestDate, '18:00')
    await insertBooking({
      tenantId,
      clientName: aperitivoName,
      status: 'accepted',
      desiredDate: digestDate,
      desiredTime: '18:00',
      numGuests: 2,
      confirmedStart: aperitivoTimes.start,
      confirmedEnd: aperitivoTimes.end,
    })

    await goToCalendar(page)
    await openDayDigest(page, digestDate)

    const tableOnlySection = page.locator('section[aria-labelledby="digest-table-only-heading"]')
    await expect(tableOnlySection).toBeVisible({ timeout: 15000 })

    const expectedHeaderOrder = [
      slotLabel('E2E Cena', '19:00', '22:00'),
      slotLabel('E2E Pranzo', '12:00', '15:00'),
      slotLabel('E2E Aperitivo', '17:00', '19:00'),
    ]
    await expect.poll(async () => slotHeaderLabels(tableOnlySection)).toEqual(expectedHeaderOrder)

    await expectBookingInSlotByIndex(tableOnlySection, 0, cenaName)
    await expectBookingInSlotByIndex(tableOnlySection, 1, pranzoName)
    await expectBookingInSlotByIndex(tableOnlySection, 2, aperitivoName)
  })
})
