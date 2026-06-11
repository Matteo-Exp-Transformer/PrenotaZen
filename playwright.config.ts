import { defineConfig, devices } from '@playwright/test'
import fs from 'fs'

// Carica .env.local.test se presente (staging Supabase per E2E).
// Non sovrascrive variabili già impostate (es. in CI).
if (fs.existsSync('.env.local.test')) {
  process.loadEnvFile('.env.local.test')
}

/**
 * I test e2e richiedono un progetto Supabase staging separato.
 * Credenziali da impostare in .env.local.test (gitignored):
 *   VITE_SUPABASE_URL=https://<staging-project>.supabase.co
 *   VITE_SUPABASE_ANON_KEY=<staging-anon-key>
 *   E2E_ADMIN_EMAIL=admin-classic@test.local
 *   E2E_ADMIN_PASSWORD=TestE2E2026!
 *   E2E_TENANT_SLUG=ristorante-test-classic
 *   E2E_CLASSIC_TENANT_ID=22222222-2222-2222-2222-222222222222
 *   E2E_SUPABASE_SERVICE_KEY=<service-role-key-staging>
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Autosave OFF in E2E: il guard logout/dirty su anagrafica segue il comportamento prod (FU-004).
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    env: {
      VITE_SETTINGS_AUTOSAVE: 'false',
    },
  },
})
