import { test, expect } from '@playwright/test';

test.describe('Debug: PO Create Page DOM', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/login');
    await page.fill('input[name="email"]', 'admin@erp.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 60000 });
    await page.waitForTimeout(3000);
  });

  test('Debug PO Create Page - dump all selects', async ({ page }) => {
    await page.locator('aside nav a:has-text("Purchase Orders")').first().click();
    await page.waitForURL('**/po', { timeout: 30000 });
    await page.waitForTimeout(1000);

    await page.locator('a:has-text("Buat PO"), button:has-text("Buat PO")').first().click();
    await page.waitForURL('**/po/create', { timeout: 30000 });
    await page.waitForTimeout(1000);

    // Click PO Supplier
    await page.locator('button:has-text("PO Supplier")').first().click();
    await page.waitForTimeout(500);

    // Dump ALL selects
    const selects = await page.locator('select').all();
    console.log('\n=== ALL SELECTS ON PAGE ===');
    for (const sel of selects) {
      const name = await sel.getAttribute('name');
      const id = await sel.getAttribute('id');
      const visible = await sel.isVisible();
      const options = await sel.locator('option').all();
      console.log(`SELECT: name="${name}" id="${id}" visible="${visible}" options=${options.length}`);
      for (const opt of options.slice(0, 5)) {
        const value = await opt.getAttribute('value');
        const text = await opt.textContent();
        console.log(`  OPTION: value="${value}" text="${text}"`);
      }
    }

    // Dump all inputs
    const inputs = await page.locator('input').all();
    console.log('\n=== ALL INPUTS ON PAGE ===');
    for (const input of inputs) {
      const name = await input.getAttribute('name');
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      const visible = await input.isVisible();
      if (name || placeholder) {
        console.log(`INPUT: name="${name}" type="${type}" placeholder="${placeholder}" visible="${visible}"`);
      }
    }
  });
});