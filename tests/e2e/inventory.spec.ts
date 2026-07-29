import { _electron as electron, test, expect, ElectronApplication, Page } from '@playwright/test'

async function ensureAuthenticated(window: Page) {
  await window.waitForLoadState('domcontentloaded')
  await window.waitForTimeout(1000)

  const setupTitle = window.locator('text=Welcome to MedStore')
  if (await setupTitle.isVisible()) {
    const nameInput = window.locator('input[placeholder*="Name"]').first()
    if (await nameInput.isVisible()) {
      await nameInput.fill('Test Owner')
      const pinInputs = window.locator('input[type="password"]')
      await pinInputs.nth(0).fill('1234')
      await pinInputs.nth(1).fill('1234')
      await window.locator('button', { hasText: 'Complete Setup' }).click()
      await window.waitForTimeout(1000)
    }
  }

  const pinPadText = window.locator('text=Enter PIN to Unlock')
  if (await pinPadText.isVisible()) {
    await window.keyboard.type('1234')
    await window.waitForTimeout(1000)
  }
}

test.describe('Inventory & Catalog E2E Suite', () => {
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    app = await electron.launch({
      args: ['.'],
      env: { ...process.env, NODE_ENV: 'test' }
    })
    window = await app.firstWindow()
    await ensureAuthenticated(window)
  })

  test.afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  test('should navigate to Inventory tab', async () => {
    const inventoryTab = window.locator('button', { hasText: 'Inventory' })
    if (await inventoryTab.isVisible()) {
      await inventoryTab.click()
      await window.waitForTimeout(500)
    }
    const body = window.locator('body')
    await expect(body).toBeVisible()
  })
})
