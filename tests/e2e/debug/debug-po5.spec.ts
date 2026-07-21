import { test, expect } from '@playwright/test';

test.describe('Debug: PO Create Page - step by step', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/login');
    await page.fill('input[name="email"]', 'admin@erp.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 60000 });
    await page.waitForTimeout(3000);
  });

  test('Debug: PO Create - step by step with screenshots', async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/po/create');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 1. Initial state - dump all visible elements
    console.log('\n=== INITIAL STATE ===');
    const buttons = await page.locator('button').all();
    for (const btn of buttons) {
      const text = await btn.textContent();
      const classes = await btn.getAttribute('class');
      if (text && text.trim()) console.log(`BUTTON: "${text.trim()}" classes="${classes}"`);
    }

    // 2. Click PO Supplier
    console.log('\n=== CLICKING PO SUPPLIER ===');
    await page.locator('button:has-text("PO Supplier")').first().click();
    await page.waitForTimeout(2000);

    // Dump all inputs after click
    console.log('\n=== INPUTS AFTER PO SUPPLIER CLICK ===');
    const inputs = await page.locator('input').all();
    for (const input of inputs) {
      const name = await input.getAttribute('name');
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      const visible = await input.isVisible();
      if (name || placeholder) {
        console.log(`INPUT: name="${name}" placeholder="${placeholder}" visible="${visible}"`);
      }
    }

    // Check for PO Supplier text visibility (maybe it's a toggle)
    const poSupplierBtn = page.locator('button:has-text("PO Supplier")').first();
    const classes = await poSupplierBtn.getAttribute('class');
    console.log(`PO Supplier button classes: ${classes}`);

    // Wait longer and check again
    await page.waitForTimeout(3000);
    console.log('\n=== INPUTS AFTER 3s WAIT ===');
    const inputs2 = await page.locator('input').all();
    for (const input of inputs2) {
      const name = await input.getAttribute('name');
      const placeholder = await input.getAttribute('placeholder');
      const visible = await input.isVisible();
      if (name || placeholder) {
        console.log(`INPUT: name="${name}" placeholder="${placeholder}" visible="${input.isVisible()}"`);
      }
    }

    // Check the exact HTML structure for supplier fields
    const supplierNameInput = await page.locator('input[name="supplier_name"]').count();
    console.log(`\ninput[name="supplier_name"] count: ${supplierNameInput}`);
  });
});