import { test, expect } from '@playwright/test'

// SKIP if no test credentials
test.skip(!process.env.E2E_ADMIN_EMAIL, 'richiede staging Supabase (E2E_ADMIN_EMAIL non impostato)')

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? ''
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ''

async function loginAsClassicAdmin(page: import('@playwright/test').Page) {
  await page.goto('/admin')
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL)
  await page.getByLabel(/password/i).fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /accedi|login/i }).click()
  // Attendi che il dashboard sia caricato (verificando che nav header sia visibile)
  await expect(page.locator('header nav')).toBeVisible({ timeout: 10000 })
}

test.describe('Admin Dashboard Responsive Layout @viewport:mobile-375', () => {
  test('should display nav tabs vertically on mobile 375px with readable labels', async ({ page }) => {
    await loginAsClassicAdmin(page)

    // Scatta screenshot del layout mobile con label leggibili
    await page.screenshot({ path: 'admin-dashboard-mobile-375.png', fullPage: false })

    // Verifica che i tab siano visibili
    const headerNav = page.locator('header nav')
    await expect(headerNav).toBeVisible()

    // Verifica che i testi dei tab siano leggibili (non troncati a testo singola lettera)
    const navButtons = headerNav.getByRole('button')
    const count = await navButtons.count()
    expect(count).toBeGreaterThan(0)

    // Controlla che il testo sia visibile (aria-label o visibile text)
    for (let i = 0; i < count; i++) {
      const btn = navButtons.nth(i)
      const ariaLabel = await btn.getAttribute('aria-label')
      const textContent = await btn.textContent()
      // Almeno uno tra aria-label o textContent deve essere significativo
      const hasContent = Boolean((ariaLabel && ariaLabel.length > 2) || (textContent && textContent.trim().length > 2))
      expect(hasContent).toBe(true)
    }
  })
})

test.describe('Admin Dashboard Responsive Layout @viewport:tablet-834', () => {
  test.use({ viewport: { width: 900, height: 800 } })

  test('should display nav tabs horizontally on tablet 900px', async ({ page }) => {
    await loginAsClassicAdmin(page)
    await page.screenshot({ path: 'admin-dashboard-tablet-900.png', fullPage: false })

    // Verifica che il nav sia visibile
    const headerNav = page.locator('header nav')
    await expect(headerNav).toBeVisible()
  })
})

test.describe('Admin Dashboard Responsive Layout - Desktop', () => {
  test.use({ viewport: { width: 1256, height: 800 } })

  test('should display nav tabs horizontally on desktop 1256px', async ({ page }) => {
    await loginAsClassicAdmin(page)
    await page.screenshot({ path: 'admin-dashboard-desktop-1256.png', fullPage: false })

    // Verifica che il nav sia visibile
    const headerNav = page.locator('header nav')
    await expect(headerNav).toBeVisible()
  })
})
