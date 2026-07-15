<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Efaktur extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'faktur_number',
        'faktur_date',
        'npwp_penjual',
        'nama_penjual',
        'npwp_pembeli',
        'nama_pembeli',
        'dpp',
        'ppn',
        'ppnbm',
        'status',
        'taxable_confirmation',
        'kpp_document_status',
        'ppn_treatment',
        'accounting_posted_at',
        'accounting_posted_by',
        'validation_errors',
        'notes',
        'project_id',
        'uploaded_by',
    ];

    protected $casts = [
        'faktur_date' => 'date',
        'dpp' => 'decimal:2',
        'ppn' => 'decimal:2',
        'ppnbm' => 'decimal:2',
        'accounting_posted_at' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function scopeByStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Validate a CSV row for required fields and types.
     * Returns array of error strings (empty = valid).
     */
    public static function validateRow(array $row): array
    {
        $errors = [];

        if (empty($row['faktur_number'] ?? '')) {
            $errors[] = 'faktur_number wajib diisi';
        }
        if (empty($row['faktur_date'] ?? '')) {
            $errors[] = 'faktur_date wajib diisi';
        } elseif (!strtotime($row['faktur_date'])) {
            $errors[] = 'faktur_date format tidak valid';
        }
        if (empty($row['npwp_penjual'] ?? '')) {
            $errors[] = 'npwp_penjual wajib diisi';
        }
        if (empty($row['nama_penjual'] ?? '')) {
            $errors[] = 'nama_penjual wajib diisi';
        }
        if (!isset($row['dpp']) || !is_numeric($row['dpp'])) {
            $errors[] = 'dpp wajib numerik';
        }

        return $errors;
    }
}
