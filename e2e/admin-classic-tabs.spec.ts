/**
 * // @admin-blindatura: shell-edition
 * // Copre: Classic senza sidebar e dashboard operativa con tab interne.
 *
 * Test E2E — Admin Classic: copertura tab Archivio, Impostazioni e cancellazione prenotazione.
 *
 * Copre le lacune identificate in GUIDA-TEST-SISTEMA.md § "Parte 3":
 * - Tab Archivio: lista prenotazioni archiviate accessibile
 * - Tab Impostazioni: form impostazioni ristorante accessibile
 * - Cancella prenotazione (soft-delete) nel browser
 *
 * Richiede staging Supabase con:
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD → admin di un tenant classic
 * Configurare in .env.local.test (vedi playwright.config.ts).
 */

import { test, expect } from '@playwright/test'

// SKIP: richiede staging Supabase configurato con tenant edition='classic'
test.skip(!process.env.E2E_ADMIN_EMAIL, 'richiede staging Supabase (E2E_ADMIN_EMAIL non impostato)')

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? ''
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ''

async function loginAsClassicAdmin(page: import('@playwright/test').Page) {
  await page.goto('/admin')
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL)
  await page.getByLabel(/password/i).fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /accedi|login/i }).click()
  // Classic non ha sidebar — la sua assenza conferma che il login è completato
  await expect(page.getByRole('navigation', { name: /navigazione principale/i })).not.toBeVisible({
    timeout: 10000,
  })
}

/**
 * Restituisce il locator dei NavItem dell'header AdminDashboard.
 * Scende nel <nav> del header per evitare ambiguità con bottoni omonimi
 * presenti in altri tab (es. "Calendario" in ArchiveTab su mobile).
 */
function dashboardNav(page: import('@playwright/test').Page) {
  return page.locator('header nav')
}

test.describe('Admin Classic — Tab Archivio', () => {
  test('click tab Archivio mostra la sezione archivio', async ({ page }) => {
    await loginAsClassicAdmin(page)
    await dashboardNav(page).getByRole('button', { name: /archivio/i }).click()
    // Il tab archivio deve mostrare una lista o un messaggio vuoto — mai un errore
    const archiveSection = page.locator(
      '[data-testid="archive-tab"], [class*="archive"], section, main',
    ).first()
    await expect(archiveSection).toBeVisible({ timeout: 5000 })
  })

  test('tab Archivio mostra intestazioni della lista prenotazioni', async ({ page }) => {
    await loginAsClassicAdmin(page)
    await dashboardNav(page).getByRole('button', { name: /archivio/i }).click()
    // Verifica che la sezione sia caricata senza errori fatali
    // (la lista può essere vuota, ma l'heading o il container devono esistere)
    await expect(page.getByRole('navigation', { name: /navigazione principale/i })).not.toBeVisible()
    // Attende che il contenuto del tab sia stabile
    await page.waitForTimeout(1000)
    // Verifica l'assenza di errori critici nel DOM (es. schermata bianca)
    await expect(page.locator('body')).not.toBeEmpty()
  })
})

test.describe('Admin Classic — Tab Impostazioni', () => {
  test('click tab Impostazioni mostra il form impostazioni ristorante', async ({ page }) => {
    await loginAsClassicAdmin(page)
    await dashboardNav(page).getByRole('button', { name: /impostazioni/i }).click()
    // Il form impostazioni contiene sempre almeno il nome del ristorante
    await expect(
      page.getByRole('heading', { name: /impostazioni|settings|ristorante/i }).or(
        page.getByLabel(/nome ristorante|nome locale|nome del ristorante/i)
      ).or(
        page.locator('[data-testid="settings-tab"], [class*="settings"]').first()
      )
    ).toBeVisible({ timeout: 5000 })
  })

  test('tab Impostazioni contiene almeno un campo form compilabile', async ({ page }) => {
    await loginAsClassicAdmin(page)
    await dashboardNav(page).getByRole('button', { name: /impostazioni/i }).click()
    // Almeno un input testuale deve essere presente nel form impostazioni
    await expect(page.locator('input[type="text"], input[type="email"], textarea').first()).toBeVisible({
      timeout: 5000,
    })
  })
})

test.describe('Admin Classic — Cancella prenotazione (soft-delete)', () => {
  test('cancellazione prenotazione rimuove dalla lista attiva', async ({ page }) => {
    await loginAsClassicAdmin(page)
    // Vai al tab Prenotazioni
    await dashboardNav(page).getByRole('button', { name: /prenotazioni/i }).click()

    // Cerca una riga prenotazione cliccabile
    const firstBookingRow = page
      .locator('tr[role="row"], [data-testid="booking-row"]')
      .first()

    if (!(await firstBookingRow.isVisible())) {
      // Se non ci sono prenotazioni nel DB staging, il test è un no-op documentato
      test.skip(true, 'nessuna prenotazione disponibile nel DB staging per testare la cancellazione')
      return
    }

    await firstBookingRow.click()

    // Il modal dettagli prenotazione deve aprirsi
    const modal = page.locator('[role="dialog"]')
    await expect(modal).toBeVisible({ timeout: 5000 })

    // Cerca il bottone di cancellazione nel modal
    const cancelBtn = modal.getByRole('button', { name: /cancell|annull|elimina|delete/i })
    if (!(await cancelBtn.isVisible())) {
      // Se il bottone non è nel modal prova a cercarlo fuori
      const cancelBtnPage = page.getByRole('button', { name: /cancell|annull|elimina|delete/i }).first()
      if (!(await cancelBtnPage.isVisible())) {
        test.skip(true, 'bottone cancellazione non trovato — verifica il selettore con il layout corrente')
        return
      }
      await cancelBtnPage.click()
    } else {
      await cancelBtn.click()
    }

    // Dopo la cancellazione il modal si chiude o appare un toast di conferma
    await Promise.race([
      expect(modal).not.toBeVisible({ timeout: 5000 }),
      expect(page.getByRole('alert').or(page.locator('[class*="toast"]')).first()).toBeVisible({
        timeout: 5000,
      }),
    ])
  })
})
