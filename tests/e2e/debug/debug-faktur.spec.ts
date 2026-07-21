import { test, expect } from '@playwright/test';

const CREDENTIALS = {
  admin: { email: 'admin@erp.com', password: 'password' },
};

async function loginAs(page, role) {
  const creds = CREDENTIALS[role];
  await page.goto('/login');
  await page.fill('input[name="email"]', creds.email);
  await page.fill('input[name="password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 30000 });
  await page.waitForTimeout(2000);
}

test('Debug Faktur Pajak page', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  await loginAs(page, 'admin');
  await page.goto('/faktur-pajak');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);

  const url = page.url();
  const title = await page.title();
  const bodyText = await page.locator('body').textContent().catch(() => 'N/A');
  const headingCount = await page.locator('h1, h2, h3').count();
  const html = await page.content();

  console.log(`URL: ${url}`);
  console.log(`Title: ${title}`);
  console.log(`Heading count: ${headingCount}`);
  console.log(`Body text (first 500): ${bodyText?.substring(0, 500)}`);
  console.log(`Console errors: ${JSON.stringify(errors)}`);
  console.log(`HTML length: ${html.length}`);
  console.log(`Has aside: ${html.includes('aside')}`);
  console.log(`Has Faktur: ${html.includes('Faktur')}`);
});
