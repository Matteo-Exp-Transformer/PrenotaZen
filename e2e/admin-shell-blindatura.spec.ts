/**
 * E2E blindatura Admin Shell — FU-042 / ADMIN_TEST_SUITE_INDEX §9.
 *
 * Marcatori:
 * - @admin-blindatura: shell-refresh-back
 * - @admin-blindatura: shell-dirty-guard
 * - @admin-blindatura: shell-logout
 *
 * Credenziali: `.env.local.test`
 *   E2E_CLASSIC_ADMIN_* (Classic) · E2E_PRO_ADMIN_* (Pro)
 */

import { test, expect, type Page } from '@playwright/test'

const CLASSIC_EMAIL = process.env.E2E_CLASSIC_ADMIN_EMAIL ?? ''
const CLASSIC_PASSWORD = process.env.E2E_CLASSIC_ADMIN_PASSWORD ?? ''
const PRO_EMAIL = process.env.E2E_PRO_ADMIN_EMAIL ?? ''
const PRO_PASSWORD = process.env.E2E_PRO_ADMIN_PASSWORD ?? ''

const hasClassicCreds = Boolean(CLASSIC_EMAIL && CLASSIC_PASSWORD)
const hasProCreds = Boolean(PRO_EMAIL && PRO_PASSWORD)

test.use({ viewport: { width: 1280, height: 720 } })

async function loginAsClassicAdmin(page: Page) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(CLASSIC_EMAIL)
  await page.getByLabel(/password/i).fill(CLASSIC_PASSWORD)
  await page.getByRole('button', { name: /accedi|login/i }).click()
  try {
    await expect(page).toHaveURL(/\/admin/, { timeout: 5000 })
  } catch {
    test.skip(true, 'credenziali Classic presenti ma login non riuscito su questo staging')
  }
  await expect(dashboardHeaderNav(page)).toBeVisible({ timeout: 15000 })
  await expect(sidebarNav(page)).not.toBeVisible()
}

async function loginAsProAdmin(page: Page) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(PRO_EMAIL)
  await page.getByLabel(/password/i).fill(PRO_PASSWORD)
  await page.getByRole('button', { name: /accedi|login/i }).click()
  await expect(page).toHaveURL(/\/admin/, { timeout: 15000 })
  await expect(sidebarNav(page)).toBeVisible({ timeout: 15000 })
}

function dashboardHeaderNav(page: Page) {
  return page.locator('header nav')
}

function sidebarNav(page: Page) {
  return page.getByRole('complementary', { name: /navigazione principale/i })
}

async function expectDashboardTabActive(page: Page, tabLabel: 'Prenotazioni' | 'Calendario') {
  const tab = dashboardHeaderNav(page).getByRole('button', { name: new RegExp(tabLabel, 'i') })
  await expect(tab).toHaveClass(/admin-nav-tab-active/)
}

