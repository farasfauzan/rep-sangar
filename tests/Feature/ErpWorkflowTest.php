<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\RabBudget;
use App\Models\InventoryStock;
use App\Models\PoItem;
use App\Models\PurchaseOrder;
use App\Models\Spk;
use App\Models\User;
use App\Models\Role;
use App\Models\InvoiceAttachment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class ErpWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private function adminUser(): User
    {
        $role = Role::firstOrCreate(['role_name' => 'ADMIN']);
        return User::factory()->create(['role_id' => $role->id]);
    }

    public function test_material_flow_must_follow_rab_po_receipt_invoice_and_payment_stages(): void
    {
        $user = $this->adminUser();
        $this->actingAs($user);
        $project = $this->project();
        $rab = $this->rab($project, 'DRAFT');

        $this->actingAs($user)
            ->postJson('/rab/submit-for-approval', ['project_id' => $project->id])
            ->assertOk();

        $this->actingAs($user)
            ->postJson('/rab/approve', ['project_id' => $project->id])
            ->assertOk();

        $this->assertDatabaseHas('rab_budgets', ['id' => $rab->id, 'status' => 'APPROVED']);

        $projectPo = $this->actingAs($user)->postJson('/api/pos', [
            'project_id' => $project->id,
            'po_number' => 'PO-ERP-PROJECT-001',
            'date' => '2026-07-10',
            'po_level' => 'PROJECT',
            'items' => [[
                'rab_budget_id' => $rab->id,
                'item_name' => $rab->description,
                'qty' => 2,
            ]],
        ])->assertCreated();
        $projectPoId = $projectPo->json('data.id');
        $this->actingAs($user)->putJson("/api/pos/{$projectPoId}/route", ['routed_to' => 'PURCHASE_ORDER'])->assertOk();

        $poResponse = $this->actingAs($user)->postJson('/api/pos', [
            'project_id' => $project->id,
            'po_number' => 'PO-ERP-001',
            'date' => '2026-07-10',
            'po_level' => 'SUPPLIER',
            'parent_po_id' => $projectPoId,
            'supplier_name' => 'PT Material Utama',
            'jadwal_kirim' => '2026-07-15',
            'payment_terms' => '30 hari',
            'tax_rate' => 11,
            'items' => [[
                'rab_budget_id' => $rab->id,
                'item_name' => $rab->description,
                'qty' => 2,
                'unit_price' => 50000,
            ]],
        ])->assertCreated();

        $poId = $poResponse->json('data.id');
        $poItem = PoItem::where('purchase_order_id', $poId)->first();
        
        $receiptPayload = array_merge($this->receiptPayload($poId, 'GR-ERP-001'), [
            'items' => [['po_item_id' => $poItem->id, 'quantity_received' => 2]]
        ]);

        $this->postJson('/api/goods-receipts', $receiptPayload)
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Penerimaan barang hanya dapat dicatat untuk PO yang sudah disetujui atau diterima sebagian.');

        $this->actingAs($user)->putJson("/api/pos/{$poId}/submit")->assertOk();
        $this->actingAs($user)->putJson("/api/pos/{$poId}/approve")->assertOk();
        $this->actingAs($user)->postJson('/api/goods-receipts', $receiptPayload)->assertCreated();

        $invoiceResponse = $this->postJson('/api/invoices', [
            'invoiceable_type' => 'App\\Models\\PurchaseOrder',
            'invoiceable_id' => $poId,
            'invoice_number' => 'INV-ERP-001',
            'invoice_date' => '2026-07-10',
        ])->assertCreated();

        $invoiceId = $invoiceResponse->json('data.id');

        $this->putJson("/api/invoices/{$invoiceId}/finance-verify")
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Invoice harus lolos verifikasi engineer sebelum diverifikasi keuangan.');

        $this->putJson("/api/invoices/{$invoiceId}/engineer-verify")->assertOk();
        foreach (['INVOICE', 'PO', 'SURAT_JALAN'] as $docType) {
            InvoiceAttachment::create(['invoice_id' => $invoiceId, 'doc_type' => $docType, 'file_path' => "{$docType}.pdf", 'file_name' => "{$docType}.pdf"]);
        }
        $this->putJson("/api/invoices/{$invoiceId}/finance-verify")->assertOk();
        $this->putJson("/api/invoices/{$invoiceId}/manager-approve")->assertOk();
        $this->putJson("/api/invoices/{$invoiceId}/cashflow-approve", ['cashflow_status' => 'APPROVED'])->assertOk();

        $this->postJson("/api/invoices/{$invoiceId}/payments", [
            'payment_method' => 'TRANSFER',
            'amount' => 1,
        ])->assertOk();

        $this->postJson("/api/invoices/{$invoiceId}/payments", [
            'payment_method' => 'TRANSFER',
            'proof_of_payment' => 'TRF-ERP-001',
        ])->assertOk();

        $this->assertDatabaseHas('purchase_orders', ['id' => $poId, 'status' => 'RECEIVED']);
        $this->assertDatabaseHas('invoices', ['id' => $invoiceId, 'status' => 'PAID']);
        $this->assertDatabaseHas('transactions', ['invoice_id' => $invoiceId, 'amount' => 1]);
        $this->assertDatabaseHas('transactions', ['invoice_id' => $invoiceId, 'amount' => 110999]);
    }

    public function test_rab_technical_approval_is_available_to_engineer_but_not_purchasing(): void
    {
        $project = $this->project();
        $rab = $this->rab($project, 'PENDING');
        $engineerRole = Role::firstOrCreate(['role_name' => 'ENGINEER']);
        $engineer = User::factory()->create(['role_id' => $engineerRole->id]);

        $this->actingAs($engineer)
            ->postJson('/rab/approve', ['project_id' => $project->id])
            ->assertOk();
        $this->assertDatabaseHas('rab_budgets', ['id' => $rab->id, 'status' => 'APPROVED']);

        $rab->update(['status' => 'PENDING']);
        $purchasingRole = Role::firstOrCreate(['role_name' => 'PURCHASING_LEGAL']);
        $purchasing = User::factory()->create(['role_id' => $purchasingRole->id]);
        $this->actingAs($purchasing)
            ->postJson('/rab/approve', ['project_id' => $project->id])
            ->assertForbidden();
    }

    public function test_spk_invoice_must_reference_an_approved_opname_once(): void
    {
        $user = $this->adminUser();
        $this->actingAs($user);
        $project = $this->project();

        $spkRab = $this->rab($project, 'APPROVED');
        $spkRab->update(['category' => 'Subkon']);

        $sourcePoResponse = $this->actingAs($user)->postJson('/api/pos', [
            'project_id' => $project->id,
            'po_number' => 'PO-ERP-SPK-001',
            'date' => '2026-07-10',
            'po_level' => 'PROJECT',
            'items' => [[
                'rab_budget_id' => $spkRab->id,
                'item_name' => 'Pekerjaan SPK',
                'qty' => 1,
            ]],
        ])->assertCreated();
        $sourcePoId = $sourcePoResponse->json('data.id');
        $this->actingAs($user)->putJson("/api/pos/{$sourcePoId}/route", ['routed_to' => 'SPK'])->assertOk();

        $spkResponse = $this->actingAs($user)->postJson('/api/spks', [
            'project_id' => $project->id,
            'source_po_id' => $sourcePoId,
            'spk_number' => 'SPK-ERP-001',
            'spk_type' => 'SUBKON',
            'subcon_name' => 'CV Bangun Jaya',
            'subtotal' => 100000,
            'tax_rate' => 11,
            'payment_terms' => 'Berdasarkan opname',
        ])->assertCreated();

        $spkId = $spkResponse->json('data.id');
        $opnamePayload = [
            'spk_id' => $spkId,
            'opname_number' => 'OPN-ERP-001',
            'date' => '2026-07-10',
            'progress_percentage' => 25,
            'amount' => 27750,
        ];

        $this->postJson('/api/opnames', $opnamePayload)
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Opname hanya dapat dibuat untuk SPK yang sudah disetujui.');

        $this->actingAs($user)->putJson("/api/spks/{$spkId}/submit")->assertOk();
        $this->actingAs($user)->putJson("/api/spks/{$spkId}/approve")->assertOk();
        $opnameResponse = $this->postJson('/api/opnames', $opnamePayload)->assertCreated();
        $opnameId = $opnameResponse->json('data.id');

        $invoicePayload = [
            'invoiceable_type' => Spk::class,
            'invoiceable_id' => $spkId,
            'opname_id' => $opnameId,
            'invoice_number' => 'INV-SPK-001',
            'invoice_date' => '2026-07-10',
        ];

        $this->postJson('/api/invoices', $invoicePayload)
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Invoice SPK hanya dapat dibuat dari opname yang telah disetujui.');

        $this->actingAs($user)->putJson("/api/opnames/{$opnameId}/approve")->assertOk();
        $invoiceResponse = $this->postJson('/api/invoices', $invoicePayload)->assertCreated();

        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceResponse->json('data.id'),
            'opname_id' => $opnameId,
            'amount' => 27750,
            'status' => 'PENDING_ENGINEER',
        ]);

        $this->postJson('/api/invoices', [
            ...$invoicePayload,
            'invoice_number' => 'INV-SPK-002',
        ])->assertUnprocessable()
            ->assertJsonPath('message', 'Opname progres ini sudah memiliki invoice.');
    }

    public function test_fund_request_must_be_approved_paid_and_accounted_for_in_sequence(): void
    {
        $user = $this->adminUser();
        $this->actingAs($user);
        $project = $this->project();

        $fundResponse = $this->actingAs($user)->postJson('/api/fund-requests', [
            'project_id' => $project->id,
            'request_number' => 'PD-ERP-001',
            'amount' => 75000,
            'description' => 'Operasional lapangan',
        ])->assertCreated();

        $fundId = $fundResponse->json('data.id');

        $this->postJson("/api/fund-requests/{$fundId}/payments", ['payment_method' => 'TRANSFER'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Hanya permohonan dana yang sudah disetujui yang dapat dibayar.');

        $this->actingAs($user)->putJson("/api/fund-requests/{$fundId}/verify")->assertOk();
        $this->actingAs($user)->putJson("/api/fund-requests/{$fundId}/approve")->assertOk();
        $this->postJson("/api/fund-requests/{$fundId}/payments", ['payment_method' => 'TRANSFER'])->assertOk();
        $this->post("/api/fund-requests/{$fundId}/attachments", [
            'doc_type' => 'LPJ',
            'file' => UploadedFile::fake()->create('lpj.pdf', 10, 'application/pdf'),
        ])->assertCreated();
        $this->putJson("/api/fund-requests/{$fundId}/lpj", [
            'lpj_notes' => 'Bukti belanja lengkap.',
            'lpj_items' => [['description' => 'Operasional lapangan', 'amount' => 75000]],
        ])->assertOk();
        $this->actingAs($user)->putJson("/api/fund-requests/{$fundId}/lpj-verify")->assertOk();
        $this->actingAs($user)->putJson("/api/fund-requests/{$fundId}/lpj-approve")->assertOk();

        $this->assertDatabaseHas('fund_requests', ['id' => $fundId, 'status' => 'LPJ_APPROVED']);
        $this->assertDatabaseHas('transactions', ['fund_request_id' => $fundId, 'amount' => 75000]);
    }

    public function test_workflow_control_pages_are_available_to_authenticated_users(): void
    {
        $user = $this->adminUser();

        $this->actingAs($user)->get('/rab-control')->assertOk();
        $this->actingAs($user)->get('/spk')->assertOk();
    }

    public function test_rab_import_validates_every_row_and_archives_replaced_data(): void
    {
        $user = $this->adminUser();
        $this->actingAs($user);
        $project = $this->project();
        $existing = $this->rab($project, 'DRAFT');

        $this->post('/api/rab/auto-import', [
            'project_id' => $project->id,
            'confirm_replace' => true,
            'file' => $this->xlsx([
                ['Kode', 'Uraian', 'Volume', 'Satuan', 'Harga Satuan', 'Jumlah'],
                ['MAT-001', 'Semen', 'abc', 'Zak', '75000', ''],
            ]),
        ])->assertUnprocessable()
            ->assertJsonPath('message', 'Import dibatalkan. Perbaiki data pada baris yang ditandai.');

        $this->assertDatabaseHas('rab_budgets', ['id' => $existing->id, 'deleted_at' => null]);

        $rows = [
            ['Kode', 'Uraian', 'Volume', 'Satuan', 'Harga Satuan', 'Jumlah', 'Kategori'],
            ['MAT-001', 'Semen', '10', 'Zak', '75000', '750000', 'Material'],
            ['MAT-002', 'Pasir', '5', 'm3', '250000', '1250000', 'Material'],
        ];

        $this->post('/api/rab/auto-import', [
            'project_id' => $project->id,
            'file' => $this->xlsx($rows),
        ])->assertUnprocessable()
            ->assertJsonPath('requires_confirmation', true);

        $this->post('/api/rab/auto-import', [
            'project_id' => $project->id,
            'confirm_replace' => true,
            'file' => $this->xlsx($rows),
        ])->assertOk()
            ->assertJsonPath('data.imported', 2)
            ->assertJsonPath('data.archived', 1);

        $this->assertSoftDeleted('rab_budgets', ['id' => $existing->id]);
        $this->assertSame(2, RabBudget::where('project_id', $project->id)->count());
        $this->assertSame(3, RabBudget::withTrashed()->where('project_id', $project->id)->count());
    }

    public function test_partial_goods_receipt_updates_inventory_and_only_completes_po_when_all_items_arrive(): void
    {
        $user = $this->adminUser();
        $this->actingAs($user);
        $project = $this->project();
        $rab = $this->rab($project, 'APPROVED');
        $po = PurchaseOrder::create([
            'project_id' => $project->id,
            'po_number' => 'PO-PARTIAL-001',
            'date' => '2026-07-10',
            'supplier_name' => 'PT Material Utama',
            'subtotal' => 100000,
            'tax_amount' => 11000,
            'total_amount' => 111000,
            'status' => 'APPROVED',
            'created_by' => $user->id,
        ]);
        $poItem = PoItem::create([
            'purchase_order_id' => $po->id,
            'rab_budget_id' => $rab->id,
            'item_name' => 'Semen Portland',
            'qty' => 10,
            'unit_price' => 10000,
            'total_price' => 100000,
        ]);

        $this->postJson('/api/goods-receipts', [
            ...$this->receiptPayload($po->id, 'GR-PARTIAL-001'),
            'items' => [['po_item_id' => $poItem->id, 'quantity_received' => 4]],
        ])->assertCreated();

        $this->assertDatabaseHas('purchase_orders', ['id' => $po->id, 'status' => 'PARTIALLY_RECEIVED']);
        $this->assertDatabaseHas('inventory_stocks', ['project_id' => $project->id, 'rab_budget_id' => $rab->id, 'quantity' => 4]);

        $this->postJson('/api/goods-receipts', [
            ...$this->receiptPayload($po->id, 'GR-PARTIAL-002'),
            'items' => [['po_item_id' => $poItem->id, 'quantity_received' => 6]],
        ])->assertCreated();

        $this->assertDatabaseHas('purchase_orders', ['id' => $po->id, 'status' => 'RECEIVED']);
        $this->assertSame(10.0, (float) InventoryStock::firstOrFail()->quantity);
    }

    private function project(): Project
    {
        return Project::create([
            'project_name' => 'Proyek Alur ERP',
            'location' => 'Jakarta',
            'start_date' => '2026-07-10',
        ]);
    }

    private function rab(Project $project, string $status): RabBudget
    {
        return RabBudget::create([
            'project_id' => $project->id,
            'code_item' => 'MAT-001',
            'description' => 'Semen Portland',
            'unit' => 'Zak',
            'volume' => 2,
            'unit_price' => 50000,
            'total_price' => 100000,
            'category' => 'Material',
            'status' => $status,
        ]);
    }

    /** @return array<string, int|string> */
    private function receiptPayload(int $poId, string $receiptNumber): array
    {
        return [
            'purchase_order_id' => $poId,
            'receipt_number' => $receiptNumber,
            'receipt_date' => '2026-07-10',
            'delivery_note_number' => 'SJ-ERP-001',
            'receiver_name' => 'Petugas Lapangan',
        ];
    }

    /** @param array<int, array<int, string>> $rows */
    private function xlsx(array $rows): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'rab-import-');
        $zip = new \ZipArchive();
        $zip->open($path, \ZipArchive::OVERWRITE);

        $xmlRows = [];
        foreach ($rows as $rowIndex => $row) {
            $cells = [];
            foreach ($row as $columnIndex => $value) {
                $column = chr(65 + $columnIndex);
                $escaped = htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
                $cells[] = "<c r=\"{$column}" . ($rowIndex + 1) . "\" t=\"inlineStr\"><is><t>{$escaped}</t></is></c>";
            }
            $xmlRows[] = '<row r="' . ($rowIndex + 1) . '">' . implode('', $cells) . '</row>';
        }

        $zip->addFromString('xl/worksheets/sheet1.xml', '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' . implode('', $xmlRows) . '</sheetData></worksheet>');
        $zip->close();

        return new UploadedFile(
            $path,
            'rab-import.xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            null,
            true,
        );
    }
}