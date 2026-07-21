<?php

namespace Tests\Feature;

use App\Models\PoItem;
use App\Models\Project;
use App\Models\PurchaseOrder;
use App\Models\RabBudget;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PurchaseOrderPrintTest extends TestCase
{
    use RefreshDatabase;

    public function test_purchase_order_print_uses_the_company_po_format(): void
    {
        $user = User::factory()->create();
        $project = Project::factory()->create([
            'project_name' => 'GIK UGM',
            'location' => 'Yogyakarta',
        ]);
        $rab = RabBudget::factory()->approved()->create([
            'project_id' => $project->id,
            'description' => 'Plat 20 mm',
            'unit' => 'kg',
        ]);
        $po = PurchaseOrder::factory()->create([
            'project_id' => $project->id,
            'po_number' => '190V/SCS-SMG/GIK-UGM/PO/IV/2026',
            'supplier_name' => 'PT. Prima Usaha Sarana Sejahtera',
            'supplier_contact_person' => 'Bpk. Rujikan',
            'project_location' => 'Yogyakarta',
            'total_amount' => 18000000,
        ]);
        PoItem::factory()->create([
            'purchase_order_id' => $po->id,
            'rab_budget_id' => $rab->id,
            'item_name' => 'Plat 20 mm',
            'qty' => 12,
            'unit_price' => 1500000,
            'total_price' => 18000000,
        ]);

        $this->actingAs($user)
            ->get("/purchase-orders/{$po->id}/print")
            ->assertOk()
            ->assertSeeTextInOrder([
                'Kepada Yth.',
                'PT. Prima Usaha Sarana Sejahtera',
                'PURCHASE ORDER',
                '190V/SCS-SMG/GIK-UGM/PO/IV/2026',
                'Plat 20 mm',
                'TOTAL',
                'PT. SINAR CERAH SEMPURNA',
                'NARWAN PRATANTA, ST',
            ])
            ->assertDontSeeText('PT. Nama Perusahaan')
            ->assertSee('display: table-header-group', false)
            ->assertSee('page-break-inside: avoid', false)
            ->assertSee('class="post-table"', false);
    }
}
