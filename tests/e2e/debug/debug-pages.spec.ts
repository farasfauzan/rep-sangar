import { test, expect } from '@playwright/test';

const CREDENTIALS = {
  admin: { email: 'admin@erp.com', password: 'password' },
  lapangan: { email: 'lapangan@erp.com', password: 'password' },
};

async function loginAs(page, role) {
  const creds = CREDENTIALS[role];
  await page.fill('input[name="email"]', CREDENTIALS[role].email);
  await page.fill('input[name="password"]', CREDENTIALS[role].password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 30000 });
  await page.waitForTimeout(2000);
}

test.describe('Debug: Inspect Real Create Pages', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/login');
    await page.fill('input[name="email"]', 'admin@erp.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    await page.waitForTimeout(2000);
  });

  test('DEBUG: Supplier Create Page - dump all inputs', async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/suppliers/create');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Dump ALL inputs
    const inputs = await page.locator('input, select, textarea').all();
    console.log('\n=== SUPPLIER CREATE PAGE - ALL INPUTS ===');
    for (const input of inputs) {
      const name = await input.getAttribute('name');
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      const id = await input.getAttribute('id');
      const required = await input.getAttribute('required');
      if (name || placeholder) {
        console.log(`INPUT: name="${name}" type="${type}" placeholder="${placeholder}" id="${id}" required="${required}"`);
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

    // Dump all links
    const links = await page.locator('a').all();
    console.log('\n=== LINKS ===');
    for (const link of links) {
      const text = await link.textContent();
      const href = await link.getAttribute('href');
      if (text && text.trim()) {
        console.log(`LINK: "${text.trim()}" href="${href}"`);
      }
    }
  });

  test('DEBUG: PO Create Page - dump all inputs', async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/po/create');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Dump ALL inputs
    const inputs = await page.locator('input, select, textarea').all();
    console.log('\n=== PO CREATE PAGE - ALL INPUTS ===');
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
    console.log('\n=== BUTTONS ===');
    for (const btn of buttons) {
      const text = await btn.textContent();
      const type = await btn.getAttribute('type');
      if (text && text.trim()) {
        console.log(`BUTTON: "${text.trim()}" type="${type}"`);
      }
    }

    // Dump all select options for project
    const projectSelect = page.locator('select[name="project_id"]');
    if (await projectSelect.count() > 0) {
      const options = await projectSelect.locator('option').all();
      console.log('\n=== PROJECT SELECT OPTIONS ===');
      for (const opt of options) {
        const value = await opt.getAttribute('value');
        const text = await opt.textContent();
        console.log(`OPTION: value="${value}" text="${text}"`);
      }
    }
  });

  test('DEBUG: RAB Control Page - dump all tabs/buttons', async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/rab-control');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Dump all buttons
    const buttons = await page.locator('button').all();
    console.log('\n=== RAB CONTROL BUTTONS ===');
    for (const btn of buttons) {
      const text = await btn.textContent();
      if (text && text.trim()) {
        console.log(`BUTTON: "${text.trim()}"`);
      }
    }

    // Dump all tabs/links
    const links = await page.locator('a').all();
    console.log('\n=== RAB LINKS ===');
    for (const link of links) {
      const text = await link.textContent();
      const href = await link.getAttribute('href');
      if (text && text.trim()) {
        console.log(`LINK: "${text.trim()}" href="${href}"`);
      }
    }
  });
});