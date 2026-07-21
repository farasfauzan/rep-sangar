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

  test('Debug PO Create Page - after PO Supplier click', async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/po/create');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click PO Supplier button
    await page.locator('button:has-text("PO Supplier")').first().click();
    await page.waitForTimeout(500);

    // Dump ALL selects
    const selects = await page.locator('select').all();
    console.log('\n=== ALL SELECTS ON PAGE (after PO Supplier click) ===');
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

    // Dump all inputs
    const inputs = await page.locator('input').all();
    console.log('\n=== ALL INPUTS ON PAGE (after PO Supplier click) ===');
    for (const input of inputs) {
      const name = await input.getAttribute('name');
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      const visible = await input.isVisible();
      if (name || placeholder) {
        console.log(`INPUT: name="${name}" type="${type}" placeholder="${placeholder}" visible="${visible}"`);
      }
    }

    // Dump all buttons
    const buttons = await page.locator('button').all();
    console.log('\n=== BUTTONS ===');
    for (const btn of buttons) {
      const text = await btn.textContent();
      const type = await btn.getAttribute('type');
      if (text && text.trim()) {
        console.log(`BUTTON: "${text.trim()}" type="${type}"`);
      }
    }
  });
});