<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PurchaseOrder extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'parent_po_id',
        'po_number',
        'date',
        'supplier_name',
        'po_type',
        'addendum_number',
        'supplier_address',
        'supplier_phone',
        'supplier_contact_person',
        'project_location',
        'discount',
        'include_ppn',
        'catatan',
        'faktur_pajak_nama',
        'faktur_pajak_npwp',
        'faktur_pajak_alamat',
        'subtotal',
        'tax_amount',
        'total_amount',
        'payment_terms',
        'jadwal_kirim',
        'status',
        'po_level',
        'routed_to',
        'routed_by',
        'routed_at',
        'created_by',
        'approved_by',
        'contact_person',
        'supplier_address',
    ];

    protected $casts = [
        'include_ppn' => 'boolean',
        'discount' => 'decimal:2',
        'jadwal_kirim' => 'date',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function parentPo()
    {
        return $this->belongsTo(self::class, 'parent_po_id');
    }

    public function childPurchaseOrders()
    {
        return $this->hasMany(self::class, 'parent_po_id');
    }

    public function childSpks()
    {
        return $this->hasMany(Spk::class, 'source_po_id');
    }

    public function items()
    {
        return $this->hasMany(PoItem::class);
    }

    public function invoices()
    {
        return $this->morphMany(Invoice::class, 'invoiceable');
    }

    public function attachments()
    {
        return $this->hasMany(PoAttachment::class);
    }
}
