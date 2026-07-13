<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FundRequest extends Model
{
    use HasFactory;
    protected $fillable = [
        'project_id', 'request_number', 'amount', 'description', 'status',
        'requested_by', 'approved_by', 'approved_at', 'paid_at',
        'lpj_submitted_at', 'lpj_notes'
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function transactions()
    {
        return $this->hasMany(Transaction::class);
    }
}
