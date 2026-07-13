<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PoItem extends Model
{
    use HasFactory;
    protected $fillable = ['purchase_order_id', 'rab_budget_id', 'item_name', 'qty', 'unit_price', 'total_price'];

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function rabBudget()
    {
        return $this->belongsTo(RabBudget::class)->withTrashed();
    }

    public function goodsReceiptItems()
    {
        return $this->hasMany(GoodsReceiptItem::class);
    }
}
