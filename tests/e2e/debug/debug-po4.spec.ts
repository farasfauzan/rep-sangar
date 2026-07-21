import { test, expect } from '@playwright/test';

test.describe('Debug: PO Create Page after PO Supplier click - detailed', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/login');
    await page.fill('input[name="email"]', 'admin@erp.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 60000 });
    await page.waitForTimeout(3000);
  });

  test('Debug PO Create Page - after PO Supplier click, check supplier fields', async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/po/create');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click PO Supplier
    await page.locator('button:has-text("PO Supplier")').first().click();
    await page.waitForTimeout(2000);

    // Dump ALL inputs with full state
    const inputs = await page.locator('input').all();
    console.log('\n=== ALL INPUTS ON PAGE (after PO Supplier click, 2s wait) ===');
    for (const input of inputs) {
      const name = await input.getAttribute('name');
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      const visible = await input.isVisible();
      const id = await input.getAttribute('id');
      const value = await input.getAttribute('value');
      const className = await input.getAttribute('class');
      if (name || placeholder || value) {
        console.log(`INPUT: name="${name}" type="${type}" placeholder="${placeholder}" value="${value}" visible="${visible}" id="${id}" class="${className}"`);
      }
    }

    // Also check for conditional rendering - check if the supplier section exists
    const supplierSection = await page.locator('text=Informasi Supplier').count();
    console.log('\n=== "Informasi Supplier" text count:', supplierSection);

    // Check for all elements with "supplier" in name
    const supplierInputs = await page.locator('[name*="supplier"]').all();
    console.log('\n=== INPUTS WITH "supplier" IN NAME ===');
    for (const input of supplierInputs) {
      const name = await input.getAttribute('name');
      const visible = await input.isVisible();
      const type = await input.getAttribute('type');
      console.log(`  name="${name}" visible="${visible}" type="${type}"`);
    }

    // Also check the po_level radio buttons state
    const poLevelButtons = await page.locator('button:has-text("PO Supplier"), button:has-text("PO Proyek")').all();
    for (const btn of poLevelButtons) {
      const text = await btn.textContent();
      const classes = await btn.getAttribute('class');
      console.log(`PO LEVEL BUTTON: "${text.trim()}" classes="${classes}"`);
    }
  });
});