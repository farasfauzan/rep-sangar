<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FundRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id', 'request_number', 'amount', 'description', 'status',
        'requested_by', 'verified_by', 'verified_at', 'approved_by', 'approved_at', 'paid_at',
        'lpj_submitted_at', 'lpj_verified_by', 'lpj_verified_at', 'lpj_approved_by',
        'lpj_approved_at', 'lpj_notes', 'lpj_items', 'rejection_notes',
    ];

    protected $casts = [
        'lpj_items' => 'array',
        'amount' => 'decimal:2',
        'verified_at' => 'datetime',
        'approved_at' => 'datetime',
        'paid_at' => 'datetime',
        'lpj_submitted_at' => 'datetime',
        'lpj_verified_at' => 'datetime',
        'lpj_approved_at' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    public function fundReceipts(): HasMany
    {
        return $this->hasMany(FundReceipt::class);
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(FundRequestAttachment::class);
    }
}
