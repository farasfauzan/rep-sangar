import { test, expect } from '@playwright/test';

test.describe('Debug: PO Create - check React state updates', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/login');
    await page.fill('input[name="email"]', 'admin@erp.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 60000 });
    await page.waitForTimeout(3000);
  });

  test('Debug: Check React rendering and console errors', async ({ page }) => {
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
    await page.waitForTimeout(2000);

    // Select project
    await page.locator('select').first().selectOption({ value: '2' });
    await page.waitForTimeout(3000);

    // Check for supplier fields again
    const supplierNameCount = await page.locator('input[name="supplier_name"]').count();
    const supplierAddressCount = await page.locator('input[name="supplier_address"]').count();
    console.log('After project select - input[name="supplier_name"] count:', supplierNameCount);
    console.log('input[name="supplier_address"] count:', supplierAddressCount);

    // Check all text content on page
    const pageText = await page.textContent('body');
    const hasSupplierInfo = pageText?.includes('Informasi Supplier');
    console.log('Page contains "Informasi Supplier":', hasSupplierInfo);

    // Check for any error messages
    const errorElements = await page.locator('.text-red-700, .bg-red-100, .alert-error, [role="alert"]').all();
    console.log('Error elements count:', errorElements.length);
    for (const el of errorElements) {
      console.log('Error element:', await el.textContent());
    }
  });
});