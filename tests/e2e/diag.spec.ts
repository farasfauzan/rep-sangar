import { test, expect } from '@playwright/test';

test('DIAG: login admin then dump sidebar + console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  console.log('LOGIN PAGE TITLE:', await page.title());

  await page.fill('input[name="email"]', 'admin@erp.com');
  await page.fill('input[name="password"]', 'password');
  await page.click('button[type="submit"]');

  try {
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    console.log('REDIRECTED to dashboard OK');
  } catch (e) {
    console.log('NO REDIRECT. Current URL:', page.url());
    const body = await page.locator('body').textContent().catch(() => '');
    console.log('BODY TEXT (first 500):', (body || '').slice(0, 500));
  }

  const sidebarCount = await page.locator('aside nav a').count().catch(() => -1);
  console.log('SIDEBAR LINK COUNT:', sidebarCount);

  console.log('CONSOLE ERRORS:', JSON.stringify(errors, null, 2));
});
