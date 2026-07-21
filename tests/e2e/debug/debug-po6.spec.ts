import { test, expect } from '@playwright/test';

test.describe('Debug: PO Create - check if PO Supplier click works', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/login');
    await page.fill('input[name="email"]', 'admin@erp.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 60000 });
    await page.waitForTimeout(3000);
  });

  test('Debug: Check PO level toggle and project select', async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/po/create');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 1. Check initial PO level button states
    const poProyekBtn = page.locator('button:has-text("PO Proyek")').first();
    const poSupplierBtn = page.locator('button:has-text("PO Supplier")').first();
    
    const proyekClasses = await poProyekBtn.getAttribute('class');
    const supplierClasses = await poSupplierBtn.getAttribute('class');
    console.log('Initial PO Proyek classes:', proyekClasses);
    console.log('Initial PO Supplier classes:', supplierClasses);

    // 2. Click PO Supplier
    await page.locator('button:has-text("PO Supplier")').first().click();
    await page.waitForTimeout(2000);

    // Check classes after click
    const proyekClasses2 = await poProyekBtn.getAttribute('class');
    const supplierClasses2 = await poSupplierBtn.getAttribute('class');
    console.log('After click PO Proyek classes:', proyekClasses2);
    console.log('After click PO Supplier classes:', supplierClasses2);

    // Check if project select is visible
    const projectSelect = page.locator('select').first();
    const isVisible = await projectSelect.isVisible();
    console.log('Project select visible:', isVisible);

    // Try to select project
    await page.locator('select').first().selectOption({ value: '2' });
    await page.waitForTimeout(2000);

    // Check for supplier fields again
    const supplierNameCount = await page.locator('input[name="supplier_name"]').count();
    const supplierAddressCount = await page.locator('input[name="supplier_address"]').count();
    console.log('input[name="supplier_name"] count:', supplierNameCount);
    console.log('input[name="supplier_address"] count:', supplierAddressCount);

    // Check all text inputs again
    const inputs = await page.locator('input').all();
    for (const input of inputs) {
      const name = await input.getAttribute('name');
      const placeholder = await input.getAttribute('placeholder');
      const visible = await input.isVisible();
      if (name || placeholder) {
        console.log(`INPUT: name="${name}" placeholder="${placeholder}" visible="${await input.isVisible()}"`);
      }
    }
  });
});