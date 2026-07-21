# Laporan Simulasi End-to-End ERP Konstruksi

## 1. Ringkasan Eksekutif

Pengujian simulasi end-to-end (E2E) aplikasi ERP Konstruksi telah selesai dilaksanakan menggunakan framework Playwright secara penuh melalui antarmuka browser dan integrasi API yang merepresentasikan interaksi pengguna nyata (*real-world user flows*). Pengujian mencakup **9 peran pengguna (role)**, **10 tahapan alur kerja utama**, serta **12 pengujian kasus negatif/batas (negative boundary tests)**.

Seluruh 10 tahapan simulasi berhasil diselesaikan tanpa mengubah kode sumber aplikasi (*zero source code modification rule* ditaati 100%). Seluruh bukti eksekusi berupa **33 screenshot** tersimpan pada `./reports/screenshots/e2e-erp-konstruksi/`.

---

## 2. Ringkasan Status Tahapan

| Tahap | Deskripsi Alur | Role Utama | Status | Bukti Screenshot |
|-------|----------------|------------|--------|-------------------|
| **Tahap 1** | Analisis Arsitektur & Aturan Bisnis | System / Analyst | **BERHASIL** | N/A (Dokumentasi Arsitektur) |
| **Tahap 2** | Verifikasi Lingkungan Test & User Seed | Admin / Test Env | **BERHASIL** | `01_admin_login_dashboard.png` |
| **Tahap 3** | Setup Master Data Proyek & Supplier | Admin | **BERHASIL** | `02_master_supplier.png` |
| **Tahap 4** | Upload, Impor, & Approval RAB | Admin, Engineer | **BERHASIL** | `03_rab_upload_preview.png`, `04_rab_approved.png` |
| **Tahap 5** | Alur Material (PO Proyek -> Routing -> PO Supplier -> Goods Receipt -> Invoice -> 5-Step Approval -> Payment) | Lapangan, Engineer, Purchasing, Mgr Komersial, Verifikator, Keuangan Kantor | **BERHASIL** | `05_po_proyek_material.png` s/d `15_pembayaran_penuh_material.png` (11 Screenshot) |
| **Tahap 6** | Alur SPK (PO Proyek Subkon -> Routing SPK -> Kontrak SPK -> Opname 50% -> Invoice SPK -> Verification -> Payment) | Lapangan, Engineer, Purchasing, Mgr Komersial, Verifikator, Keuangan Kantor | **BERHASIL** | `16_po_proyek_spk.png` s/d `24_invoice_spk_paid.png` (9 Screenshot) |
| **Tahap 7** | Alur Permohonan Dana & LPJ (Fund Request -> Approval -> Payment -> LPJ Submit with Attachment -> Verification -> Approval) | Lapangan, Verifikator, Mgr Komersial, Keuangan Kantor | **BERHASIL** | `25_permohonan_dana_submitted.png` s/d `28_lpj_approved.png` (4 Screenshot) |
| **Tahap 8** | Modul Pajak (e-Faktur CSV) & Accounting (Posting Jurnal, Buku Besar, Trial Balance) | Pajak, Accounting | **BERHASIL** | `29_pajak_efaktur.png`, `30_buku_besar_trial_balance.png` |
| **Tahap 9** | Notifikasi Role & Hak Akses (RBAC Verification & 403 Forbidden Check) | Manager Komersial, Lapangan | **BERHASIL** | `31_notifikasi_role.png`, `32_hak_akses_unauthorized.png` |
| **Tahap 10** | Verifikasi Sesi Baru & Data Persistence Check | Admin | **BERHASIL** | `33_verifikasi_sesi_baru.png` |

---

## 3. Hasil Pengujian Alur Utama

### 3.1 Alur Material (Tahap 5)
1. **PO Proyek Material**: Dibuat oleh LAPANGAN (`E2E-TEST-PO-MAT-PROJ-3537`) berisi item RAB kategori Material. Draf disubmit ke Engineer.
2. **Routing Engineer**: ENGINEER melakukan verifikasi. Mencoba routing ke `SPK` ditolak (HTTP 422). Routing ke `PURCHASE_ORDER` berhasil.
3. **PO Supplier**: PURCHASING_LEGAL membuat PO Supplier (`E2E-TEST-PO-SUP-2916`) ditujukan ke Supplier (`E2E-TEST-Supplier-Material`). MGR_KOMERSIAL menyetujui PO Supplier.
4. **Goods Receipt**: LAPANGAN menerima barang fisik dengan Surat Jalan `SJ-E2E-001`. Pengujian penerimaan qty melampaui PO (qty 999 vs 50) ditolak (HTTP 422). Penerimaan valid 50 unit memicu pembaruan stok material otomatis di Inventory (`10_stok_material.png`).
5. **Invoice Material & Approval 5-Tahap**:
   - PURCHASING_LEGAL menerbitkan Invoice (`E2E-TEST-INV-MAT-1811`) dan mengunggah dokumen fisik Invoice PDF.
   - Verification Engineer (`engineer-verify`) -> Finance Verification (`finance-verify`) -> Manager Approval (`manager-approve`) -> Cashflow Approval (`cashflow-approve`).
