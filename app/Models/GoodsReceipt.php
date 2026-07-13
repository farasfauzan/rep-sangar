<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GoodsReceipt extends Model
{
    use HasFactory;
    protected $fillable = [
        'purchase_order_id', 'receipt_number', 'receipt_date',
        'delivery_note_number', 'receiver_name', 'notes'
    ];

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function items()
    {
        return $this->hasMany(GoodsReceiptItem::class);
    }

    public function project()
    {
        return $this->purchaseOrder?->project();
    }
}
