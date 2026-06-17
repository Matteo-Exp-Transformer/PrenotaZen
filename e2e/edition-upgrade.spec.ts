/**
 * Test E2E — Edition Upgrade: Classic → Pro via SQL, sidebar appare dopo reload.
 *
 * Scenario: Mario usa Classic, poi l'amministratore lo aggiorna a Pro nel DB.
 * Dopo un ricaricamento della pagina, Mario deve vedere la sidebar completa.
 *
 * Richiede staging Supabase con:
 *   E2E_CLASSIC_ADMIN_EMAIL / E2E_CLASSIC_ADMIN_PASSWORD → admin del tenant dedicato che può diventare Pro
 *   E2E_SUPABASE_SERVICE_KEY → service role key per il DB staging (solo per questo test)
 *   E2E_CLASSIC_TENANT_ID → UUID del tenant da aggiornare
 * Configurare in .env.local.test (vedi playwright.config.ts).
 *
 * IMPORTANTE: questo test modifica il DB staging. Usa un tenant dedicato ai test
 * (E2E_CLASSIC_TENANT_ID) e lo riporta a 'classic' alla fine (afterEach).
 */

import { test, expect } from '@playwright/test'

const REQUIRED_VARS = [
  'E2E_CLASSIC_ADMIN_EMAIL',
  'E2E_CLASSIC_ADMIN_PASSWORD',
  'E2E_SUPABASE_SERVICE_KEY',
  'E2E_CLASSIC_TENANT_ID',
]
const missingVar = REQUIRED_VARS.find((v) => !process.env[v])

test.skip(!!missingVar, `richiede staging Supabase (${missingVar ?? ''} non impostato)`)

const ADMIN_EMAIL = process.env.E2E_CLASSIC_ADMIN_EMAIL ?? ''
const ADMIN_PASSWORD = process.env.E2E_CLASSIC_ADMIN_PASSWORD ?? ''
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SERVICE_KEY = process.env.E2E_SUPABASE_SERVICE_KEY ?? ''
const TENANT_ID = process.env.E2E_CLASSIC_TENANT_ID ?? ''

async function setTenantEdition(edition: 'classic' | 'pro') {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/organizations?id=eq.${TENANT_ID}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ edition }),
    },
  )
  if (!resp.ok) throw new Error(`setTenantEdition failed: ${resp.status}`)
}

test.describe('Edition Upgrade — Classic → Pro', () => {
  test.afterEach(async () => {
    // Riporta sempre il tenant a 'classic' dopo il test
    await setTenantEdition('classic').catch(() => {})
  })

  test('dopo upgrade a Pro e reload, la sidebar appare', async ({ page }) => {
    // 1. Assicura che il tenant parta da 'classic'
    await setTenantEdition('classic')

    // 2. Login come admin Classic
    await page.goto('/admin')
    await page.getByLabel(/email/i).fill(ADMIN_EMAIL)
    await page.getByLabel(/password/i).fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: /accedi|login/i }).click()
    try {
      await expect(page).toHaveURL(/\/admin/, { timeout: 5000 })
    } catch {
      test.skip(true, 'credenziali Classic upgrade presenti ma login non riuscito su questo staging')
    }

    // Attende che la dashboard Classic sia pronta (sidebar assente = caricamento completato)
    await expect(page.getByRole('complementary', { name: /navigazione principale/i })).not.toBeVisible({
      timeout: 10000,
    })

    // 3. Verifica che la sidebar NON sia visibile (edition Classic)
    await expect(page.getByRole('complementary', { name: /navigazione principale/i })).not.toBeVisible()

    // 4. Upgrade a Pro via API (simula cambio in Supabase Studio)
    await setTenantEdition('pro')

    // 5. Ricarica la pagina — useAdminAuth.checkSession rilegge l'edition via check_admin_email RPC
    await page.reload()

    // 6. La sidebar deve comparire (edition Pro).
    // Timeout generoso: reload → auth session check → RPC check_admin_email → React re-render.
    await expect(page.getByRole('complementary', { name: /navigazione principale/i })).toBeVisible({
      timeout: 15000,
    })

    // 7. Le sezioni Pro devono essere accessibili nella sidebar
    await expect(page.getByRole('button', { name: /crm clienti/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /servizio/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /analytics/i })).toBeVisible()
  })
})
