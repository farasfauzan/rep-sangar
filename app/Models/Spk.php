<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Spk extends Model
{
    use HasFactory;
    protected $fillable = ['project_id', 'source_po_id', 'spk_number', 'spk_type', 'subcon_name', 'subtotal', 'tax_amount', 'total_amount', 'include_ppn', 'payment_terms', 'jadwal_kirim', 'status', 'created_by', 'approved_by'];

    protected $casts = [
        'include_ppn' => 'boolean',
        'jadwal_kirim' => 'date',
        'subtotal' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function sourcePo()
    {
        return $this->belongsTo(PurchaseOrder::class, 'source_po_id');
    }

    public function progress()
    {
        return $this->hasMany(SpkProgress::class);
    }

    public function invoices()
    {
        return $this->morphMany(Invoice::class, 'invoiceable');
    }
}
