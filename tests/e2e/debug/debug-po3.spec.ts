import { test, expect } from '@playwright/test';

test.describe('Debug: PO Create Page after PO Supplier click', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/login');
    await page.fill('input[name="email"]', 'admin@erp.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 60000 });
    await page.waitForTimeout(3000);
  });

  test('Debug PO Create Page after PO Supplier click', async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/po/create');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click PO Supplier
    await page.locator('button:has-text("PO Supplier")').first().click();
    await page.waitForTimeout(500);

    // Dump ALL inputs with all attributes
    const inputs = await page.locator('input').all();
    console.log('\n=== ALL INPUTS ON PAGE (after PO Supplier click) ===');
    for (const input of inputs) {
      const name = await input.getAttribute('name');
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      const visible = await input.isVisible();
      const id = await input.getAttribute('id');
      const value = await input.getAttribute('value');
      if (name || placeholder || value) {
        console.log(`INPUT: name="${name}" type="${type}" placeholder="${placeholder}" value="${value}" visible="${visible}" id="${id}"`);
      }
    }

    // Dump all selects
    const selects = await page.locator('select').all();
    console.log('\n=== ALL SELECTS ON PAGE ===');
    for (const sel of selects) {
      const name = await sel.getAttribute('name');
      const id = await sel.getAttribute('id');
      const visible = await sel.isVisible();
      const options = await sel.locator('option').all();
      console.log(`SELECT: name="${name}" id="${id}" visible="${visible}" options=${options.length}`);
      for (const opt of options.slice(0, 10)) {
        const value = await opt.getAttribute('value');
        const text = await opt.textContent();
        console.log(`  OPTION: value="${value}" text="${text}"`);
      }
    }
  });
});