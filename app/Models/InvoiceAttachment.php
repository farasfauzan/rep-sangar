<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InvoiceAttachment extends Model
{
    protected $fillable = ['invoice_id', 'doc_type', 'file_path', 'file_name', 'uploaded_by'];

    public function invoice()
    {
        return $this->belongsTo(Invoice::class);
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
