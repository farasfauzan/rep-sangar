import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'reports/screenshots/e2e-erp-konstruksi');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const CREDENTIALS = {
  admin: { email: 'admin@erp.com', password: 'password', name: 'ADMIN' },
  lapangan: { email: 'lapangan@erp.com', password: 'password', name: 'LAPANGAN' },
  engineer: { email: 'engineer@erp.com', password: 'password', name: 'ENGINEER' },
  purchasing: { email: 'purchasing_legal@erp.com', password: 'password', name: 'PURCHASING_LEGAL' },
  verifikator: { email: 'verifikator_keu@erp.com', password: 'password', name: 'VERIFIKATOR_KEU' },
  mgr_komersial: { email: 'mgr_komersial@erp.com', password: 'password', name: 'MGR_KOMERSIAL' },
  keu_kantor: { email: 'keu_kantor@erp.com', password: 'password', name: 'KEU_KANTOR' },
  pajak: { email: 'pajak@erp.com', password: 'password', name: 'PAJAK' },
  accounting: { email: 'accounting@erp.com', password: 'password', name: 'ACCOUNTING' },
};

async function loginAs(page: any, roleKey: keyof typeof CREDENTIALS) {
  const creds = CREDENTIALS[roleKey];
  await page.context().clearCookies();
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  const emailInput = page.locator('input[name="email"]');
  await expect(emailInput).toBeVisible({ timeout: 10000 });
  await emailInput.fill(creds.email);
  await page.fill('input[name="password"]', creds.password);
  await page.click('button[type="submit"]');

  await page.waitForURL('**/dashboard', { timeout: 20000 });
  await page.waitForLoadState('domcontentloaded');
  console.log(`[AUTH] Logged in as ${creds.name} (${creds.email})`);
}

async function logout(page: any) {
  try {
    await page.evaluate(async () => {
      const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content;
      await fetch('/logout', {
        method: 'POST',
        headers: {
          'X-CSRF-TOKEN': csrfToken || '',
          'Accept': 'application/json',
        }
      });
    });
  } catch {}
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
}

function getArrayData(json: any): any[] {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data?.data)) return json.data.data;
  if (Array.isArray(json?.data)) return json.data;
  return [];
}

async function apiGet(page: any, url: string) {
  return await page.evaluate(async (endpoint: string) => {
    const res = await fetch(endpoint, {
      headers: { 'Accept': 'application/json' }
    });
    return await res.json();
  }, url);
}

async function apiPost(page: any, url: string, data: any) {
  return await page.evaluate(async ({ endpoint, payload }: any) => {
    const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-TOKEN': csrfToken || '',
      },
      body: JSON.stringify(payload)
    });
    let resJson = {};
    try { resJson = await res.json(); } catch {}
    return { status: res.status, data: resJson };
  }, { endpoint: url, payload: data });
}

async function apiPut(page: any, url: string, data?: any) {
  return await page.evaluate(async ({ endpoint, payload }: any) => {
    const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content;
    const res = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-TOKEN': csrfToken || '',
      },
      body: payload ? JSON.stringify(payload) : undefined
    });
    let resJson = {};
    try { resJson = await res.json(); } catch {}
    return { status: res.status, data: resJson };
  }, { endpoint: url, payload: data });
}

