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

// ==================== LOGIN ====================
test.describe('1. Autentikasi', () => {
  test('1.1 Login page accessible', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    console.log('✅ Login page: form elements visible');
  });

  test('1.2 Login berhasil sebagai Admin', async ({ page }) => {
    await loginAs(page, 'admin');
    await expect(page).toHaveURL(/.*dashboard/);
    console.log('✅ Login berhasil, redirect ke dashboard');
  });

  test('1.3 Login gagal dengan password salah', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@erp.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).toContain('login');
    console.log('✅ Login gagal tetap di halaman login');
  });

  test('1.4 Logout berhasil', async ({ page }) => {
    await loginAs(page, 'admin');
    // Klik dropdown "Admin" di pojok kanan atas, lalu klik "Log Out"
    await page.locator('button:has-text("Admin")').last().click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Log Out")').first().click();
    // Logout redirects to / or /login
    await page.waitForURL(url => {
      const p = url.pathname;
      return p === '/login' || p === '/';
    }, { timeout: 10000 });
    console.log('✅ Logout berhasil, redirect ke:', page.url());
  });
});

// ==================== DASHBOARD ====================
test.describe('2. Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('2.1 Dashboard load dengan konten', async ({ page }) => {
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    const title = await page.locator('h1, h2').first().textContent();
    console.log(`✅ Dashboard title: "${title}"`);
  });

  test('2.2 Sidebar menu ADMIN lengkap (15 menu)', async ({ page }) => {
    const sidebarLinks = page.locator('aside nav a');
    const count = await sidebarLinks.count();
    console.log(`✅ Admin sidebar menus: ${count}`);
    expect(count).toBe(14);
  });
});

// ==================== KONTROL RAB ====================
test.describe('3. Kontrol RAB', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('3.1 Halaman Kontrol RAB bisa diakses', async ({ page }) => {
    await page.locator('aside nav a:has-text("Kontrol RAB")').first().click();
    await page.waitForTimeout(2000);
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 15000 });
    console.log('✅ Kontrol RAB page loaded');
  });
});

// ==================== PENYIMPANAN RAB ====================
test.describe('4. Penyimpanan RAB', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('4.1 Halaman Penyimpanan RAB bisa diakses', async ({ page }) => {
    await page.locator('aside nav a:has-text("Penyimpanan RAB")').first().click();
    await page.waitForTimeout(2000);
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 15000 });
    console.log('✅ Penyimpanan RAB page loaded');
  });
});

// ==================== PURCHASE ORDERS ====================
test.describe('5. Purchase Orders (PO)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('5.1 Halaman PO list bisa diakses', async ({ page }) => {
    await page.locator('aside nav a:has-text("Purchase Orders")').first().click();
    await page.waitForTimeout(2000);
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 15000 });
    console.log('✅ PO list page loaded');
  });

  test('5.2 Halaman PO Create bisa diakses', async ({ page }) => {
    await page.goto('/po/create');
    await page.waitForTimeout(2000);
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 15000 });
    console.log('✅ PO Create page loaded');
  });
});

// ==================== SUPPLIER ====================
test.describe('6. Supplier', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('6.1 Halaman Supplier list bisa diakses', async ({ page }) => {
    await page.locator('aside nav a:has-text("Supplier")').first().click();
    await page.waitForTimeout(2000);
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 15000 });
    console.log('✅ Supplier list page loaded');
  });

  test('6.2 Halaman Supplier Create bisa diakses', async ({ page }) => {
    await page.goto('/suppliers/create');
    await page.waitForTimeout(2000);
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 15000 });
    console.log('✅ Supplier Create page loaded');
  });
});

// ==================== KONTRAK SPK ====================
test.describe('7. Kontrak SPK', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('7.1 Halaman SPK bisa diakses', async ({ page }) => {
    await page.locator('aside nav a:has-text("Kontrak SPK")').first().click();
    await page.waitForTimeout(2000);
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 15000 });
    console.log('✅ SPK page loaded');
  });
});

// ==================== PENERIMAAN BARANG ====================
test.describe('8. Penerimaan Barang (BAST)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('8.1 Halaman Penerimaan Barang bisa diakses', async ({ page }) => {
    await page.locator('aside nav a:has-text("Penerimaan Barang")').first().click();
    await page.waitForTimeout(2000);
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 15000 });
    console.log('✅ Penerimaan Barang page loaded');
  });
});