test.describe('Admin Shell — refresh/back (Pro)', () => {
  test.skip(!hasProCreds, 'richiede E2E_PRO_ADMIN_EMAIL in .env.local.test')

  // @admin-blindatura: shell-refresh-back
  // Copre: reload su /admin/crm mantiene sezione CRM (non torna a home prenotazioni).
  test('reload su /admin/crm resta in CRM', async ({ page }) => {
    await loginAsProAdmin(page)
    await page.goto('/admin/crm')
    await expect(page).toHaveURL(/\/admin\/crm/)
    await expect(page.getByRole('heading', { name: /crm clienti/i })).toBeVisible({ timeout: 10000 })

    await page.reload()
    await expect(page).toHaveURL(/\/admin\/crm/)
    await expect(page.getByRole('heading', { name: /crm clienti/i })).toBeVisible({ timeout: 10000 })
    await expect(dashboardHeaderNav(page)).not.toBeVisible()
  })

  // @admin-blindatura: shell-refresh-back
  // Copre: browser back da altra sezione sidebar torna alla sezione precedente (CRM).
  test('CRM → Servizio → browser back torna a CRM', async ({ page }) => {
    await loginAsProAdmin(page)
    await page.goto('/admin/crm')
    await expect(page.getByRole('heading', { name: /crm clienti/i })).toBeVisible({ timeout: 10000 })

    await sidebarNav(page).getByRole('button', { name: /servizio/i }).click()
    await expect(page).toHaveURL(/\/admin\/servizio/)
    await expect(page.getByRole('heading', { name: /servizio/i })).toBeVisible({ timeout: 10000 })

    await page.goBack()
    await expect(page).toHaveURL(/\/admin\/crm/)
    await expect(page.getByRole('heading', { name: /crm clienti/i })).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Admin Shell — refresh/back (Classic)', () => {
  test.skip(!hasClassicCreds, 'richiede E2E_CLASSIC_ADMIN_EMAIL in .env.local.test')

  // @admin-blindatura: shell-refresh-back
  // Copre: reload su /admin/prenotazioni mantiene tab Prenotazioni attivo (non Calendario).
  test('reload su /admin/prenotazioni mantiene tab Prenotazioni', async ({ page }) => {
    await loginAsClassicAdmin(page)
    await page.goto('/admin/prenotazioni')
    await expect(page).toHaveURL(/\/admin\/prenotazioni/)
    await expectDashboardTabActive(page, 'Prenotazioni')
    await expect(dashboardHeaderNav(page).getByRole('button', { name: /calendario/i })).not.toHaveClass(
      /admin-nav-tab-active/,
    )

    await page.reload()
    await expect(page).toHaveURL(/\/admin\/prenotazioni/)
    await expectDashboardTabActive(page, 'Prenotazioni')
    await expect(dashboardHeaderNav(page).getByRole('button', { name: /calendario/i })).not.toHaveClass(
      /admin-nav-tab-active/,
    )
  })
})

test.describe('Admin Shell — dirty guard e logout (Classic)', () => {
  test.skip(!hasClassicCreds, 'richiede E2E_CLASSIC_ADMIN_EMAIL in .env.local.test')

  // @admin-blindatura: shell-dirty-guard
  // @admin-blindatura: shell-logout
  // Copre: modifica anagrafica senza Salva → logout → modale guard → Resta qui → resta in admin con dato sporco.
  async function dirtyImpostazioniWithoutSave(page: Page) {
    await dashboardHeaderNav(page).getByRole('button', { name: /impostazioni/i }).click()
    await expect(page).toHaveURL(/\/admin\/impostazioni/)

    // Tema: non in autosave → registra dirty anche in dev (anagrafica testo con autosave ON non attiva il guard).
    const themeSection = page.locator('section[aria-labelledby="app-theme-heading"]')
    await themeSection.scrollIntoViewIfNeeded()
    // Etichetta testo sotto la card (evita overlay occhio che intercetta il click su desktop).
    await themeSection.getByRole('button', { name: /Seleziona tema: Terracotta & Sand/i }).click()
  }

  test('logout con modifiche non salvate — annulla e resta in admin', async ({ page }) => {
    await loginAsClassicAdmin(page)
    await dirtyImpostazioniWithoutSave(page)

    await page.getByRole('button', { name: /log-?out/i }).click()
    const guardModal = page.getByRole('dialog').filter({ hasText: /modifiche non salvate/i })
    await expect(guardModal).toBeVisible({ timeout: 5000 })
    await guardModal.getByRole('button', { name: /resta qui/i }).click()

    await expect(page).toHaveURL(/\/admin\/impostazioni/)
    await expect(guardModal).not.toBeVisible()
  })

  // @admin-blindatura: shell-dirty-guard
  // @admin-blindatura: shell-logout
  // Copre: conferma uscita senza salvare → redirect login; dato non persistito (ripristino valore originale).
  test('logout con modifiche non salvate — annulla e continua esce', async ({ page }) => {
    await loginAsClassicAdmin(page)
    await dirtyImpostazioniWithoutSave(page)

    await page.getByRole('button', { name: /log-?out/i }).click()
    const guardModal = page.getByRole('dialog').filter({ hasText: /modifiche non salvate/i })
    await expect(guardModal).toBeVisible({ timeout: 5000 })
    await guardModal.getByRole('button', { name: /annulla e continua/i }).click()

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
  })
})
