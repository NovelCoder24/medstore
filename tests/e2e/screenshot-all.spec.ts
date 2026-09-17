import { _electron as electron, test, ElectronApplication, Page } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

const ARTIFACT_DIR = 'C:\\Users\\sahub\\.gemini\\antigravity\\brain\\65e7c5b8-ef7e-4762-aff0-4ac9df4ea243'

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
      await window.waitForTimeout(1500)
    }
  }

  const pinPadText = window.locator('text=Enter PIN')
  if (await pinPadText.isVisible()) {
    console.log('PinPad visible, clicking 1, 2, 3, 4...')
    for (const d of ['1', '2', '3', '4']) {
      await window.locator(`button:has-text("${d}")`).first().click()
      await window.waitForTimeout(100)
    }
    await window.waitForTimeout(2000)
  }
}

test('Capture screenshots of all views', async () => {
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, NODE_ENV: 'test' }
  })

  const window = await app.firstWindow()
  await window.setViewportSize({ width: 1440, height: 900 })
  await ensureAuthenticated(window)

  async function take(filename: string) {
    const filePath = path.join(ARTIFACT_DIR, filename)
    await window.waitForTimeout(700)
    await window.screenshot({ path: filePath })
    console.log(`Saved screenshot: ${filePath}`)
  }

  await take('screen_initial.png')
  console.log('Window title:', await window.title())
  console.log('Body text preview:', (await window.locator('body').innerText()).slice(0, 300))

  // 1. Dashboard
  const dashboardBtn = window.locator('nav button', { hasText: 'Dashboard' })
  if (await dashboardBtn.isVisible()) {
    await dashboardBtn.click()
    await take('screen_dashboard.png')
  }

  // 2. POS Billing
  const posBtn = window.locator('nav button', { hasText: 'POS Billing' })
  if (await posBtn.isVisible()) {
    await posBtn.click()
    await take('screen_pos_billing.png')
  }

  // 3. Purchases - Inward Stock
  const purchasesBtn = window.locator('nav button', { hasText: 'Purchases' })
  if (await purchasesBtn.isVisible()) {
    await purchasesBtn.click()
    await take('screen_purchases_inward.png')

    // Purchases - Review Queue tab
    const reviewQueueTab = window.locator('button', { hasText: 'Review Queue' })
    if (await reviewQueueTab.isVisible()) {
      await reviewQueueTab.click()
      await take('screen_purchases_ocr_queue.png')

      const reviewBtn = window.locator('button', { hasText: 'Review & Inward' }).first()
      if (await reviewBtn.isVisible()) {
        await reviewBtn.click()
        await window.waitForTimeout(1500)
        await take('screen_purchases_review_active.png')
      }
    }

    // Purchases - History tab
    const historyTab = window.locator('button', { hasText: 'Past Purchase Invoices' })
    if (await historyTab.isVisible()) {
      await historyTab.click()
      await take('screen_purchases_history.png')
    }
  }

  // 4. Inventory
  const invBtn = window.locator('nav button', { hasText: 'Inventory' })
  if (await invBtn.isVisible()) {
    await invBtn.click()
    await take('screen_inventory.png')
  }

  // 5. Customers
  const custBtn = window.locator('nav button', { hasText: 'Customers' })
  if (await custBtn.isVisible()) {
    await custBtn.click()
    await take('screen_customers.png')
  }

  // 6. Suppliers
  const suppBtn = window.locator('nav button', { hasText: 'Suppliers' })
  if (await suppBtn.isVisible()) {
    await suppBtn.click()
    await take('screen_suppliers.png')
  }

  // 7. Sales History
  const salesHistBtn = window.locator('nav button', { hasText: 'Sales History' })
  if (await salesHistBtn.isVisible()) {
    await salesHistBtn.click()
    await take('screen_sales_history.png')
  }

  // 8. Drug Register
  const drugRegBtn = window.locator('nav button', { hasText: 'Drug Register' })
  if (await drugRegBtn.isVisible()) {
    await drugRegBtn.click()
    await take('screen_drug_register.png')
  }

  // 9. Staff
  const staffBtn = window.locator('nav button', { hasText: 'Staff' })
  if (await staffBtn.isVisible()) {
    await staffBtn.click()
    await take('screen_staff.png')
  }

  // 10. Audit Trail
  const auditBtn = window.locator('nav button', { hasText: 'Audit Trail' })
  if (await auditBtn.isVisible()) {
    await auditBtn.click()
    await take('screen_audit_trail.png')
  }

  // 11. Settings
  const settingsBtn = window.locator('button', { hasText: 'Settings' })
  if (await settingsBtn.isVisible()) {
    await settingsBtn.click()
    await take('screen_settings.png')
  }

  await app.close()
})
