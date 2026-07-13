<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SpkProgress extends Model
{
    protected $table = 'spk_progress';

    protected $fillable = [
        'spk_id',
        'rab_budget_id',
        'work_description',
        'progress_percentage',
        'amount',
        'created_by',
    ];

    protected $casts = [
        'progress_percentage' => 'decimal:2',
        'amount' => 'decimal:2',
    ];

    public function spk(): BelongsTo
    {
        return $this->belongsTo(Spk::class);
    }

    public function rabBudget(): BelongsTo
    {
        return $this->belongsTo(RabBudget::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
