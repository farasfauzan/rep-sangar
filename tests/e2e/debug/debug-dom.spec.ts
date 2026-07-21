import { test, expect } from '@playwright/test';

const CREDENTIALS = {
  admin: { email: 'admin@erp.com', password: 'password' },
  lapangan: { email: 'lapangan@erp.com', password: 'password' },
};

async function loginAs(page, role) {
  const creds = CREDENTIALS[role];
  await page.fill('input[name="email"]', creds.email);
  await page.fill('input[name="password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 30000 });
  await page.waitForTimeout(2000);
}

test.describe('Debug: Inspect DOM for Create Pages', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/login');
    await loginAs(page, 'admin');
  });

  test('Debug Supplier Create Page DOM', async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/suppliers/create');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Dump all input fields
    const inputs = await page.locator('input, select, textarea').all();
    for (const input of inputs) {
      const name = await input.getAttribute('name');
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      const id = await input.getAttribute('id');
      if (name || placeholder) {
        console.log(`INPUT: name="${name}" type="${type}" placeholder="${placeholder}" id="${id}"`);
      }
    }

    // Dump all buttons
    const buttons = await page.locator('button').all();
    for (const btn of buttons) {
      const text = await btn.textContent();
      const type = await btn.getAttribute('type');
      console.log(`BUTTON: "${text}" type="${type}"`);
    }

    // Dump all links
    const links = await page.locator('a').all();
    for (const link of links) {
      const text = await link.textContent();
      const href = await link.getAttribute('href');
      if (text && text.trim()) {
        console.log(`LINK: "${text.trim()}" href="${href}"`);
      }
    }
  });

  test('Debug PO Create Page DOM', async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/po/create');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Dump all input fields
    const inputs = await page.locator('input, select, textarea').all();
    for (const input of inputs) {
      const name = await input.getAttribute('name');
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      if (name || placeholder) {
        console.log(`PO INPUT: name="${name}" type="${type}" placeholder="${placeholder}"`);
      }
    }

    // Dump all buttons
    const buttons = await page.locator('button').all();
    for (const btn of buttons) {
      const text = await btn.textContent();
      const type = await btn.getAttribute('type');
      console.log(`PO BUTTON: "${text}" type="${type}"`);
    }
  });

  test('Debug RAB Control Page DOM', async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/rab-control');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const buttons = await page.locator('button, a').all();
    for (const btn of buttons) {
      const text = await btn.textContent();
      const tag = await btn.evaluate(el => el.tagName.toLowerCase());
      if (text && text.trim()) {
        console.log(`RAB ${tag}: "${text.trim()}"`);
      }
    }
  });
});