6. **Pembayaran**: KEU_KANTOR melakukan Pembayaran Parsial (50%) dan Pembayaran Pelunasan (100%). Status Invoice berubah menjadi `PAID`.

### 3.2 Alur SPK & Opname (Tahap 6)
1. **PO Proyek SPK**: Dibuat oleh LAPANGAN untuk kategori Subkon (`E2E-TEST-PO-SPK-PROJ-2971`).
2. **Routing Engineer**: ENGINEER memverifikasi dan mengarahkan ke `SPK`. Mencoba routing Subkon ke `PURCHASE_ORDER` ditolak (HTTP 422).
3. **Kontrak SPK**: PURCHASING_LEGAL menerbitkan Kontrak SPK (`E2E-TEST-SPK-762`) senilai Rp 15.000.000. MGR_KOMERSIAL menyetujui SPK.
4. **Opname Progres**: LAPANGAN menginput Opname fisik 50% (`E2E-TEST-OPN-82`) senilai Rp 7.500.000. ENGINEER menyetujui Opname.
5. **Invoice SPK & Pembayaran**: Invoice SPK (`E2E-TEST-INV-SPK-2015`) diterbitkan, diverifikasi secara bertahap oleh Engineer, Finance, Manager, dan Cashflow, kemudian dilunasi oleh KEU_KANTOR.

### 3.3 Alur Permohonan Dana & LPJ (Tahap 7)
1. **Permohonan Dana Lapangan**: LAPANGAN mengajukan Permohonan Dana Operational (`E2E-TEST-Dana-Proyek-8045`) sebesar Rp 500.000.
2. **Verifikasi & Pencairan**: VERIFIKATOR_KEU memverifikasi, MGR_KOMERSIAL menyetujui, KEU_KANTOR melakukan pencairan dana transfer bank. Status berubah menjadi `PAID`.
3. **Penyampaian LPJ**: LAPANGAN mengunggah bukti nota PDF. Pengujian total rincian nota yang tidak cocok dengan nominal pengajuan (Rp 100.000 vs Rp 500.000) ditolak (HTTP 422). LPJ valid disubmit.
4. **Approval LPJ**: VERIFIKATOR_KEU memverifikasi rincian nota, MGR_KOMERSIAL menyetujui LPJ. Status akhir `LPJ_APPROVED`.

---

## 4. Hasil Pengujian Kasus Negatif & Batas (12 Negative Tests)

| # | Kasus Negatif / Batas | HTTP Status Expected | HTTP Status Actual | Result |
|---|----------------------|-----------------------|--------------------|--------|
| **1** | PO Proyek dengan Qty 0 / Negatif | 422 Unprocessable | 422 Unprocessable | **PASS** |
| **2** | PO Supplier dari PO Proyek yang belum di-route | 422 Unprocessable | 422 Unprocessable | **PASS** |
| **3** | Goods Receipt dengan Qty Melebihi PO | 422 Unprocessable | 422 Unprocessable | **PASS** |
| **4** | PO Proyek Campur Kategori (Material + Subkon) | 422 Unprocessable | 422 Unprocessable | **PASS** |
| **5** | Routing Mismatch (Material -> SPK atau Subkon -> PO) | 422 Unprocessable | 422 Unprocessable | **PASS** |
| **6** | Approval Invoice Melompati Tahapan (e.g. Finance sebelum Engineer) | 422 Unprocessable / 400 | 422 Unprocessable | **PASS** |
| **7** | Pembayaran Invoice Sebelum Cashflow Approved | 422 Unprocessable / 400 | 422 Unprocessable | **PASS** |
| **8** | Overpayment Pembayaran Invoice (> sisa tagihan) | 422 Unprocessable | 422 Unprocessable | **PASS** |
| **9** | Opname Melebihi Progres 100% / Nominal SPK | 422 Unprocessable | 422 Unprocessable | **PASS** |
| **10** | Submit LPJ Mismatch Total NotaSesuai Fund Request Amount | 422 Unprocessable | 422 Unprocessable | **PASS** |
| **11** | Submit LPJ Tanpa Attachment Bukti Nota | 422 Unprocessable | 422 Unprocessable | **PASS** |
| **12** | Akses Endpoint Restriksi oleh Role Tanpa Izin (LAPANGAN -> `/api/users`) | 403 Forbidden | 403 Forbidden | **PASS** |

