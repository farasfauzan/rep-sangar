<?php

namespace App\Services;

use App\Models\User;
use App\Notifications\WorkflowNotification;

class WorkflowNotificationService
{
    /**
     * Send an in-app task notification to every user with the given role.
     * Administrators receive a copy so they can monitor every workflow handoff.
     */
    public function toRole(string $role, string $title, string $message, ?string $url = null, string $category = 'WORKFLOW'): void
    {
        $roles = array_values(array_unique([$role, 'ADMIN']));

        User::query()
            ->whereHas('role', fn ($query) => $query->whereIn('role_name', $roles))
            ->each(function (User $user) use ($title, $message, $role, $url, $category): void {
                $user->notify(new WorkflowNotification($title, $message, $role, $url, $category));
            });
    }

    public function toUser(?int $userId, string $title, string $message, ?string $url = null, string $category = 'WORKFLOW'): void
    {
        if (! $userId || ! ($user = User::find($userId))) {
            return;
        }

        $user->notify(new WorkflowNotification($title, $message, 'PEMBUAT DOKUMEN', $url, $category));
    }
}
