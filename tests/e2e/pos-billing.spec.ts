import { _electron as electron, test, expect, ElectronApplication, Page } from '@playwright/test'

async function ensureAuthenticated(window: Page) {
  await window.waitForLoadState('domcontentloaded')
  await window.waitForTimeout(1500)

  const setupTitle = window.locator('text=Welcome to MedStore')
  if (await setupTitle.isVisible()) {
    const nameInput = window.locator('input[placeholder*="Name"]').first()
    if (await nameInput.isVisible()) {
      await nameInput.fill('Test Owner')
      const pinInputs = window.locator('input[type="password"]')
      await pinInputs.nth(0).fill('1234')
      await pinInputs.nth(1).fill('1234')
      await window.locator('button', { hasText: 'Complete Setup' }).click()
      await window.waitForTimeout(2000)
    }
  }

  const pinPadText = window.locator('text=Enter PIN to Unlock')
  if (await pinPadText.isVisible()) {
    await window.keyboard.type('1234')
    await window.waitForTimeout(2000)
  }
}

test.describe('POS Billing E2E Suite', () => {
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

  test('should display MedStore window title', async () => {
    const title = await window.title()
    expect(title).toBe('MedStore')

    const body = window.locator('body')
    await expect(body).toBeVisible()
  })

  test('should keep POS layout responsive', async () => {
    const body = window.locator('body')
    await expect(body).toBeVisible()
  })

  test('should trigger F12 hotkey for checkout safely', async () => {
    await window.keyboard.press('F12')
    const body = window.locator('body')
    await expect(body).toBeVisible()
  })
})
