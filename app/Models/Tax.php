<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Tax extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'name',
        'rate',
        'type',
        'is_active',
        'description',
    ];

    protected $casts = [
        'rate' => 'decimal:4',
        'is_active' => 'boolean',
    ];

    /**
     * Scope: only active taxes.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Calculate tax for a given amount.
     */
    public function calculateTax(float $amount): array
    {
        $taxAmount = round($amount * $this->rate, 2);

        return [
            'subtotal' => $amount,
            'tax_amount' => $taxAmount,
            'total' => $amount + $taxAmount,
        ];
    }
}
