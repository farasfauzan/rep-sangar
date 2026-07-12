<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Http\Controllers\Api\RabBudgetController;
use Illuminate\Http\UploadedFile;
use Illuminate\Http\Request;

class TestImport extends Command
{
    protected $signature = 'test:import {file} {project_id=1}';
    protected $description = 'Test RAB Excel Import using the real controller import path';

    public function handle()
    {
        $file = $this->argument('file');
        $projectId = (int) $this->argument('project_id');

        if (! file_exists($file)) {
            $this->error("File not found: {$file}");
            return Command::FAILURE;
        }

        $this->info("Importing {$file} for project {$projectId}...");

        try {
            $uploadedFile = new UploadedFile(
                $file,
                basename($file),
                mime_content_type($file) ?: 'application/octet-stream',
                null,
                true
            );

            $request = Request::create('/api/rab-budgets/auto-import', 'POST');
            $request->files->set('file', $uploadedFile);
            $request->merge([
                'project_id' => $projectId,
                'confirm_replace' => true,
            ]);

            $controller = app(RabBudgetController::class);
            $response = $controller->autoImport($request);

            $data = json_decode($response->getContent(), true);

            if ($response->getStatusCode() >= 400) {
                $this->error("FAILED (HTTP {$response->getStatusCode()}): " . ($data['message'] ?? 'Unknown error'));

                if (! empty($data['errors'])) {
                    $this->warn('Validation errors:');
                    foreach (array_slice((array) $data['errors'], 0, 20) as $err) {
                        $this->line('  - ' . (is_string($err) ? $err : json_encode($err)));
                    }
                }

                return Command::FAILURE;
            }

            $this->info('SUCCESS!');
            $this->line('  Message: ' . ($data['message'] ?? '-'));
            $imported = $data['data']['imported'] ?? null;
            $archived = $data['data']['archived'] ?? null;
            if ($imported !== null) {
                $this->line("  Imported: {$imported} items");
            }
            if ($archived !== null) {
                $this->line("  Archived (old version): {$archived} items");
            }

            return Command::SUCCESS;
        } catch (\Throwable $e) {
            $this->error('Exception: ' . $e->getMessage());
            $this->error($e->getTraceAsString());
            return Command::FAILURE;
        }
    }
}