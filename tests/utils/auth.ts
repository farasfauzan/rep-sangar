import { Page } from '@playwright/test';

export const CREDENTIALS = {
  admin: { email: 'admin@erp.com', password: 'password', roleName: 'ADMIN' },
  lapangan: { email: 'lapangan@erp.com', password: 'password', roleName: 'LAPANGAN' },
  engineer: { email: 'engineer@erp.com', password: 'password', roleName: 'ENGINEER' },
  purchasing: { email: 'purchasing_legal@erp.com', password: 'password', roleName: 'PURCHASING_LEGAL' },
  verifikator: { email: 'verifikator_keu@erp.com', password: 'password', roleName: 'VERIFIKATOR_KEU' },
  mgr_komersial: { email: 'mgr_komersial@erp.com', password: 'password', roleName: 'MGR_KOMERSIAL' },
  keu_kantor: { email: 'keu_kantor@erp.com', password: 'password', roleName: 'KEU_KANTOR' },
  pajak: { email: 'pajak@erp.com', password: 'password', roleName: 'PAJAK' },
  accounting: { email: 'accounting@erp.com', password: 'password', roleName: 'ACCOUNTING' },
};

export async function loginAs(page: Page, role: keyof typeof CREDENTIALS) {
  const creds = CREDENTIALS[role];
  if (!creds) throw new Error(`Role ${role} not found in CREDENTIALS`);

  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  await page.fill('input[name="email"]', creds.email);
  await page.fill('input[name="password"]', creds.password);
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard (Inertia.js)
  await page.waitForURL('**/dashboard', { timeout: 20000 });
  await page.waitForLoadState('domcontentloaded');

  console.log(`✅ Logged in as ${creds.roleName} (${creds.email})`);
  return creds;
}

export async function logout(page: Page) {
  // Click user dropdown (top right navbar)
  try {
    const dropdownTrigger = page.locator('nav button:has-text("Admin"), nav button:has-text("admin"), nav [aria-haspopup="menu"]').first();
    await dropdownTrigger.click({ timeout: 5000 });
    await page.waitForTimeout(500);
  } catch {
    // fallback: try via direct link or skip
  }

  // Click logout link
  try {
    const logoutBtn = page.locator('button:has-text("Log Out"), a:has-text("Log Out")').first();
    await logoutBtn.click({ force: true, timeout: 5000 });
  } catch {
    // fallback to manual navigate
    await page.goto('/');
  }

  // Wait for redirect away from dashboard
  await page.waitForURL(/(\/login$|\/$)/, { timeout: 15000 });
  console.log('✅ Logged out');
}

export async function navigateToMenu(page: Page, menuText: string) {
  const menuLink = page.locator(`aside nav a:has-text("${menuText}")`).first();
  await menuLink.click({ timeout: 10000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
  console.log(`✅ Navigated to ${menuText}`);
}

export const EXPECTED_MENU_COUNTS: Record<string, number> = {
  admin: 15,
  lapangan: 6,
  engineer: 6,
  purchasing: 6,
  verifikator: 4,
  mgr_komersial: 6,
  keu_kantor: 4,
  pajak: 4,
  accounting: 5,
};
