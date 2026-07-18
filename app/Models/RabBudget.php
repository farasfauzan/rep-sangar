<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class RabBudget extends Model
{
    use HasFactory;
    use Auditable;
    use SoftDeletes;

    protected $fillable = [
        'project_id', 'code_item', 'description', 'unit', 'volume',
        'unit_price', 'total_price', 'category', 'ai_category', 'status',
        'parent_id', 'approved_by', 'approved_at', 'source_import_key',
        'source_file_fingerprint', 'source_sheet', 'source_row', 'imported_by',
    ];

    // Statuses
    const STATUS_DRAFT    = 'DRAFT';
    const STATUS_PENDING  = 'PENDING';
    const STATUS_APPROVED = 'APPROVED';
    const STATUS_REJECTED = 'REJECTED';
    const STATUS_ARCHIVED = 'ARCHIVED';

    const CATEGORY_MATERIAL = 'Material';
    const CATEGORY_SUBCON = 'Subkon';
    const CATEGORY_WORKER = 'Pekerja';
    const CATEGORY_EQUIPMENT = 'Alat';

    public function getBaseCategoryAttribute(): ?string
    {
        $category = trim((string) $this->category);
        if ($category === '') {
            return null;
        }

        $base = trim(explode(' / ', $category, 2)[0]);

        // Keep legacy RAB rows usable after the manual categories were added.
        return strcasecmp($base, 'Upah') === 0 ? self::CATEGORY_WORKER : $base;
    }

    public function isCategory(string $category): bool
    {
        return strcasecmp((string) $this->base_category, $category) === 0;
    }

    public function isMaterial(): bool
    {
        return $this->isCategory(self::CATEGORY_MATERIAL);
    }

    public function procurementDestination(): string
    {
        return $this->isMaterial() ? 'PURCHASE_ORDER' : 'SPK';
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function parent()
    {
        return $this->belongsTo(RabBudget::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(RabBudget::class, 'parent_id');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function importedBy()
    {
        return $this->belongsTo(User::class, 'imported_by');
    }

    // Lock check: cannot edit if APPROVED
    public function getIsLockedAttribute(): bool
    {
        return $this->status === self::STATUS_APPROVED;
    }

    // Submit for approval (bulk — all draft items for a project)
    public static function submitForApproval(int $projectId): int
    {
        return static::where('project_id', $projectId)
            ->where('status', self::STATUS_DRAFT)
            ->update(['status' => self::STATUS_PENDING]);
    }

    // Submit only the selected draft items for approval.
    public static function submitSelected(array $itemIds): int
    {
        return static::whereIn('id', $itemIds)
            ->where('status', self::STATUS_DRAFT)
            ->update(['status' => self::STATUS_PENDING]);
    }

    // Approve (bulk — all pending items for a project)
    public static function approveAll(int $projectId, User $user): int
    {
        return static::where('project_id', $projectId)
            ->where('status', self::STATUS_PENDING)
            ->update([
                'status'      => self::STATUS_APPROVED,
                'approved_by' => $user->id,
                'approved_at' => now(),
            ]);
    }

    // Approve selected items by ID
    public static function approveSelected(array $itemIds, User $user): int
    {
        return static::whereIn('id', $itemIds)
            ->where('status', self::STATUS_PENDING)
            ->update([
                'status'      => self::STATUS_APPROVED,
                'approved_by' => $user->id,
                'approved_at' => now(),
            ]);
    }

    // Reject (bulk — all pending items for a project)
    public static function rejectAll(int $projectId, User $user): int
    {
        return static::where('project_id', $projectId)
            ->where('status', self::STATUS_PENDING)
            ->update([
                'status'      => self::STATUS_REJECTED,
                'approved_by' => $user->id,
                'approved_at' => now(),
            ]);
    }

    // Reject selected items by ID
    public static function rejectSelected(array $itemIds, User $user): int
    {
        return static::whereIn('id', $itemIds)
            ->where('status', self::STATUS_PENDING)
            ->update([
                'status'      => self::STATUS_REJECTED,
                'approved_by' => $user->id,
                'approved_at' => now(),
            ]);
    }

    // Roll-up summary by category for a project
    public static function rollUp(int $projectId): array
    {
        return static::where('project_id', $projectId)
            ->selectRaw('category, SUM(total_price) as subtotal, COUNT(*) as item_count')
            ->groupBy('category')
            ->get()
            ->toArray();
    }

    // Total budget for a project
    public static function totalBudget(int $projectId): float
    {
        return (float) static::where('project_id', $projectId)->sum('total_price');
    }
}
