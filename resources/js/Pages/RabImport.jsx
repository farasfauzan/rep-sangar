import React from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useApi } from '@/hooks/useApi';
import { useProjects } from '@/hooks/useProjects';
import { useEffect, useState } from 'react';
import { useForm } from '@inertiajs/react';

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function RabImport() {
    const { projects } = useProjects();
    const api = useApi();
    
    const [step, setStep] = useState('upload'); // upload, preview, validate, confirm
    const [file, setFile] = useState(null);
    const [fileId, setFileId] = useState('');
    const [originalName, setOriginalName] = useState('');
    const [sheets, setSheets] = useState([]);
    const [selectedSheet, setSelectedSheet] = useState('');
    const [previewData, setPreviewData] = useState(null);
    const [validationResult, setValidationResult] = useState(null);
    const [projectId, setProjectId] = useState('');
    const [projectsList, setProjectsList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    // Load projects on mount
    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        try {
            const response = await api.get('/api/rab/import/projects');
            const data = Array.isArray(response.data) ? response.data : (response.data?.data || []);
            setProjectsList(data);
        } catch (err) {
            console.error('Failed to load projects', err);
            setProjectsList([]);
        }
    };

    const handleFileChange = (e) => {
        const f = e.target.files[0];
        if (f) {
            setFile(f);
            setError('');
        }
    };

    const uploadFile = async () => {
        if (!file) {
            setError('Pilih file Excel terlebih dahulu');
            return;
        }

        setLoading(true);
        setError('');
        setMessage('');

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/rab/import/upload', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || '',
                    'Accept': 'application/json',
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Upload gagal');
            }

            setFileId(data.file_id);
            setOriginalName(data.original_name);
            setSheets(data.sheets);
            setStep('preview');
            setMessage(`File "${data.original_name}" diupload. Pilih sheet di bawah.`);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const loadPreview = async () => {
        if (!selectedSheet) {
            setError('Pilih sheet terlebih dahulu');
            return;
        }

        setLoading(true);
        setError('');
        setMessage('');

        try {
            const response = await api.post('/api/rab/import/preview', {
                file_id: fileId,
                sheet: selectedSheet,
            });

            setPreviewData(response.data);
            setStep('validate');
            setMessage(`Preview ${response.data.rows.length} baris dari sheet "${selectedSheet}"`);
        } catch (err) {
            setError(err.response?.data?.error || 'Gagal memuat preview');
        } finally {
            setLoading(false);
        }
    };

    const runValidation = async () => {
        if (!selectedSheet) return;

        setLoading(true);
        setError('');
        setMessage('');

        try {
            const response = await api.post('/api/rab/import/validate', {
                file_id: fileId,
                sheet: selectedSheet,
            });

            setValidationResult(response.data);
            
            if (response.data.valid) {
                setMessage(`Validasi OK: ${response.data.checked_rows} baris dicek, tidak ada error.`);
                setStep('confirm');
            } else {
                setMessage(`Ditemukan ${response.data.errors.length} error validasi.`);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Validasi gagal');
        } finally {
            setLoading(false);
        }
    };

    const doImport = async () => {
        if (!projectId) {
            setError('Pilih project tujuan');
            return;
        }

        setLoading(true);
        setError('');
        setMessage('');

        try {
            const response = await api.post('/api/rab/import', {
                file_id: fileId,
                sheet: selectedSheet,
                project_id: projectId,
            });

            setMessage(`Import selesai: ${response.data.imported} item diimport, ${response.data.skipped} dilewati${response.data.errors.length ? `, ${response.data.errors.length} error` : ''}.`);
            setStep('done');
        } catch (err) {
            setError(err.response?.data?.error || 'Import gagal');
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setStep('upload');
        setFile(null);
        setFileId('');
        setOriginalName('');
        setSheets([]);
        setSelectedSheet('');
        setPreviewData(null);
        setValidationResult(null);
        setProjectId('');
        setMessage('');
        setError('');
    };

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold leading-tight text-gray-800">Import RAB dari Excel</h2>}>
            <Head title="Import RAB" />

            <div className="py-12">
                <div className="mx-auto max-w-4xl space-y-6 sm:px-6 lg:px-8">
                    {/* Step indicator */}
                    <div className="flex items-center justify-between">
                        {['upload', 'preview', 'validate', 'confirm', 'done'].map((s, i) => (
                            <React.Fragment key={s}>
                                <div className={`flex items-center ${i < 4 ? 'flex-1' : ''}`}>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                                        ['upload', 'preview', 'validate', 'confirm', 'done'].indexOf(step) >= i
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-gray-200 text-gray-500'
                                    }`}>
                                        {i + 1}
                                    </div>
                                    {i < 4 && <div className={`flex-1 h-1 mx-2 ${['upload', 'preview', 'validate', 'confirm', 'done'].indexOf(step) > i ? 'bg-indigo-600' : 'bg-gray-200'}`} />}
                                </div>
                            </React.Fragment>
                        ))}
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>Upload</span>
                        <span>Preview</span>
                        <span>Validasi</span>
                        <span>Konfirmasi</span>
                        <span>Selesai</span>
                    </div>

                    {error && (
                        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                            {error}
                        </div>
                    )}
                    {message && (
                        <div className="rounded border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                            {message}
                        </div>
                    )}

                    {/* Step 1: Upload */}
                    {step === 'upload' && (
                        <div className="bg-white p-6 shadow-sm rounded-lg">
                            <h3 className="mb-4 text-lg font-bold">1. Upload File Excel RAB</h3>
                            <p className="mb-4 text-sm text-gray-600">
                                Format yang didukung: .xlsx, .xls (max 20MB). 
                                File akan dipindai untuk mendeteksi sheet RAB yang valid.
                            </p>
                            <input
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileChange}
                                className="mb-4 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                disabled={loading}
                            />
                            <button
                                onClick={uploadFile}
                                disabled={loading || !file}
                                className="rounded bg-indigo-600 px-6 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {loading ? 'Mengupload...' : 'Upload & Deteksi Sheet'}
                            </button>
                        </div>
                    )}

                    {/* Step 2: Preview */}
                    {step === 'preview' && (
                        <div className="bg-white p-6 shadow-sm rounded-lg">
                            <h3 className="mb-4 text-lg font-bold">2. Pilih Sheet RAB</h3>
                            <p className="mb-4 text-sm text-gray-600">
                                File: <strong>{originalName}</strong> — {sheets.length} sheet terdeteksi
                            </p>
                            
                            <div className="mb-4 grid gap-4 sm:grid-cols-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Sheet RAB
                                    <select
                                        value={selectedSheet}
                                        onChange={(e) => setSelectedSheet(e.target.value)}
                                        className="mt-1 block w-full rounded border-gray-300"
                                    >
                                        <option value="">-- Pilih Sheet --</option>
                                        {sheets.map((sheet) => (
                                            <option key={sheet} value={sheet}>{sheet}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block text-sm font-medium text-gray-700">
                                    Project Tujuan
                                    <select
                                        value={projectId}
                                        onChange={(e) => setProjectId(e.target.value)}
                                        className="mt-1 block w-full rounded border-gray-300"
                                    >
                                        <option value="">-- Pilih Project --</option>
                                        {(projectsList || []).map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.project_name} ({p.project_code})
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setStep('upload')}
                                    className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    Kembali
                                </button>
                                <button
                                    onClick={loadPreview}
                                    disabled={loading || !selectedSheet}
                                    className="rounded bg-indigo-600 px-6 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {loading ? 'Memuat...' : 'Lihat Preview'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Validate */}
                    {step === 'validate' && previewData && (
                        <div className="bg-white p-6 shadow-sm rounded-lg">
                            <h3 className="mb-4 text-lg font-bold">3. Validasi Data</h3>
                            <div className="mb-4 grid gap-4 sm:grid-cols-3 text-sm">
                                <div className="rounded bg-gray-50 p-3">
                                    <p className="text-gray-500">Sheet</p>
                                    <p className="font-medium">{previewData.sheet}</p>
                                </div>
                                <div className="rounded bg-gray-50 p-3">
                                    <p className="text-gray-500">Strategy</p>
                                    <p className="font-medium">{previewData.strategy?.split('\\').pop()}</p>
                                </div>
                                <div className="rounded bg-gray-50 p-3">
                                    <p className="text-gray-500">Baris Preview</p>
                                    <p className="font-medium">{previewData.rows.length}</p>
                                </div>
                            </div>

                            {previewData.project_info && (
                                <div className="mb-4 p-4 rounded bg-blue-50 text-sm">
                                    <p className="font-medium text-blue-800">Info Project Terdeteksi:</p>
                                    <p>Nama: {previewData.project_info.name || '-'}</p>
                                    <p>Lokasi: {previewData.project_info.location || '-'}</p>
                                    <p>Tahun: {previewData.project_info.year || '-'}</p>
                                </div>
                            )}

                            <div className="mb-4 overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">#</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Kode</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Uraian</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Satuan</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Volume</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Harga</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Total</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Kategori</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {previewData.rows.map((row, i) => (
                                            row.is_section ? (
                                                <tr key={i} className="bg-indigo-50 border-t-2 border-indigo-300">
                                                    <td colSpan={8} className="px-4 py-3 text-sm font-bold text-indigo-900">
                                                        {row.section_code ? `${row.section_code}. ` : ''}{row.description}
                                                    </td>
                                                </tr>
                                            ) : (
                                                <tr key={i}>
                                                    <td className="px-4 py-2 text-sm text-gray-500">{i + 1}</td>
                                                    <td className="px-4 py-2 text-sm text-gray-600">{row.code || '-'}</td>
                                                    <td className="px-4 py-2 text-sm font-medium text-gray-900 max-w-xs truncate">{row.description}</td>
                                                    <td className="px-4 py-2 text-sm text-gray-600">{row.unit}</td>
                                                    <td className="px-4 py-2 text-right text-sm text-gray-600">{Number(row.qty || 0).toLocaleString('id-ID')}</td>
                                                    <td className="px-4 py-2 text-right text-sm text-gray-600">{money(row.price)}</td>
                                                    <td className="px-4 py-2 text-right text-sm text-gray-600">{money(row.total)}</td>
                                                    <td className="px-4 py-2 text-sm text-gray-500">{row.category || '-'}</td>
                                                </tr>
                                            )
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setStep('preview')}
                                    className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    Ganti Sheet
                                </button>
                                <button
                                    onClick={runValidation}
                                    disabled={loading}
                                    className="rounded bg-amber-600 px-6 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {loading ? 'Memvalidasi...' : 'Validasi Total Price'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Confirm */}
                    {step === 'confirm' && (
                        <div className="bg-white p-6 shadow-sm rounded-lg">
                            <h3 className="mb-4 text-lg font-bold">4. Konfirmasi Import</h3>
                            
                            {validationResult && (
                                <div className="mb-4 p-4 rounded bg-emerald-50 text-sm">
                                    <p className="font-medium text-emerald-800">Validasi berhasil</p>
                                    <p>{validationResult.checked_rows} baris dicek, tidak ada error.</p>
                                </div>
                            )}

                            <div className="mb-4 grid gap-4 sm:grid-cols-2">
                                <div className="rounded bg-gray-50 p-3">
                                    <p className="text-sm text-gray-500">File</p>
                                    <p className="font-medium">{originalName}</p>
                                </div>
                                <div className="rounded bg-gray-50 p-3">
                                    <p className="text-sm text-gray-500">Sheet</p>
                                    <p className="font-medium">{selectedSheet}</p>
                                </div>
                                <div className="rounded bg-gray-50 p-3">
                                    <p className="text-sm text-gray-500">Project</p>
                                    <p className="font-medium">
                                        {projectsList.find(p => String(p.id) === projectId)?.project_name || '-'}
                                    </p>
                                </div>
                                <div className="rounded bg-gray-50 p-3">
                                    <p className="text-sm text-gray-500">Estimasi Item</p>
                                    <p className="font-medium">{previewData?.rows.length || 0} item</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setStep('validate')}
                                    className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    Kembali
                                </button>
                                <button
                                    onClick={doImport}
                                    disabled={loading || !projectId}
                                    className="rounded bg-emerald-600 px-6 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {loading ? 'Mengimport...' : 'Import Sekarang'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 5: Done */}
                    {step === 'done' && (
                        <div className="bg-white p-6 shadow-sm rounded-lg text-center">
                            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">Import Selesai</h3>
                            <p className="text-gray-600 mb-6">{message}</p>
                            <button
                                onClick={reset}
                                className="rounded bg-indigo-600 px-6 py-2 text-sm font-medium text-white"
                            >
                                Import File Lain
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
