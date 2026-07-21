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
  await page.waitForLoadState('networkidle');
  
  await page.fill('input[name="email"]', creds.email);
  await page.fill('input[name="password"]', creds.password);
  await page.click('button[type="submit"]');
  
  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  
  console.log(`✅ Logged in as ${creds.roleName} (${creds.email})`);
  return creds;
}

export async function logout(page: Page) {
  // Click user dropdown (top right)
  await page.click('nav button:has-text("Admin"), nav button:has-text("admin"), nav [aria-haspopup="menu"]');
  await page.waitForTimeout(300);
  
  // Click logout link
  await page.click('text=Log Out, text=Logout, [role="menuitem"]:has-text("Log Out")');
  
  // Wait for redirect to login
  await page.waitForURL('**/login', { timeout: 5000 });
  console.log('✅ Logged out');
}

export async function navigateToMenu(page: Page, menuText: string) {
  await page.click(`aside nav a:has-text("${menuText}")`);
  await page.waitForLoadState('networkidle');
  console.log(`✅ Navigated to ${menuText}`);
}

export const EXPECTED_MENU_COUNTS: Record<string, number> = {
  admin: 13,
  lapangan: 5,
  engineer: 5,
  purchasing: 5,
  verifikator: 3,
  mgr_komersial: 5,
  keu_kantor: 3,
  pajak: 3,
  accounting: 4,
};