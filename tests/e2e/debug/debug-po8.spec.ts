import { test, expect } from '@playwright/test';

test.describe('Debug: Check actual input names in supplier section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/login');
    await page.fill('input[name="email"]', 'admin@erp.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 60000 });
    await page.waitForTimeout(3000);
  });

  test('Debug: Check all input names in supplier section', async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/po/create');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click PO Supplier
    await page.locator('button:has-text("PO Supplier")').first().click();
    await page.waitForTimeout(2000);

    // Select project
    await page.locator('select').first().selectOption({ value: '2' });
    await page.waitForTimeout(3000);

    // Dump ALL elements with "supplier" in any attribute
    const allElements = await page.locator('*').all();
    for (const el of allElements) {
      const outerHTML = await el.getAttribute('outerHTML') || '';
      if (outerHTML.toLowerCase().includes('supplier')) {
        const tagName = await el.evaluate(el => el.tagName.toLowerCase());
        const className = await el.getAttribute('class');
        const name = await el.getAttribute('name');
        const placeholder = await el.getAttribute('placeholder');
        if (outerHTML.length < 500) {
          console.log(`ELEMENT: <${tagName}> class="${className}" name="${name}" placeholder="${placeholder}"`);
          console.log(`  HTML: ${outerHTML.substring(0, 300)}`);
        }
      }
    }
  });
});