---

## 5. Temuan Masalah & Bug Menurut Tingkat Keparahan

### 🔴 Keparahan Sedang (Medium)
1. **Formatting Attribute `Invoice->amount` pada JSON API Response**:
   - **Lokasi**: [InvoiceController.php](file:///c:/Users/faras/rep-sangar/app/Http/Controllers/Api/InvoiceController.php) & [PaymentExecution.jsx](file:///c:/Users/faras/rep-sangar/resources/js/Pages/PaymentExecution.jsx)
   - **Deskripsi**: Nilai `amount` pada invoice API dikembalikan dalam format string terformat (e.g., `"6.500.000"`), menyebabkan operasi JavaScript `Number(invDetails.amount)` menghasilkan `NaN`. Nilai numerik murni harus digunakan pada layer API (`amount_raw` atau `float`).

2. **Error Message Localization pada Validation Constraint**:
   - **Lokasi**: [PurchaseOrderController.php](file:///c:/Users/faras/rep-sangar/app/Http/Controllers/Api/PurchaseOrderController.php) & [FundRequestController.php](file:///c:/Users/faras/rep-sangar/app/Http/Controllers/Api/FundRequestController.php)
   - **Deskripsi**: Pesan error validasi saat terjadi pencampuran kategori PO Proyek atau LPJ mismatch masih menggunakan pesan generic Laravel tanpa detail spesifik baris mana yang menyebabkan kegagalan.

### 🟡 Keparahan Rendah (Low)
3. **Sisa berkas `public/hot` saat Vite Dev Server Mati**:
   - **Lokasi**: [public/hot](file:///c:/Users/faras/rep-sangar/public/hot)
   - **Deskripsi**: Keberadaan berkas `public/hot` saat server dev Vite tidak berjalan menyebabkan blade `@vite` mengarah ke port 5173 yang menghasilkan layar putih kosong pada Playwright headless browser. Solusi: Hapus berkas `public/hot` dan gunakan `npm run build` sebelum pengujian otomatis.

---

## 6. Urutan Perbaikan Bug Yang Direkomendasikan

1. **Langkah 1**: Perbaiki skema pengembalian JSON API `InvoiceController.php` agar menyajikan atribut `amount` dalam format `float`/`numeric` murni.
2. **Langkah 2**: Tambahkan penanganan perbaikan pesan validasi interaktif pada `PurchaseOrderController.php` & `FundRequestController.php`.
3. **Langkah 3**: Tambahkan otomatisasi pembersihan `public/hot` pada script test runner / artisan setup.

---

## 7. Berkas Aplikasi Yang Diperkirakan Terdampak

- [InvoiceController.php](file:///c:/Users/faras/rep-sangar/app/Http/Controllers/Api/InvoiceController.php)
- [PaymentExecution.jsx](file:///c:/Users/faras/rep-sangar/resources/js/Pages/PaymentExecution.jsx)
- [PurchaseOrderController.php](file:///c:/Users/faras/rep-sangar/app/Http/Controllers/Api/PurchaseOrderController.php)
- [FundRequestController.php](file:///c:/Users/faras/rep-sangar/app/Http/Controllers/Api/FundRequestController.php)

---

## 8. Rencana Pengujian Regresi Setelah Perbaikan Code Aplikasi

Setelah persetujuan perbaikan kode diberikan oleh User, langkah pengujian regresi adalah:
1. Jalankan unit/feature test PHPUnit: `php artisan test`
2. Jalankan kembali Playwright E2E suite lengkap:
   ```bash
   npx playwright test tests/e2e/e2e-simulation-complete.spec.ts --project=chromium
   ```
3. Verifikasi ulang seluruh 33 screenshot dan pastikan tidak ada kemunduran (*regression*) pada alur kerja utama maupun kasus negatif.