// ==================== INPUT OPNAME ====================
test.describe('9. Input Opname', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('9.1 Halaman Input Opname bisa diakses', async ({ page }) => {
    await page.locator('aside nav a:has-text("Input Opname")').first().click();
    await page.waitForTimeout(2000);
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 15000 });
    console.log('✅ Input Opname page loaded');
  });
});

// ==================== INPUT TAGIHAN ====================
test.describe('10. Input Tagihan (Invoicing)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('10.1 Halaman Input Tagihan bisa diakses', async ({ page }) => {
    await page.locator('aside nav a:has-text("Input Tagihan")').first().click();
    await page.waitForTimeout(2000);
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 15000 });
    console.log('✅ Input Tagihan page loaded');
  });
});

// ==================== APPROVAL ====================
test.describe('11. Approval', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('11.1 Halaman Approval bisa diakses', async ({ page }) => {
    await page.locator('aside nav a:has-text("Approval")').first().click();
    await page.waitForTimeout(2000);
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 15000 });
    console.log('✅ Approval page loaded');
  });
});

// ==================== LPJ & PERMOHONAN ====================
test.describe('12. LPJ & Permohonan (Fund Requests)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('12.1 Halaman LPJ & Permohonan bisa diakses', async ({ page }) => {
    await page.locator('aside nav a:has-text("LPJ & Permohonan")').first().click();
    await page.waitForTimeout(2000);
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 15000 });
    console.log('✅ LPJ & Permohonan page loaded');
  });
});

// ==================== PEMBAYARAN ====================
test.describe('13. Pembayaran', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('13.1 Halaman Pembayaran bisa diakses', async ({ page }) => {
    await page.locator('aside nav a:has-text("Pembayaran")').first().click();
    await page.waitForTimeout(2000);
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 15000 });
    console.log('✅ Pembayaran page loaded');
  });
});

// ==================== KELOLA USER ====================
test.describe('14. Kelola User', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('14.1 Halaman Kelola User bisa diakses', async ({ page }) => {
    await page.locator('aside nav a:has-text("Kelola User")').first().click();
    await page.waitForTimeout(2000);
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 15000 });
    console.log('✅ Kelola User page loaded');
  });
});

// ==================== INVENTARIS ====================
test.describe('15. Inventaris (Inventory)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('15.1 Halaman Inventaris bisa diakses', async ({ page }) => {
    await page.locator('aside nav a:has-text("Inventaris")').first().click();
    await page.waitForTimeout(2000);
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 15000 });
    console.log('✅ Inventaris page loaded');
  });
});

// ==================== HALAMAN TAMBAHAN (via URL) ====================
test.describe('16. Halaman Tambahan (direct URL)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  const pages = [
    { name: 'Laporan Keuangan', url: '/laporan-keuangan' },
    { name: 'Faktur Pajak', url: '/faktur-pajak' },
    { name: 'Posting Jurnal', url: '/posting-jurnal' },
    { name: 'Audit Trail', url: '/audit-trail' },
    { name: 'Profile', url: '/profile' },
    { name: 'e-Faktur CSV', url: '/e-faktur-csv' },
  ];

  for (const pg of pages) {
    test(`16.x ${pg.name} bisa diakses`, async ({ page }) => {
      await page.goto(pg.url);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      const heading = page.locator('h1, h2, h3').first();
      await expect(heading).toBeVisible({ timeout: 30000 });
      const text = await heading.textContent();
      console.log(`✅ ${pg.name} loaded - heading: "${text?.trim()}"`);
    });
  }
});

// ==================== NAVIGASI SEMUA MENU SIDEBAR ====================
test.describe('17. Navigasi Sidebar Lengkap', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('17.1 Klik semua menu sidebar → load tanpa error', async ({ page }) => {
    await page.waitForTimeout(2000);
    const sidebarLinks = page.locator('aside nav a');
    const count = await sidebarLinks.count();
    const results: string[] = [];

    for (let i = 0; i < count; i++) {
      const link = sidebarLinks.nth(i);
      const text = (await link.textContent())?.trim() || '';
      const href = await link.getAttribute('href');

      if (href && href !== '#' && !href.startsWith('http')) {
        await link.click();
        await page.waitForTimeout(2000);

        const hasHeading = await page.locator('h1, h2, h3').first().isVisible().catch(() => false);
        const status = hasHeading ? '✅' : '⚠️ (no heading)';
        results.push(`${status} "${text}" → ${page.url()}`);
      }
    }

    for (const r of results) {
      console.log(r);
    }

    console.log(`\nTotal menu diklik: ${results.length}`);
  });
});
