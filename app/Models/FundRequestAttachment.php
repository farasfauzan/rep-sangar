<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FundRequestAttachment extends Model
{
    protected $fillable = [
        'fund_request_id', 'doc_type', 'file_path', 'file_name', 'uploaded_by',
    ];

    public function fundRequest()
    {
        return $this->belongsTo(FundRequest::class);
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
