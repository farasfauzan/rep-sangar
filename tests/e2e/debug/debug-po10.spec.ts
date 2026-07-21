import { test, expect } from '@playwright/test';

test.describe('Debug: Check React console for errors', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/login');
    await page.fill('input[name="email"]', 'admin@erp.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 60000 });
    await page.waitForTimeout(3000);
  });

  test('Debug: Check console errors and React state', async ({ page }) => {
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('CONSOLE ERROR:', msg.text());
      }
    });

    await page.goto('http://127.0.0.1:8000/po/create');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click PO Supplier
    await page.locator('button:has-text("PO Supplier")').first().click();
    await page.waitForTimeout(3000);

    // Select project
    await page.locator('select').first().selectOption({ value: '2' });
    await page.waitForTimeout(5000);

    // Check for any error elements
    const errorElements = await page.locator('.bg-red-100, .text-red-700, .alert-error, [role="alert"], .text-red-700').all();
    console.log('Error elements count:', errorElements.length);
    for (const el of errorElements) {
      console.log('Error element:', await el.textContent());
    }

    // Check if "Informasi Supplier" section exists
    const supplierSection = await page.locator('text=Informasi Supplier').count();
    console.log('"Informasi Supplier" count:', supplierSection);

    // Check all elements with "supplier" in text
    const supplierElements = await page.locator('*').all();
    for (const el of supplierElements) {
      const text = await el.textContent();
      if (text && text.toLowerCase().includes('supplier')) {
        const tagName = await el.evaluate(el => el.tagName.toLowerCase());
        console.log(`FOUND SUPPLIER TEXT: <${el.tagName}> "${text?.substring(0, 100)}"`);
      }
    }
  });
});