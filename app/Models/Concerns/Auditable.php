<?php

namespace App\Models\Concerns;

use App\Models\AuditLog;

trait Auditable
{
    protected static function bootAuditable(): void
    {
        static::created(function ($model) {
            $model->audit('CREATED', [], $model->getAttributes());
        });

        static::updated(function ($model) {
            $dirty = $model->getDirty();
            if (empty($dirty)) return;

            $old = [];
            foreach (array_keys($dirty) as $key) {
                $old[$key] = $model->getOriginal($key);
            }

            $action = isset($dirty['status']) ? 'STATUS_CHANGED' : 'UPDATED';
            $model->audit($action, $old, $dirty);
        });

        static::deleted(function ($model) {
            $model->audit('DELETED', $model->getOriginal(), []);
        });
    }

    protected function audit(string $action, array $old, array $new): void
    {
        $userId = request()->user()?->id;

        // Jangan menulis audit log jika tidak ada user terautentikasi.
        // Sebelumnya fallback ke user_id=1 yang menyesatkan akuntabilitas.
        if ($userId === null) {
            return;
        }

        AuditLog::create([
            'user_id'        => $userId,
            'auditable_type' => static::class,
            'auditable_id'   => $this->getKey(),
            'action'         => $action,
            'old_values'     => $old ?: null,
            'new_values'     => $new ?: null,
        ]);
    }

    public function auditLogs()
    {
        return $this->morphMany(AuditLog::class, 'auditable');
    }
}