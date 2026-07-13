<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockMovement extends Model
    use HasFactory;
{
    protected $fillable = [
        'inventory_stock_id',
        'type',
        'quantity',
        'reference_type',
        'reference_id',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
    ];

    public function inventoryStock(): BelongsTo
    {
        return $this->belongsTo(InventoryStock::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
