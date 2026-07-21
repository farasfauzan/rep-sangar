import { test } from '@playwright/test';

test('DIAG2: dump admin sidebar menu texts', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="email"]', 'admin@erp.com');
  await page.fill('input[name="password"]', 'password');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  const links = page.locator('aside nav a');
  const n = await links.count();
  console.log('TOTAL LINKS:', n);
  for (let i = 0; i < n; i++) {
    const t = (await links.nth(i).textContent())?.trim().replace(/\s+/g, ' ');
    console.log(`  [${i}] ${t}`);
  }
});
