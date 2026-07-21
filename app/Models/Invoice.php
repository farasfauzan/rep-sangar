<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Invoice extends Model
{
    use HasFactory;
    protected $fillable = [
        'invoiceable_type', 'invoiceable_id', 'invoice_number', 
        'opname_id', 'invoice_date', 'due_date', 'amount', 'status',
        'cashflow_status'
    ];

    protected $appends = ['missing_documents'];

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

    public function getMissingDocumentsAttribute(): array
    {
        $required = $this->invoiceable_type === PurchaseOrder::class
            ? ['INVOICE', 'PO', 'SURAT_JALAN']
            : ['INVOICE', 'SPK', 'OPNAME', 'BAST'];
        $available = $this->relationLoaded('attachments')
            ? $this->attachments->pluck('doc_type')->all()
            : $this->attachments()->pluck('doc_type')->all();

        return array_values(array_diff($required, $available));
    }
}
