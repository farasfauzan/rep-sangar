<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Invoice extends Model
{
    use HasFactory;
    protected $fillable = [
        'invoiceable_type', 'invoiceable_id', 'invoice_number', 
        'opname_id', 'invoice_date', 'due_date', 'amount', 'status'
    ];

    public function invoiceable()
    {
        return $this->morphTo();
    }

    public function attachments()
    {
        return $this->hasMany(InvoiceAttachment::class);
    }

    public function transactions()
    {
        return $this->hasMany(Transaction::class);
    }

    public function opname()
    {
        return $this->belongsTo(Opname::class);
    }
}
