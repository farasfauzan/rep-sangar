<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PurchaseOrder extends Model
{
    use HasFactory;
    protected $fillable = ['project_id', 'po_number', 'date', 'supplier_name', 'subtotal', 'tax_amount', 'total_amount', 'payment_terms', 'status', 'created_by', 'approved_by'];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function items()
    {
        return $this->hasMany(PoItem::class);
    }

    public function invoices()
    {
        return $this->morphMany(Invoice::class, 'invoiceable');
    }
}
