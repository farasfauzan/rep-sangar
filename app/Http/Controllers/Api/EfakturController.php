<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Efaktur;
use App\Models\ChartOfAccount;
use App\Models\GeneralLedger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class EfakturController extends Controller
{
    /**
     * List e-Faktur records (paginated, filterable).
     */
    public function index(Request $request): JsonResponse
    {
        $query = Efaktur::with(['project', 'uploader'])->orderByDesc('faktur_date');

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('date_from')) {
            $query->where('faktur_date', '>=', $request->input('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->where('faktur_date', '<=', $request->input('date_to'));
        }
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('faktur_number', 'like', "%{$search}%")
                  ->orWhere('nama_penjual', 'like', "%{$search}%")
                  ->orWhere('nama_pembeli', 'like', "%{$search}%");
            });
        }

        return response()->json([
            'success' => true,
            'data' => $query->paginate($request->integer('per_page', 25)),
        ]);
    }

    /**
     * Show single e-Faktur.
     */
    public function show(int $id): JsonResponse
    {
        $efaktur = Efaktur::with(['project', 'uploader'])->findOrFail($id);

        return response()->json(['success' => true, 'data' => $efaktur]);
    }

    /**
     * Upload CSV and import e-Faktur records.
     * CSV columns: faktur_number, faktur_date, npwp_penjual, nama_penjual,
     *              npwp_pembeli, nama_pembeli, dpp, ppn, ppnbm
     */
    public function uploadCsv(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt|max:10240',
            'project_id' => 'nullable|exists:projects,id',
        ]);

        $file = $request->file('file');
        $handle = fopen($file->getRealPath(), 'r');
        $header = fgetcsv($handle);

        if (!$header) {
            return response()->json(['success' => false, 'message' => 'File CSV kosong.'], 422);
        }

        // Normalize header: lowercase, replace spaces with underscores
        $header = array_map(fn($h) => strtolower(trim(str_replace(' ', '_', $h))), $header);

        $imported = 0;
        $skipped = 0;
        $errors = [];
        $lineNum = 1;

        try {
            DB::transaction(function () use ($handle, $header, &$lineNum, &$imported, &$skipped, &$errors, $request) {
                while (($row = fgetcsv($handle)) !== false) {
                    $lineNum++;
                    $data = @array_combine($header, $row);

                    if (!$data) {
                        $errors[] = ['line' => $lineNum, 'error' => 'Jumlah kolom tidak sesuai header.'];
                        $skipped++;
                        continue;
                    }

                    $rowErrors = Efaktur::validateRow($data);
                    if (!empty($rowErrors)) {
                        $errors[] = ['line' => $lineNum, 'errors' => $rowErrors];
                        $skipped++;
                        continue;
                    }

                    // Calculate PPN if not provided: 11% of DPP
                    $dpp = (float) $data['dpp'];
                    $ppn = isset($data['ppn']) && is_numeric($data['ppn'])
                        ? (float) $data['ppn']
                        : round($dpp * 0.11, 2);
                    $ppnbm = isset($data['ppnbm']) && is_numeric($data['ppnbm'])
                        ? (float) $data['ppnbm']
                        : 0;

                    Efaktur::create([
                        'faktur_number' => $data['faktur_number'],
                        'faktur_date' => $data['faktur_date'],
                        'npwp_penjual' => $data['npwp_penjual'],
                        'nama_penjual' => $data['nama_penjual'],
                        'npwp_pembeli' => $data['npwp_pembeli'] ?? null,
                        'nama_pembeli' => $data['nama_pembeli'] ?? null,
                        'dpp' => $dpp,
                        'ppn' => $ppn,
                        'ppnbm' => $ppnbm,
                        'status' => 'draft',
                        'project_id' => $request->input('project_id'),
                        'uploaded_by' => Auth::id(),
                    ]);
                    $imported++;
                }
            });

            fclose($handle);
        } catch (\Exception $e) {
            fclose($handle);
            return response()->json(['success' => false, 'message' => 'Gagal import: ' . $e->getMessage()], 500);
        }

        return response()->json([
            'success' => true,
            'message' => "Import selesai: {$imported} berhasil, {$skipped} gagal.",
            'imported' => $imported,
            'skipped' => $skipped,
            'errors' => $errors,
        ], $imported > 0 ? 200 : 422);
    }

    /**
     * Validate a single e-Faktur record (check business rules).
     */
    public function validateRecord(int $id): JsonResponse
    {
        $efaktur = Efaktur::findOrFail($id);

        if ($efaktur->status !== 'draft') {
            return response()->json([
                'success' => false,
                'message' => 'Hanya e-Faktur berstatus draft yang bisa divalidasi.',
            ], 422);
        }

        $errors = Efaktur::validateRow([
            'faktur_number' => $efaktur->faktur_number,
            'faktur_date' => $efaktur->faktur_date->format('Y-m-d'),
            'npwp_penjual' => $efaktur->npwp_penjual,
            'nama_penjual' => $efaktur->nama_penjual,
            'dpp' => $efaktur->dpp,
        ]);

        // Additional business validation
        if ($efaktur->dpp > 0 && $efaktur->ppn > 0) {
            $expectedPpn = round($efaktur->dpp * 0.11, 2);
            if (abs($efaktur->ppn - $expectedPpn) > 1) {
                $errors[] = "PPN ({$efaktur->ppn}) tidak sesuai 11% dari DPP (expected: {$expectedPpn})";
            }
        }

        if (!empty($errors)) {
            $efaktur->update([
                'status' => 'rejected',
                'validation_errors' => json_encode($errors),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Validasi gagal.',
                'errors' => $errors,
                'data' => $efaktur->fresh(),
            ], 422);
        }

        $efaktur->update([
            'status' => 'validated',
            'validation_errors' => null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'E-Faktur berhasil divalidasi.',
            'data' => $efaktur->fresh(),
        ]);
    }

    /**
     * Update e-Faktur status (submit / approve / reject).
     */
    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'status' => 'required|in:submitted,approved,rejected',
            'notes' => 'nullable|string|max:1000',
        ]);

        $efaktur = Efaktur::findOrFail($id);
        $newStatus = $request->input('status');

        $allowedTransitions = [
            'validated' => ['submitted'],
            'submitted' => ['approved', 'rejected'],
        ];

        $allowed = $allowedTransitions[$efaktur->status] ?? [];

        if (!in_array($newStatus, $allowed)) {
            return response()->json([
                'success' => false,
                'message' => "Tidak bisa ubah status dari {$efaktur->status} ke {$newStatus}.",
            ], 422);
        }

        $efaktur->update([
            'status' => $newStatus,
            'notes' => $request->input('notes', $efaktur->notes),
        ]);

        return response()->json([
            'success' => true,
            'message' => "Status e-Faktur diubah ke {$newStatus}.",
            'data' => $efaktur->fresh(),
        ]);
    }

    public function confirmTaxable(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate(['taxable_confirmation' => 'required|in:CONFIRMED,NOT_TAXABLE']);
        $efaktur = Efaktur::findOrFail($id);
        if ($efaktur->status !== 'validated') {
            return response()->json(['success' => false, 'message' => 'E-Faktur harus divalidasi sebelum konfirmasi pajak.'], 422);
        }
        $efaktur->update(['taxable_confirmation' => $validated['taxable_confirmation']]);

        return response()->json(['success' => true, 'message' => 'Konfirmasi barang kena pajak disimpan.', 'data' => $efaktur->fresh()]);
    }

    public function submitKpp(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'kpp_document_status' => 'required|in:COMPLETE,INCOMPLETE',
            'ppn_treatment' => 'nullable|in:COMPENSATE,RESTITUTION',
        ]);
        $efaktur = Efaktur::findOrFail($id);
        if ($efaktur->taxable_confirmation === 'PENDING') {
            return response()->json(['success' => false, 'message' => 'Konfirmasi barang kena pajak belum diisi.'], 422);
        }
        $efaktur->update([
            'kpp_document_status' => $validated['kpp_document_status'],
            'ppn_treatment' => $validated['ppn_treatment'] ?? $efaktur->ppn_treatment,
        ]);

        return response()->json(['success' => true, 'message' => 'Status berkas KPP dan perlakuan PPN disimpan.', 'data' => $efaktur->fresh()]);
    }

    public function postToAccounting(Request $request, int $id): JsonResponse
    {
        $efaktur = Efaktur::findOrFail($id);
        if ($efaktur->status !== 'approved' || $efaktur->kpp_document_status !== 'COMPLETE') {
            return response()->json(['success' => false, 'message' => 'E-Faktur harus approved dan berkas KPP lengkap sebelum direkap Accounting.'], 422);
        }
        if ($efaktur->accounting_posted_at) {
            return response()->json(['success' => false, 'message' => 'E-Faktur sudah direkap Accounting.'], 422);
        }
        $coaPpn = ChartOfAccount::where('code', '1400')->exists();
        $coaPayable = ChartOfAccount::where('code', '2100')->exists();
        if ($coaPpn && $coaPayable) {
            $journal = 'JRN-' . now()->format('Ymd') . '-' . str_pad((string) (GeneralLedger::whereDate('transaction_date', now())->count() + 1), 4, '0', STR_PAD_LEFT);
            foreach ([['1400', (float) $efaktur->ppn, 0], ['2100', 0, (float) $efaktur->ppn]] as [$account, $debit, $credit]) {
                GeneralLedger::create([
                    'journal_number' => $journal,
                    'transaction_date' => $efaktur->faktur_date,
                    'account_code' => $account,
                    'description' => "Rekap e-Faktur {$efaktur->faktur_number}",
                    'debit' => $debit,
                    'credit' => $credit,
                    'reference_type' => Efaktur::class,
                    'reference_id' => $efaktur->id,
                    'project_id' => $efaktur->project_id,
                    'created_by' => $request->user()->id,
                ]);
            }
        }
        $efaktur->update(['accounting_posted_at' => now(), 'accounting_posted_by' => $request->user()->id]);

        return response()->json(['success' => true, 'message' => 'E-Faktur direkap ke Accounting.', 'data' => $efaktur->fresh()]);
    }

    /**
     * Delete e-Faktur.
     */
    public function destroy(int $id): JsonResponse
    {
        $efaktur = Efaktur::findOrFail($id);
        $efaktur->delete();

        return response()->json(['success' => true, 'message' => 'E-Faktur berhasil dihapus.']);
    }
}
