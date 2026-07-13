<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Spk extends Model
{
    use HasFactory;
    protected $fillable = ['project_id', 'spk_number', 'subcon_name', 'subtotal', 'tax_amount', 'total_amount', 'payment_terms', 'status', 'created_by', 'approved_by'];

    public function project()
    {
        return $this->belongsTo(Project::class);
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
