import { test, expect } from '@playwright/test';

test.describe('Debug: Check all input names in supplier section with detailed output', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/login');
    await page.fill('input[name="email"]', 'admin@erp.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 60000 });
    await page.waitForTimeout(3000);
  });

  test('Debug: Check all input names in supplier section with console.log', async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/po/create');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click PO Supplier
    await page.locator('button:has-text("PO Supplier")').first().click();
    await page.waitForTimeout(2000);

    // Select project
    await page.locator('select').first().selectOption({ value: '2' });
    await page.waitForTimeout(3000);

    // Log all inputs with their attributes
    console.log('\n=== DETAILED INPUT DUMP ===');
    const inputs = await page.locator('input').all();
    for (const input of inputs) {
      const name = await input.getAttribute('name');
      const placeholder = await input.getAttribute('placeholder');
      const value = await input.getAttribute('value');
      const type = await input.getAttribute('type');
      const visible = await input.isVisible();
      const id = await input.getAttribute('id');
      const className = await input.getAttribute('class');
      
      if (name || placeholder || value) {
        console.log(`INPUT: name="${name}" placeholder="${placeholder}" value="${value}" type="${type}" visible="${visible}" id="${id}" class="${className}"`);
      }
    }

    // Check for any element containing "supplier" (case insensitive)
    const supplierElements = await page.locator('*').all();
    for (const el of supplierElements) {
      const outerHTML = await el.getAttribute('outerHTML') || '';
      if (outerHTML.toLowerCase().includes('supplier') && outerHTML.length < 1000) {
        const tagName = await el.evaluate(el => el.tagName.toLowerCase());
        const className = await el.getAttribute('class');
        const name = await el.getAttribute('name');
        const placeholder = await el.getAttribute('placeholder');
        console.log(`ELEMENT WITH "supplier": <${tagName}> class="${className}" name="${name}" placeholder="${placeholder}"`);
        console.log(`  HTML: ${outerHTML.substring(0, 300)}`);
      }
    }
  });
});