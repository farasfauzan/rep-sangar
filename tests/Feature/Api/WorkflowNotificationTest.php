<?php

namespace Tests\Feature\Api;

use App\Models\Project;
use App\Models\RabBudget;

class WorkflowNotificationTest extends TestCase
{
    public function test_creating_project_po_notifies_engineer_and_admin(): void
    {
        $engineer = $this->createUser('ENGINEER');
        $admin = $this->createUser('ADMIN');
        $this->actingAsRole('LAPANGAN');

        $project = Project::factory()->create();
        $rab = RabBudget::factory()->approved()->create(['project_id' => $project->id]);

        $this->postJson('/api/pos', [
            'project_id' => $project->id,
            'po_number' => 'PO-NOTIFY-001',
            'date' => '2026-07-15',
            'po_level' => 'PROJECT',
            'items' => [[
                'rab_budget_id' => $rab->id,
                'item_name' => $rab->description,
                'qty' => 1,
            ]],
        ])->assertCreated()->assertJsonPath('message', 'Draft PO Proyek dibuat dan dikirim ke Engineer untuk routing.');

        $this->assertDatabaseCount('notifications', 2);
        $this->assertDatabaseHas('notifications', [
            'notifiable_type' => $engineer::class,
            'notifiable_id' => $engineer->id,
        ]);
        $this->assertDatabaseHas('notifications', [
            'notifiable_type' => $admin::class,
            'notifiable_id' => $admin->id,
        ]);
    }

    public function test_recipient_can_view_and_mark_workflow_notification_read(): void
    {
        $engineer = $this->createUser('ENGINEER');
        $engineer->notify(new \App\Notifications\WorkflowNotification(
            'PO Proyek menunggu routing',
            'PO-NOTIFY-002 perlu diverifikasi.',
            'ENGINEER',
            '/approval'
        ));

        $this->actingAs($engineer);

        $notificationId = $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 1)
            ->json('data.0.id');

        $this->putJson("/api/notifications/{$notificationId}/read")
            ->assertOk()
            ->assertJsonPath('unread_count', 0);

        $this->assertDatabaseHas('notifications', ['id' => $notificationId, 'notifiable_id' => $engineer->id]);
    }
}
