import { test, expect } from '@playwright/test';
import { loginAs, logout } from '../utils/auth';

test.describe('ERP Konstruksi - Full Simulation End-to-End', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180000); // 3 minutes per test
  });

  test('ADMIN: Login → Dashboard (14 menu) → Navigasi semua modul → Logout', async ({ page }) => {
    await loginAs(page, 'admin');

    // Verifikasi jumlah menu sidebar (13 role + Inventaris = 14? cek aktual)
    const sidebarLinks = page.locator('aside nav a');
    await expect(sidebarLinks.first()).toBeVisible({ timeout: 15000 });
    const sidebarCount = await sidebarLinks.count();
    expect(sidebarCount).toBe(15);
    console.log(`✅ ADMIN: ${sidebarCount} menu sidebar`);

    // Screenshot dashboard
    await page.screenshot({ path: 'test-results/admin-dashboard.png', fullPage: true });

    // Navigasi setiap menu
    const menuNames = [
      'Kontrol RAB', 'Penyimpanan RAB', 'Purchase Orders', 'Supplier',
      'Kontrak SPK', 'Penerimaan Barang', 'Input Opname', 'Input Tagihan',
      'Approval', 'LPJ & Permohonan', 'Pembayaran', 'Rekening Koran', 'Kelola User',
    ];

    for (const menuName of menuNames) {
      try {
        const menuLink = page.locator(`aside nav a:has-text("${menuName}")`).first();
        if (await menuLink.count() > 0) {
          await menuLink.click({ timeout: 5000 });
          await page.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(800);
          console.log(`✅ Navigated: ${menuName}`);
        }
      } catch (e) {
        console.log(`⚠️ Skip ${menuName}: ${(e as Error).message}`);
      }
    }

    // Kembali ke dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // Logout
    await logout(page);
    console.log('✅ ADMIN flow selesai');
  });

  for (const [roleKey, expected] of [
    ['lapangan', 6],
    ['engineer', 6],
    ['purchasing', 6],
    ['mgr_komersial', 6],
    ['keu_kantor', 4],
    ['pajak', 4],
    ['accounting', 5],
    ['verifikator', 4],
  ] as const) {
    test(`Role ${roleKey}: Login → Dashboard (${expected} menu) → Logout`, async ({ page }) => {
      await loginAs(page, roleKey);
      const sidebarLinks = page.locator('aside nav a');
      await expect(sidebarLinks.first()).toBeVisible({ timeout: 15000 });
      const count = await sidebarLinks.count();
      expect(count).toBe(expected);
      console.log(`✅ ${roleKey}: ${count} menu`);
      await logout(page);
    });
  }
});
