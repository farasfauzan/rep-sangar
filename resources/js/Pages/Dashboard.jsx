import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState } from 'react';
import axios from 'axios';

export default function Dashboard({ auth }) {
    const [file, setFile] = useState(null);
    const [projectId, setProjectId] = useState(1);
    const [message, setMessage] = useState('');
    const [previewRows, setPreviewRows] = useState([]);
    const [headerRowIndex, setHeaderRowIndex] = useState(null);
    const [mapping, setMapping] = useState({
        code_item: '',
        description: '',
        unit: '',
        volume: '',
        unit_price: '',
        total_price: '',
        category: ''
    });
    const [step, setStep] = useState(1); // 1: Upload, 2: Preview & Map
    const [quickImporting, setQuickImporting] = useState(false);

    const systemFields = [
        { key: 'code_item', label: 'Kode Item' },
        { key: 'description', label: 'Uraian Pekerjaan (Wajib)' },
        { key: 'unit', label: 'Satuan' },
        { key: 'volume', label: 'Volume / Qty' },
        { key: 'unit_price', label: 'Harga Satuan' },
        { key: 'total_price', label: 'Total Harga' },
        { key: 'category', label: 'Kategori / Kelompok' },
    ];

    const handleFileChange = async (e) => {
        const selectedFile = e.target.files[0];
        setFile(selectedFile);

        if (selectedFile) {
            setMessage('Membaca preview file...');
            const formData = new FormData();
            formData.append('file', selectedFile);

            try {
                const response = await axios.post('/rab/preview', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                setPreviewRows(response.data.rows);
                setStep(2);
                setMessage('Pilih baris yang merupakan Baris Judul (Header) dari tabel Anda.');
            } catch (error) {
                setMessage('Gagal membaca preview Excel. ' + (error.response?.data?.message || ''));
            }
        }
    };

    const handleMappingChange = (fieldKey, columnIndex) => {
        setMapping(prev => ({
            ...prev,
            [fieldKey]: columnIndex
        }));
    };

    const handleQuickImport = async () => {
        if (!file) {
            setMessage('Pilih file terlebih dahulu.');
            return;
        }
        setQuickImporting(true);
        setMessage('Import otomatis sedang berjalan... Mendeteksi header & mapping kolom...');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('project_id', projectId);
        formData.append('overwrite', 1);

        try {
            const response = await axios.post('/rab/auto-import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setMessage(response.data.message);
            setFile(null);
            setStep(1);
        } catch (error) {
            const serverMsg = error.response?.data?.message || 'Gagal import otomatis.';
            const serverErr = error.response?.data?.error || '';
            setMessage(`${serverMsg} ${serverErr}`);
        } finally {
            setQuickImporting(false);
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file || headerRowIndex === null) {
            setMessage('Pilih file dan baris header terlebih dahulu.');
            return;
        }

        if (mapping.description === '') {
            setMessage('Error: Uraian Pekerjaan wajib dipetakan ke salah satu kolom!');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('project_id', projectId);
        formData.append('overwrite', 1);
        formData.append('header_row', headerRowIndex);

        // Cleanup empty mappings
        const finalMapping = {};
        Object.entries(mapping).forEach(([k, v]) => {
            if (v !== '') finalMapping[k] = parseInt(v);
        });
        formData.append('mapping', JSON.stringify(finalMapping));

        setMessage('Sedang mengeksekusi import cerdas...');

        try {
            const response = await axios.post('/rab/import', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            setMessage(response.data.message);
            setStep(1); // Reset
            setFile(null);
            setHeaderRowIndex(null);
        } catch (error) {
            const serverMsg = error.response?.data?.message || 'Gagal mengimpor data RAB.';
            const serverErr = error.response?.data?.error || '';
            setMessage(`${serverMsg} ${serverErr}`);
            console.error(error);
        }
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800">
                    Smart RAB Importer
                </h2>
            }
        >
            <Head title="Smart Importer" />

            <div className="py-12">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">

                    <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg">
                        <div className="p-6 text-gray-900">
                            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                                Selamat datang, <strong>{auth.user.name}</strong>! Anda login sebagai peran: <strong className="text-indigo-600">{auth.user.role?.role_name || auth.user.role_id}</strong>.
                            </div>

                            {step === 1 && (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-bold mb-4">Langkah 1: Upload File Excel</h3>
                                    <p className="text-sm text-gray-500 mb-4">Unggah file Excel (RAB) Anda. Format apa saja didukung.</p>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Pilih Proyek (ID)</label>
                                        <input
                                            type="number"
                                            value={projectId}
                                            onChange={(e) => setProjectId(e.target.value)}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:max-w-xs focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">File Excel (.xlsx)</label>
                                        <input
                                            type="file"
                                            accept=".xlsx, .xls, .csv"
                                            onChange={handleFileChange}
                                            className="mt-1 block w-full text-sm text-slate-500
                                              file:mr-4 file:py-2 file:px-4
                                              file:rounded-full file:border-0
                                              file:text-sm file:font-semibold
                                              file:bg-indigo-50 file:text-indigo-700
                                              hover:file:bg-indigo-100"
                                        />
                                    </div>

                                    <div className="flex items-center gap-4 pt-2">
                                        <button
                                            onClick={handleQuickImport}
                                            disabled={!file || quickImporting}
                                            className="px-6 py-2 bg-green-600 text-white rounded-md text-sm font-medium shadow-sm hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {quickImporting ? '⏳ Mendeteksi & Import...' : '⚡ Import Otomatis (Deteksi Cerdas)'}
                                        </button>
                                        <span className="text-sm text-gray-500">atau pilih file lalu lanjut ke mapping manual di bawah</span>
                                    </div>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-6">
                                    <h3 className="text-lg font-bold">Langkah 2: Pemetaan Kolom (Mapping)</h3>
                                    <p className="text-sm text-gray-600">Klik pada salah satu baris di bawah yang merupakan <strong>Baris Judul (Header)</strong> tabel Anda.</p>

                                    <div className="overflow-x-auto border border-gray-200 rounded">
                                        <table className="min-w-full divide-y divide-gray-200 text-xs">
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {previewRows.map((row, rowIndex) => (
                                                    <tr
                                                        key={rowIndex}
                                                        onClick={() => setHeaderRowIndex(rowIndex)}
                                                        className={`cursor-pointer hover:bg-indigo-50 transition-colors ${headerRowIndex === rowIndex ? 'bg-indigo-100 border-2 border-indigo-500' : ''}`}
                                                    >
                                                        <td className="px-2 py-2 text-gray-400 font-mono w-8">{rowIndex + 1}</td>
                                                        {row.map((cell, cellIndex) => (
                                                            <td key={cellIndex} className="px-3 py-2 whitespace-nowrap text-gray-700 border-l border-gray-100">
                                                                {cell ? cell.substring(0, 30) + (cell.length > 30 ? '...' : '') : ''}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {headerRowIndex !== null && (
                                        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 mt-6">
                                            <h4 className="font-bold text-gray-800 mb-4">Langkah 3: Pasangkan Kolom</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {systemFields.map(field => (
                                                    <div key={field.key} className="flex flex-col">
                                                        <label className="text-sm font-semibold text-gray-700 mb-1">{field.label}</label>
                                                        <select
                                                            value={mapping[field.key]}
                                                            onChange={(e) => handleMappingChange(field.key, e.target.value)}
                                                            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                                        >
                                                            <option value="">-- Jangan Diimport --</option>
                                                            {previewRows[headerRowIndex].map((headerName, idx) => (
                                                                <option key={idx} value={idx}>
                                                                    Kolom {String.fromCharCode(65 + idx)}: {headerName || `(Kosong)`}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="mt-6 flex justify-end gap-3">
                                                <button
                                                    onClick={() => { setStep(1); setHeaderRowIndex(null); setFile(null); }}
                                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-100"
                                                >
                                                    Batal
                                                </button>
                                                <button
                                                    onClick={handleUpload}
                                                    className="px-6 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                                >
                                                    Eksekusi Import Cerdas
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {message && (
                                <div className="mt-6 p-4 rounded-md bg-blue-50 text-blue-700 text-sm border border-blue-200">
                                    {message}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}