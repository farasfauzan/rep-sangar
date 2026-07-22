<?php

namespace Tests\Feature\Api;

use App\Models\Invoice;
use App\Models\InvoiceAttachment;
use App\Models\PoItem;
use App\Models\PurchaseOrder;
use App\Models\GoodsReceipt;
use Illuminate\Support\Facades\DB;

class InvoiceControllerTest extends TestCase
{
    public function test_index_returns_paginated_invoices(): void
    {
        $this->actingAsRole('LAPANGAN');
        Invoice::factory()->count(3)->create();

        $this->getJson('/api/invoices')
            ->assertOk()
            ->assertJsonStructure(['current_page', 'data', 'per_page', 'total']);
    }

    public function test_store_creates_invoice_from_received_po(): void
    {
        $this->actingAsRole('ADMIN');
        $po = PurchaseOrder::factory()->received()->create();
        $poItem = PoItem::factory()->create(['purchase_order_id' => $po->id]);
        
        $receipt = GoodsReceipt::factory()->create(['purchase_order_id' => $po->id]);
        
        // Injeksi manual receipt item agar nilai invoice tidak dibaca 0 oleh controller
        DB::table('goods_receipt_items')->insert([
            'goods_receipt_id' => $receipt->id,
            'po_item_id' => $poItem->id,
            'quantity_received' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->postJson('/api/invoices', [
            'invoiceable_type' => 'App\\Models\\PurchaseOrder',
            'invoiceable_id'   => $po->id,
            'invoice_number'   => 'INV-TEST-001',
            'invoice_date'     => '2026-07-10',
        ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'PENDING_ENGINEER');

        $this->assertDatabaseHas('invoices', [
            'invoice_number' => 'INV-TEST-001',
            'status'         => 'PENDING_ENGINEER',
        ]);
    }

    public function test_store_validates_required_fields(): void
    {
        $this->actingAsRole('ADMIN');

        $this->postJson('/api/invoices', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'invoiceable_type',
                'invoiceable_id',
                'invoice_number',
                'invoice_date',
            ]);
    }

    public function test_store_rejects_non_received_po(): void
    {
        $this->actingAsRole('ADMIN');
        $po = PurchaseOrder::factory()->create(['status' => 'APPROVED']);
        PoItem::factory()->create(['purchase_order_id' => $po->id]);

        $this->postJson('/api/invoices', [
            'invoiceable_type' => 'App\\Models\\PurchaseOrder',
            'invoiceable_id'   => $po->id,
            'invoice_number'   => 'INV-BAD-001',
            'invoice_date'     => '2026-07-10',
        ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Invoice material hanya dapat dibuat setelah barang diterima (minimal sebagian).');
    }

    public function test_store_rejects_duplicate_invoice_for_po(): void
    {
        $this->actingAsRole('ADMIN');
        $po = PurchaseOrder::factory()->received()->create();
        $poItem = PoItem::factory()->create(['purchase_order_id' => $po->id]);
        
        $receipt = GoodsReceipt::factory()->create(['purchase_order_id' => $po->id]);
        DB::table('goods_receipt_items')->insert([
            'goods_receipt_id' => $receipt->id,
            'po_item_id' => $poItem->id,
            'quantity_received' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Invoice::factory()->create([
            'invoiceable_type' => 'App\\Models\\PurchaseOrder',
            'invoiceable_id'   => $po->id,
        ]);

        $this->postJson('/api/invoices', [
            'invoiceable_type' => 'App\\Models\\PurchaseOrder',
            'invoiceable_id'   => $po->id,
            'invoice_number'   => 'INV-DUP-001',
            'invoice_date'     => '2026-07-10',
        ])
            ->assertUnprocessable();
    }

    public function test_engineer_can_verify_invoice(): void
    {
        $this->actingAsRole('ENGINEER');
        $invoice = Invoice::factory()->pendingEngineer()->create();

        $this->putJson("/api/invoices/{$invoice->id}/engineer-verify")
            ->assertOk()
            ->assertJsonPath('data.status', 'ENGINEER_VERIFIED');
    }

    public function test_engineer_verify_rejects_wrong_status(): void
    {
        $this->actingAsRole('ENGINEER');
        $invoice = Invoice::factory()->create(['status' => 'ENGINEER_VERIFIED']);

        $this->putJson("/api/invoices/{$invoice->id}/engineer-verify")
            ->assertUnprocessable();
    }

    public function test_purchasing_cannot_engineer_verify(): void
    {
        $this->actingAsRole('PURCHASING_LEGAL');
        $invoice = Invoice::factory()->pendingEngineer()->create();

        $this->putJson("/api/invoices/{$invoice->id}/engineer-verify")
            ->assertForbidden();
    }

    public function test_verifikator_keu_can_finance_verify(): void
    {
        $this->actingAsRole('VERIFIKATOR_KEU');
        $invoice = Invoice::factory()->engineerVerified()->create();
        foreach (['INVOICE', 'PO', 'SURAT_JALAN'] as $docType) {
            InvoiceAttachment::create(['invoice_id' => $invoice->id, 'doc_type' => $docType, 'file_path' => "{$docType}.pdf", 'file_name' => "{$docType}.pdf"]);
        }

        $this->putJson("/api/invoices/{$invoice->id}/finance-verify")
            ->assertOk()
            ->assertJsonPath('data.status', 'PENDING_APPROVAL');
    }

    public function test_finance_verify_requires_engineer_verified(): void
    {
        $this->actingAsRole('VERIFIKATOR_KEU');
        $invoice = Invoice::factory()->pendingEngineer()->create();

        $this->putJson("/api/invoices/{$invoice->id}/finance-verify")
            ->assertUnprocessable();
    }

    public function test_mgr_komersial_can_approve_invoice(): void
    {
        $this->actingAsRole('MGR_KOMERSIAL');
        $invoice = Invoice::factory()->pendingApproval()->create();

        $this->putJson("/api/invoices/{$invoice->id}/manager-approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'PENDING_CASHFLOW');
    }

    public function test_manager_approve_requires_pending_approval(): void
    {
        $this->actingAsRole('MGR_KOMERSIAL');
        $invoice = Invoice::factory()->engineerVerified()->create();

        $this->putJson("/api/invoices/{$invoice->id}/manager-approve")
            ->assertUnprocessable();
    }

    public function test_full_invoice_pipeline_from_engineer_to_paid(): void
    {
        $this->actingAsRole('ADMIN');
        $po = PurchaseOrder::factory()->received()->create();

        $invoice = Invoice::factory()->create([
            'invoiceable_type' => 'App\\Models\\PurchaseOrder',
            'invoiceable_id'   => $po->id,
            'status'           => 'PENDING_ENGINEER',
        ]);
        foreach (['INVOICE', 'PO', 'SURAT_JALAN'] as $docType) {
            InvoiceAttachment::create(['invoice_id' => $invoice->id, 'doc_type' => $docType, 'file_path' => "{$docType}.pdf", 'file_name' => "{$docType}.pdf"]);
        }

        $this->putJson("/api/invoices/{$invoice->id}/engineer-verify")->assertOk();
        $this->putJson("/api/invoices/{$invoice->id}/finance-verify")->assertOk();
        $this->putJson("/api/invoices/{$invoice->id}/manager-approve")->assertOk();
        $this->putJson("/api/invoices/{$invoice->id}/cashflow-approve", ['cashflow_status' => 'APPROVED'])->assertOk();

        $this->postJson("/api/invoices/{$invoice->id}/payments", [
            'payment_method' => 'TRANSFER',
            'proof_of_payment' => 'Bukti Transfer',
        ])->assertOk();

        $this->assertDatabaseHas('invoices', ['id' => $invoice->id, 'status' => 'PAID']);
        $this->assertDatabaseHas('transactions', ['invoice_id' => $invoice->id]);
    }
}