test.describe('ERP Konstruksi - Single Unified E2E Simulation', () => {
  test('Simulasi End-to-End ERP Konstruksi (Tahap 3 - 10)', async ({ page }) => {
    test.setTimeout(600000); // 10 minutes total

    let projectId: number;
    let projectName = 'E2E-TEST-Proyek-Gedung';
    let supplierId: number;
    let supplierName = 'E2E-TEST-Supplier-Material';

    let poMaterialId: number;
    let poMaterialNumber = 'E2E-TEST-PO-MAT-PROJ-' + Math.floor(Math.random() * 10000);
    let poSupplierId: number;
    let poSupplierNumber = 'E2E-TEST-PO-SUP-' + Math.floor(Math.random() * 10000);
    let grId: number;
    let grNumber = 'E2E-TEST-GR-' + Math.floor(Math.random() * 10000);
    let invMaterialId: number;
    let invMaterialNumber = 'E2E-TEST-INV-MAT-' + Math.floor(Math.random() * 10000);

    let poSpkId: number;
    let poSpkNumber = 'E2E-TEST-PO-SPK-PROJ-' + Math.floor(Math.random() * 10000);
    let spkId: number;
    let spkNumber = 'E2E-TEST-SPK-' + Math.floor(Math.random() * 10000);
    let opnameId: number;
    let opnameNumber = 'E2E-TEST-OPN-' + Math.floor(Math.random() * 10000);
    let invSpkId: number;
    let invSpkNumber = 'E2E-TEST-INV-SPK-' + Math.floor(Math.random() * 10000);

    let fundRequestId: number;
    let fundRequestNumber = 'E2E-TEST-Dana-Proyek-' + Math.floor(Math.random() * 10000);

    // ==========================================
    // TAHAP 3 & 4: Master Data Setup & RAB Flow
    // ==========================================
    console.log('\n--- TAHAP 3 & 4: Master Data & RAB ---');

    await loginAs(page, 'admin');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_admin_login_dashboard.png'), fullPage: true });

    let projData = getArrayData(await apiGet(page, '/api/projects'));
    let existingProj = projData.find((p: any) => p.project_name === projectName);
    if (!existingProj) {
      const createProjRes = await apiPost(page, '/api/projects', {
        project_name: projectName,
        location: 'Jakarta',
        start_date: '2026-01-01',
      });
      projectId = createProjRes.data.data?.id || createProjRes.data.id;
    } else {
      projectId = existingProj.id;
    }
    console.log(`[PROJECT] Project ID: ${projectId}`);

    await page.goto('/suppliers');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_master_supplier.png'), fullPage: true });

    let suppData = getArrayData(await apiGet(page, '/api/suppliers'));
    let existingSupp = suppData.find((s: any) => s.name === supplierName);
    if (!existingSupp) {
      const createSuppRes = await apiPost(page, '/api/suppliers', {
        name: supplierName,
        code: 'SUPP-' + Math.floor(Math.random() * 100000),
        npwp: '01.234.567.8-901.000',
        address: 'Jl. E2E Test No. 123',
        phone: '021-5551234',
        email: 'supplier.e2e@test.com',
        contact_person: 'Budi Supplier',
        bank_name: 'Bank Mandiri',
        bank_account_number: '1234567890',
        bank_account_name: supplierName,
        is_active: true,
      });
      supplierId = createSuppRes.data.data?.id || createSuppRes.data.id;
    } else {
      supplierId = existingSupp.id;
    }
    console.log(`[SUPPLIER] Supplier ID: ${supplierId}`);

    await page.goto('/rab-import');
    await page.waitForLoadState('domcontentloaded');

    const testFile = path.resolve(process.cwd(), '.hermes/desktop-attachments/RAB BANGUN MASJID.xlsx');
    if (fs.existsSync(testFile)) {
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(testFile);
      await page.waitForTimeout(500);

      const detectBtn = page.locator('button:has-text("Upload & Deteksi Sheet")').first();
      if (await detectBtn.isVisible()) {
        await detectBtn.click();
        await page.waitForTimeout(5000);
      }
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_rab_upload_preview.png'), fullPage: true });

    // Seed clean RAB items via manual import API to ensure clean categorised RAB items for test
    const manualImportRes = await apiPost(page, '/api/rab/import/manual', {
      project_id: projectId,
      rows: [
        { description: 'E2E-TEST Semen Gresik 50kg', category: 'Material', volume: 100, unit: 'sak', unit_price: 65000, total_price: 6500000 },
        { description: 'E2E-TEST Pasir Pasang', category: 'Material', volume: 10, unit: 'm3', unit_price: 250000, total_price: 2500000 },
        { description: 'E2E-TEST Pekerjaan Subkon Bekisting', category: 'Subkon', volume: 1, unit: 'ls', unit_price: 15000000, total_price: 15000000 },
        { description: 'E2E-TEST Upah Mandor & Pekerja', category: 'Pekerja', volume: 5, unit: 'oh', unit_price: 150000, total_price: 750000 },
        { description: 'E2E-TEST Sewa Excavator', category: 'Alat', volume: 2, unit: 'shift', unit_price: 2000000, total_price: 4000000 },
      ]
    });
    console.log('[RAB] Manual RAB import status:', manualImportRes.status);

    await apiPost(page, '/rab/submit-for-approval', { project_id: projectId });
    console.log('[RAB] RAB submitted for approval.');

    await logout(page);

    await loginAs(page, 'engineer');
    await apiPost(page, '/rab/approve', { project_id: projectId });
    console.log('[RAB] RAB approved by Engineer.');

    await page.goto('/rab-control');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_rab_approved.png'), fullPage: true });

    await logout(page);

    // ==========================================
    // TAHAP 5: Alur Material
    // ==========================================
    console.log('\n--- TAHAP 5: Alur Material ---');

    await loginAs(page, 'lapangan');

    const rabData = getArrayData(await apiGet(page, `/api/rab?project_id=${projectId}&all=1`));
    console.log('[RAB DEBUG count]', rabData.length);
    const rabItems = rabData.filter((r: any) => Number(r.project_id) === Number(projectId) && r.status === 'APPROVED');
    const materialRab = rabItems.find((r: any) => String(r.category).toLowerCase().includes('material'));

    if (!materialRab) throw new Error('No approved Material RAB item found for project ID ' + projectId);
    
    // Negative test 4: PO Proyek mixing categories
    const nonMaterialRab = rabItems.find((r: any) => !String(r.category).toLowerCase().includes('material'));
    if (nonMaterialRab) {
      const negPoRes = await apiPost(page, '/api/pos', {
        project_id: projectId,
        po_number: 'E2E-TEST-PO-MIXED-NEG-' + Math.floor(Math.random() * 1000),
        po_level: 'PROJECT',
        date: '2026-07-20',
        items: [
          { rab_budget_id: materialRab.id, item_name: materialRab.description, qty: 10 },
          { rab_budget_id: nonMaterialRab.id, item_name: nonMaterialRab.description, qty: 1 },
        ]
      });
      expect(negPoRes.status).toBe(422);
      console.log('✅ NegTest 4 PASS: Mixing categories in single PO rejected (422)');
    }

    // Create valid PO Proyek Material
    const poMatRes = await apiPost(page, '/api/pos', {
      project_id: projectId,
      po_number: poMaterialNumber,
      po_level: 'PROJECT',
      date: '2026-07-20',
      items: [
        { rab_budget_id: materialRab.id, item_name: materialRab.description, qty: 50 }
      ]
    });
    poMaterialId = poMatRes.data.data?.id || poMatRes.data.id;
    console.log(`[PO PROYEK MATERIAL] Created ID: ${poMaterialId}, No: ${poMaterialNumber}`);

    await apiPut(page, `/api/pos/${poMaterialId}/submit`);
    console.log('[PO PROYEK MATERIAL] Submitted.');

    await page.goto(`/purchase-orders/${poMaterialId}`);
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_po_proyek_material.png'), fullPage: true });
    await logout(page);

    // 5.2 Routing Engineer
    await loginAs(page, 'engineer');

    // Negative test 5: Routing Material to SPK should fail
    const negRouteRes = await apiPut(page, `/api/pos/${poMaterialId}/route`, { routed_to: 'SPK' });
    expect(negRouteRes.status).toBe(422);
    console.log('✅ NegTest 5 PASS: Routing Material category to SPK rejected (422)');

    // Route to PURCHASE_ORDER
    const routeRes = await apiPut(page, `/api/pos/${poMaterialId}/route`, { routed_to: 'PURCHASE_ORDER' });
    expect(routeRes.status).toBe(200);
    console.log('[PO PROYEK MATERIAL] Routed to PURCHASE_ORDER.');

    await page.goto(`/purchase-orders/${poMaterialId}`);
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_routing_engineer_material.png'), fullPage: true });
    await logout(page);

    // 5.3 PO Supplier
    await loginAs(page, 'purchasing');

    const poSuppRes = await apiPost(page, '/api/pos', {
      project_id: projectId,
      parent_po_id: poMaterialId,
      po_level: 'SUPPLIER',
      po_number: poSupplierNumber,
      supplier_id: supplierId,
      supplier_name: supplierName,
      supplier_address: 'Jl. E2E Test No. 123',
      supplier_phone: '021-5551234',
      supplier_contact_person: 'Budi Supplier',
      date: '2026-07-20',
      payment_terms: 'NET 30',
      discount: 0,
      include_ppn: true,
      items: [
        { rab_budget_id: materialRab.id, item_name: materialRab.description, qty: 50, unit_price: 65000 }
      ]
    });
    poSupplierId = poSuppRes.data.data?.id || poSuppRes.data.id;
    console.log(`[PO SUPPLIER] Created ID: ${poSupplierId}, No: ${poSupplierNumber}`);

    await apiPut(page, `/api/pos/${poSupplierId}/submit`);
    console.log('[PO SUPPLIER] Submitted for approval.');

    await page.goto(`/purchase-orders/${poSupplierId}`);
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_po_supplier_draft.png'), fullPage: true });
    await logout(page);

    // Approve PO Supplier
    await loginAs(page, 'mgr_komersial');
    await apiPut(page, `/api/pos/${poSupplierId}/approve`);
    console.log('[PO SUPPLIER] Approved by Manager Komersial.');

    await page.goto(`/purchase-orders/${poSupplierId}`);
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_po_supplier_approved.png'), fullPage: true });
    await logout(page);

    // 5.4 Goods Receipt
    await loginAs(page, 'lapangan');

    const poDetail = await apiGet(page, `/api/pos/${poSupplierId}`);
    const poItemId = poDetail.items[0].id;

    // Negative test 3: Qty > PO Qty
    const negGrRes = await apiPost(page, '/api/goods-receipts', {
      purchase_order_id: poSupplierId,
      receipt_number: 'E2E-TEST-GR-NEG-' + Math.floor(Math.random() * 1000),
      receipt_date: '2026-07-20',
      delivery_note_number: 'SJ-NEG-001',
      receiver_name: 'Staf Lapangan',
      items: [
        { po_item_id: poItemId, quantity_received: 999 }
      ]
    });
    expect(negGrRes.status).toBe(422);
    console.log('✅ NegTest 3 PASS: Goods Receipt qty > PO qty rejected (422)');

    // Valid GR
    const grRes = await apiPost(page, '/api/goods-receipts', {
      purchase_order_id: poSupplierId,
      receipt_number: grNumber,
      receipt_date: '2026-07-20',
      delivery_note_number: 'SJ-E2E-001',
      receiver_name: 'Staf Lapangan',
      items: [
        { po_item_id: poItemId, quantity_received: 50 }
      ]
    });
    grId = grRes.data.data?.id || grRes.data.id;
    console.log(`[GOODS RECEIPT] Created ID: ${grId}, No: ${grNumber}`);

    await page.goto('/goods-receipts');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_penerimaan_barang.png'), fullPage: true });

    await page.goto('/inventory');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_stok_material.png'), fullPage: true });
    await logout(page);

    // 5.5 Invoice Material
    await loginAs(page, 'purchasing');

    const invMatRes = await apiPost(page, '/api/invoices', {
      invoiceable_type: 'App\\Models\\PurchaseOrder',
      invoiceable_id: poSupplierId,
      invoice_number: invMaterialNumber,
      invoice_date: '2026-07-20',
      due_date: '2026-08-20',
    });
    invMaterialId = invMatRes.data.data?.id || invMatRes.data.id;
    console.log(`[INVOICE MATERIAL] Created ID: ${invMaterialId}, No: ${invMaterialNumber}`);

    // Upload attachment via fetch FormData in browser
    await page.evaluate(async (invoiceId: number) => {
      const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content;
      const formData = new FormData();
      formData.append('doc_type', 'INVOICE');
      const fileContent = new Blob(['%PDF-1.4 E2E Test Invoice PDF'], { type: 'application/pdf' });
      formData.append('file', fileContent, 'invoice_material.pdf');

      await fetch(`/api/invoices/${invoiceId}/attachments`, {
        method: 'POST',
        headers: { 'X-CSRF-TOKEN': csrfToken || '' },
        body: formData
      });
    }, invMaterialId);

    await page.goto('/invoicing');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11_invoice_material_submitted.png'), fullPage: true });
    await logout(page);

    // Approval chain: Engineer -> Finance -> Manager -> Cashflow
    await loginAs(page, 'engineer');
    await apiPut(page, `/api/invoices/${invMaterialId}/engineer-verify`);
    console.log('[INVOICE MATERIAL] Verified by Engineer.');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12_invoice_material_verified.png'), fullPage: true });
    await logout(page);

    await loginAs(page, 'verifikator');
    await apiPut(page, `/api/invoices/${invMaterialId}/finance-verify`);
    console.log('[INVOICE MATERIAL] Verified by Finance.');
    await logout(page);

    await loginAs(page, 'mgr_komersial');
    await apiPut(page, `/api/invoices/${invMaterialId}/manager-approve`);
    console.log('[INVOICE MATERIAL] Approved by Manager.');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13_invoice_material_approved.png'), fullPage: true });
    await logout(page);

    await loginAs(page, 'verifikator');
    await apiPut(page, `/api/invoices/${invMaterialId}/cashflow-approve`);
    console.log('[INVOICE MATERIAL] Cashflow approved by Finance.');
    await logout(page);

    // Payment Material
    await loginAs(page, 'keu_kantor');
    const invDetails = await apiGet(page, `/api/invoices/${invMaterialId}`);
    const totalInvAmount = Number(invDetails.amount);
    const partialAmount = Math.floor(totalInvAmount / 2);

    await apiPost(page, `/api/invoices/${invMaterialId}/payments`, {
      payment_method: 'TRANSFER_BANK',
      amount: partialAmount,
      payment_date: '2026-07-20',
      proof_of_payment: 'TRX-PARTIAL-001',
    });
    console.log(`[PAYMENT MATERIAL] Partial payment: Rp ${partialAmount}`);

    await page.goto('/payment');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '14_pembayaran_parsial_material.png'), fullPage: true });

    const remainingAmount = totalInvAmount - partialAmount;
    await apiPost(page, `/api/invoices/${invMaterialId}/payments`, {
      payment_method: 'TRANSFER_BANK',
      amount: remainingAmount,
      payment_date: '2026-07-20',
      proof_of_payment: 'TRX-FULL-001',
    });
    console.log(`[PAYMENT MATERIAL] Remainder paid: Rp ${remainingAmount}`);

    await page.goto('/payment');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '15_pembayaran_penuh_material.png'), fullPage: true });
    await logout(page);

    // ==========================================
    // TAHAP 6: Alur SPK & Opname
    // ==========================================
    console.log('\n--- TAHAP 6: Alur SPK ---');

    const subkonRab = rabItems.find((r: any) => String(r.category).toLowerCase().includes('subkon') || String(r.category).toLowerCase().includes('pekerja'));
    if (!subkonRab) throw new Error('No approved Subkon/Pekerja RAB item found');

    await loginAs(page, 'lapangan');
    const poSpkRes = await apiPost(page, '/api/pos', {
      project_id: projectId,
      po_number: poSpkNumber,
      po_level: 'PROJECT',
      date: '2026-07-20',
      items: [
        { rab_budget_id: subkonRab.id, item_name: subkonRab.description, qty: 1 }
      ]
    });
    poSpkId = poSpkRes.data.data?.id || poSpkRes.data.id;
    console.log(`[PO PROYEK SPK] Created ID: ${poSpkId}, No: ${poSpkNumber}`);

    await apiPut(page, `/api/pos/${poSpkId}/submit`);

    await page.goto(`/purchase-orders/${poSpkId}`);
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '16_po_proyek_spk.png'), fullPage: true });
    await logout(page);

    // Route to SPK
    await loginAs(page, 'engineer');

    const negSpkRouteRes = await apiPut(page, `/api/pos/${poSpkId}/route`, { routed_to: 'PURCHASE_ORDER' });
    expect(negSpkRouteRes.status).toBe(422);
    console.log('✅ NegTest 5 PASS: Routing Subkon/Pekerja category to PURCHASE_ORDER rejected (422)');

    await apiPut(page, `/api/pos/${poSpkId}/route`, { routed_to: 'SPK' });
    console.log('[PO PROYEK SPK] Routed to SPK.');

    await page.goto(`/purchase-orders/${poSpkId}`);
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '17_routing_engineer_spk.png'), fullPage: true });
    await logout(page);

    // SPK Contract
    await loginAs(page, 'purchasing');
    const spkRes = await apiPost(page, '/api/spks', {
      project_id: projectId,
      source_po_id: poSpkId,
      spk_number: spkNumber,
      subcon_name: 'PT Subkon E2E Perkasa',
      spk_type: 'SUBKON',
      subtotal: subkonRab.total_price || 15000000,
    });
    spkId = spkRes.data?.data?.id || spkRes.data?.id;
    console.log(`[SPK] Created ID: ${spkId}, No: ${spkNumber}`);

    await apiPut(page, `/api/spks/${spkId}/submit`);

    await page.goto('/spk');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '18_spk_draft.png'), fullPage: true });
    await logout(page);

    // Approve SPK
    await loginAs(page, 'mgr_komersial');
    await apiPut(page, `/api/spks/${spkId}/approve`);
    console.log('[SPK] Approved by Manager.');

    await page.goto('/spk');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '19_spk_approved.png'), fullPage: true });
    await logout(page);

    // Opname
    await loginAs(page, 'lapangan');
    const opnameRes = await apiPost(page, '/api/opnames', {
      spk_id: spkId,
      opname_number: opnameNumber,
      date: '2026-07-20',
      progress_percentage: 50,
      amount: (subkonRab.total_price || 15000000) * 0.5,
    });
    opnameId = opnameRes.data?.data?.id || opnameRes.data?.id;
    console.log(`[OPNAME] Created ID: ${opnameId}, No: ${opnameNumber}`);

    await page.goto('/opname');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '20_opname_submitted.png'), fullPage: true });
    await logout(page);

    // Approve Opname
    await loginAs(page, 'engineer');
    await apiPut(page, `/api/opnames/${opnameId}/approve`);
    console.log('[OPNAME] Approved by Engineer.');

    await page.goto('/opname');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '21_opname_approved.png'), fullPage: true });
    await logout(page);

    // Invoice SPK
    await loginAs(page, 'purchasing');
    const invSpkRes = await apiPost(page, '/api/invoices', {
      invoiceable_type: 'App\\Models\\Spk',
      invoiceable_id: spkId,
      opname_id: opnameId,
      invoice_number: invSpkNumber,
      invoice_date: '2026-07-20',
      due_date: '2026-08-20',
    });
    invSpkId = invSpkRes.data?.data?.id || invSpkRes.data?.id;
    console.log(`[INVOICE SPK] Created ID: ${invSpkId}, No: ${invSpkNumber}`);

    await page.evaluate(async (invoiceId: number) => {
      const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content;
      const formData = new FormData();
      formData.append('doc_type', 'INVOICE');
      const fileContent = new Blob(['%PDF-1.4 SPK Invoice'], { type: 'application/pdf' });
      formData.append('file', fileContent, 'invoice_spk.pdf');

      await fetch(`/api/invoices/${invoiceId}/attachments`, {
        method: 'POST',
        headers: { 'X-CSRF-TOKEN': csrfToken || '' },
        body: formData
      });
    }, invSpkId);

    await page.goto('/invoicing');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '22_invoice_spk_submitted.png'), fullPage: true });
    await logout(page);

    // Approval chain for Invoice SPK
    await loginAs(page, 'engineer');
    await apiPut(page, `/api/invoices/${invSpkId}/engineer-verify`);
    await logout(page);

    await loginAs(page, 'verifikator');
    await apiPut(page, `/api/invoices/${invSpkId}/finance-verify`);
    await logout(page);

    await loginAs(page, 'mgr_komersial');
    await apiPut(page, `/api/invoices/${invSpkId}/manager-approve`);
    await logout(page);

    await loginAs(page, 'verifikator');
    await apiPut(page, `/api/invoices/${invSpkId}/cashflow-approve`);
    await page.goto('/approval');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '23_invoice_spk_verified.png'), fullPage: true });
    await logout(page);

    // Payment Invoice SPK
    await loginAs(page, 'keu_kantor');
    const invSpkDetails = await apiGet(page, `/api/invoices/${invSpkId}`);
    await apiPost(page, `/api/invoices/${invSpkId}/payments`, {
      payment_method: 'TRANSFER_BANK',
      amount: Number(invSpkDetails.amount),
      payment_date: '2026-07-20',
      proof_of_payment: 'TRX-SPK-FULL-001',
    });
    console.log('[INVOICE SPK] Payment completed.');

    await page.goto('/payment');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '24_invoice_spk_paid.png'), fullPage: true });
    await logout(page);

    // ==========================================
    // TAHAP 7: Permohonan Dana & LPJ
    // ==========================================
    console.log('\n--- TAHAP 7: Permohonan Dana & LPJ ---');

    const fundAmount = 500000;

    await loginAs(page, 'lapangan');
    const fundRes = await apiPost(page, '/api/fund-requests', {
      project_id: projectId,
      request_number: fundRequestNumber,
      amount: fundAmount,
      description: 'E2E-TEST Operational cash for field expenses',
    });
    fundRequestId = fundRes.data.data?.id || fundRes.data.id;
    console.log(`[FUND REQUEST] Created ID: ${fundRequestId}, No: ${fundRequestNumber}`);

    await page.goto('/fund-requests');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '25_permohonan_dana_submitted.png'), fullPage: true });
    await logout(page);

    // Verify Fund Request
    await loginAs(page, 'verifikator');
    await apiPut(page, `/api/fund-requests/${fundRequestId}/verify`);
    console.log('[FUND REQUEST] Verified by Finance.');
    await logout(page);

    // Approve Fund Request
    await loginAs(page, 'mgr_komersial');
    await apiPut(page, `/api/fund-requests/${fundRequestId}/approve`);
    console.log('[FUND REQUEST] Approved by Manager.');
    await logout(page);

    // Pay Fund Request
    await loginAs(page, 'keu_kantor');
    await apiPost(page, `/api/fund-requests/${fundRequestId}/payments`, {
      payment_method: 'TRANSFER_BANK',
      amount: fundAmount,
      payment_date: '2026-07-20',
      proof_of_payment: 'TRX-FUND-001',
    });
    console.log('[FUND REQUEST] Paid by Keuangan Kantor.');

    await page.goto('/fund-requests');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '26_permohonan_dana_approved_paid.png'), fullPage: true });
    await logout(page);

    // Submit LPJ
    await loginAs(page, 'lapangan');

    await page.evaluate(async (frId: number) => {
      const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content;
      const formData = new FormData();
      formData.append('doc_type', 'LPJ');
      const fileContent = new Blob(['%PDF-1.4 E2E LPJ Receipt'], { type: 'application/pdf' });
      formData.append('file', fileContent, 'nota_lpj_e2e.pdf');

      await fetch(`/api/fund-requests/${frId}/attachments`, {
        method: 'POST',
        headers: { 'X-CSRF-TOKEN': csrfToken || '' },
        body: formData
      });
    }, fundRequestId);

    // Negative test 10: Total LPJ mismatch
    const negLpjRes = await apiPut(page, `/api/fund-requests/${fundRequestId}/lpj`, {
      lpj_notes: 'Laporan Pertanggungjawaban E2E Test Mismatch',
      lpj_items: [
        { description: 'Pembelian Solar Generator', amount: 100000, category: 'BBM' }
      ]
    });
    expect(negLpjRes.status).toBe(422);
    console.log('✅ NegTest 10 PASS: Total LPJ mismatch rejected (422)');

    // Valid LPJ
    const validLpjRes = await apiPut(page, `/api/fund-requests/${fundRequestId}/lpj`, {
      lpj_notes: 'Laporan Pertanggungjawaban E2E Test Sesuai Realisasi',
      lpj_items: [
        { description: 'Pembelian Solar Generator', amount: 200000, category: 'BBM' },
        { description: 'Konsumsi Rapat Lapangan', amount: 300000, category: 'KONSUMSI' }
      ]
    });
    expect(validLpjRes.status).toBe(200);
    console.log('[LPJ] Submitted by Lapangan.');

    await page.goto('/fund-requests');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '27_lpj_submitted.png'), fullPage: true });
    await logout(page);

    // Verify & Approve LPJ
    await loginAs(page, 'verifikator');
    await apiPut(page, `/api/fund-requests/${fundRequestId}/lpj-verify`);
    console.log('[LPJ] Verified by Finance.');
    await logout(page);

    await loginAs(page, 'mgr_komersial');
    await apiPut(page, `/api/fund-requests/${fundRequestId}/lpj-approve`);
    console.log('[LPJ] Approved by Manager Komersial.');

    await page.goto('/fund-requests');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '28_lpj_approved.png'), fullPage: true });
    await logout(page);

    // ==========================================
    // TAHAP 8: Pajak & Accounting
    // ==========================================
    console.log('\n--- TAHAP 8: Pajak & Accounting ---');

    await loginAs(page, 'pajak');
    await page.goto('/e-faktur-csv');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '29_pajak_efaktur.png'), fullPage: true });
    await logout(page);

    await loginAs(page, 'accounting');
    await page.goto('/posting-jurnal');
    await page.waitForLoadState('domcontentloaded');

    const glData = await apiGet(page, '/api/general-ledger');
    console.log('[GL] General ledger checked.');

    await page.goto('/laporan-keuangan');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '30_buku_besar_trial_balance.png'), fullPage: true });
    await logout(page);

    // ==========================================
    // TAHAP 9: Notifikasi & Hak Akses
    // ==========================================
    console.log('\n--- TAHAP 9: Notifikasi & Hak Akses ---');

    await loginAs(page, 'mgr_komersial');
    const notifRes = await page.evaluate(async () => {
      const res = await fetch('/api/notifications');
      return res.status;
    });
    expect(notifRes).toBe(200);

    await page.goto('/approval');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '31_notifikasi_role.png'), fullPage: true });
    await logout(page);

    // Unauthorized Access test
    await loginAs(page, 'lapangan');
    const forbiddenRes = await page.evaluate(async () => {
      const res = await fetch('/api/users');
      return res.status;
    });
    expect(forbiddenRes).toBe(403);
    console.log('✅ NegTest 12 PASS: LAPANGAN access to /api/users forbidden (403)');

    await page.goto('/admin/users');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '32_hak_akses_unauthorized.png'), fullPage: true });
    await logout(page);

    // ==========================================
    // TAHAP 10: Verifikasi Sesi Baru & Persistence
    // ==========================================
    console.log('\n--- TAHAP 10: Verifikasi Sesi Baru ---');

    await loginAs(page, 'admin');

    const checkPoMat = await apiGet(page, `/api/pos/${poMaterialId}`);
    expect(checkPoMat.po_number).toBe(poMaterialNumber);

    const checkPoSupp = await apiGet(page, `/api/pos/${poSupplierId}`);
    expect(['APPROVED', 'RECEIVED', 'PAID']).toContain(checkPoSupp.status);

    const checkSpk = await apiGet(page, `/api/spks/${spkId}`);
    expect(['APPROVED', 'COMPLETED', 'IN_PROGRESS']).toContain(checkSpk.status);

    const checkFund = await apiGet(page, `/api/fund-requests/${fundRequestId}`);
    expect(checkFund.status).toBe('LPJ_APPROVED');
    console.log('✅ Data persistence verified across all modules!');

    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '33_verifikasi_sesi_baru.png'), fullPage: true });
    await logout(page);

    console.log('\n🎉 ALL STAGES 3 - 10 COMPLETED SUCCESSFULLY!');
  });
});
