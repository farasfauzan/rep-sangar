import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState, useEffect, Component } from 'react';
import axios from 'axios';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="p-6 max-w-lg mx-auto my-10 bg-red-50 border border-red-200 rounded-lg text-red-800">
                    <h2 className="text-lg font-bold mb-2">React Rendering Error</h2>
                    <p className="text-sm font-semibold mb-4">{this.state.error?.toString()}</p>
                    <pre className="text-xs overflow-auto max-h-64 bg-red-100 p-3 rounded font-mono">{this.state.error?.stack}</pre>
                </div>
            );
        }
        return this.props.children;
    }
}

const fmt = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n ?? 0);

export default function Dashboard({ auth }) {
    const [file, setFile] = useState(null);
    const [projectId, setProjectId] = useState(1);
    const [message, setMessage] = useState('');
    const [previewRows, setPreviewRows] = useState([]);
    const [step, setStep] = useState(1);
    const [quickImporting, setQuickImporting] = useState(false);
    const [rabData, setRabData] = useState([]);
    const [loadingRab, setLoadingRab] = useState(false);
    const [summary, setSummary] = useState(null);
    const [categoryFilter, setCategoryFilter] = useState('');
    const [categories, setCategories] = useState([]);
    const [projects, setProjects] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchRabData = async (pid) => {
        if (!pid) return;
        setLoadingRab(true);
        try {
            const params = { project_id: pid, per_page: 500 };
            const response = await axios.get('/api/rab', { params });
            const paginator = response.data.data;
            const rows = paginator?.data ?? paginator ?? [];
            setRabData(Array.isArray(rows) ? rows : []);
        } catch (error) {
            console.error('Failed to fetch RAB data', error);
            setRabData([]);
        } finally {
            setLoadingRab(false);
        }
    };

    const fetchSummary = async (pid) => {
        if (!pid) return;
        try {
            const response = await axios.get('/api/rab/summary', { params: { project_id: pid } });
            setSummary(response.data.data);
            const cats = Object.keys(response.data.data?.by_category ?? {});
            setCategories(cats);
        } catch { setSummary(null); }
    };

    useEffect(() => {
        axios.get('/api/projects').then(res => {
            const list = res.data?.data ?? res.data ?? [];
            setProjects(Array.isArray(list) ? list : []);
        }).catch(() => { });
    }, []);

    useEffect(() => {
        fetchRabData(projectId);
        fetchSummary(projectId);
    }, [projectId]);

    const previewHeaders = ['No', 'Uraian Pekerjaan', 'Volume', 'Satuan', 'Harga Satuan (Rp)', 'Jumlah (Rp)'];
    const toPreviewRows = (rows = []) => rows.map(row => Array.isArray(row) ? row : [
        row.no ?? '', row.uraian ?? '', row.volume ?? '', row.satuan ?? '', row.harga_satuan ?? '', row.jumlah ?? '',
    ]);

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
                setPreviewRows(toPreviewRows(response.data.data?.rows ?? response.data.rows ?? []));
                setStep(2);
                setMessage('Preview siap. Klik Import jika data benar.');
            } catch (error) {
                setMessage('Gagal preview. ' + (error.response?.data?.message || ''));
            }
        }
    };

    const handleQuickImport = async () => {
        if (!file) { setMessage('Pilih file terlebih dahulu.'); return; }
        setQuickImporting(true);
        setMessage('Import otomatis berjalan...');
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
            fetchRabData(projectId);
            fetchSummary(projectId);
        } catch (error) {
            setMessage(`${error.response?.data?.message || 'Gagal import.'} ${error.response?.data?.error || ''}`);
        } finally { setQuickImporting(false); }
    };

    const currentProject = projects.find(p => p.id === projectId);
    const projectName = currentProject?.project_name || `Project #${projectId}`;

    const filteredData = rabData.filter(item => {
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            return (item.description || '').toLowerCase().includes(term) ||
                (item.code_item || '').toLowerCase().includes(term);
        }
        return true;
    });

    return (
        <ErrorBoundary>
            <AuthenticatedLayout
                header={<h2 className="text-xl font-semibold leading-tight text-gray-800">Dashboard</h2>}
            >
            <Head title="Dashboard" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

                {/* Import Section */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900">Import RAB</h3>
                        <p className="text-sm text-gray-500 mt-0.5">Upload file Excel (.xlsx) berisi rencana anggaran biaya</p>
                    </div>
                    <div className="px-6 py-5">
                        <div className="flex items-end gap-4 flex-wrap">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Proyek</label>
                                <select
                                    value={projectId}
                                    onChange={(e) => setProjectId(Number(e.target.value))}
                                    className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[200px]"
                                >
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.project_name || `Project #${p.id}`}</option>
                                    ))}
                                    {projects.length === 0 && <option value={1}>Project #1</option>}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">File Excel</label>
                                <input
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    onChange={handleFileChange}
                                    className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                />
                            </div>
                            <button
                                onClick={handleQuickImport}
                                disabled={!file || quickImporting}
                                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {quickImporting ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                        Mengimport...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                        Import
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Message */}
                        {message && (
                            <div className={`mt-3 px-4 py-2.5 rounded-md text-sm ${message.includes('berhasil') || message.includes('success')
                                    ? 'bg-green-50 text-green-700 border border-green-200'
                                    : message.includes('Gagal') || message.includes('Error')
                                        ? 'bg-red-50 text-red-700 border border-red-200'
                                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}>
                                {message}
                            </div>
                        )}

                        {/* Preview Table */}
                        {step === 2 && previewRows.length > 0 && (
                            <div className="mt-4">
                                <p className="text-sm font-medium text-gray-700 mb-2">Preview Data ({previewRows.length} baris)</p>
                                <div className="border border-gray-200 rounded-md overflow-hidden max-h-64 overflow-y-auto">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                                                {previewHeaders.map(h => (
                                                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {previewRows.slice(0, 20).map((row, i) => (
                                                <tr key={i} className="bg-white hover:bg-gray-50">
                                                    <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                                                    {row.map((cell, j) => (
                                                        <td key={j} className="px-3 py-2 text-gray-600 whitespace-nowrap text-xs">
                                                            {String(cell ?? '').substring(0, 50)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex justify-end gap-2 mt-3">
                                    <button
                                        onClick={() => { setStep(1); setFile(null); setPreviewRows([]); }}
                                        className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        onClick={handleQuickImport}
                                        disabled={quickImporting}
                                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                    >
                                        {quickImporting ? 'Mengimport...' : 'Import Sekarang'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Summary Cards */}
                {summary && summary.total_items > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Anggaran</p>
                                    <p className="text-lg font-bold text-gray-900">{fmt(summary.total_budget)}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Jumlah Item</p>
                                    <p className="text-lg font-bold text-gray-900">{summary.total_items}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Kategori</p>
                                    <p className="text-lg font-bold text-gray-900">{categories.length}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* RAB Data Table */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">Data RAB</h3>
                            <p className="text-sm text-gray-500">{projectName} — {filteredData.length} item</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Search */}
                            <div className="relative">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                <input
                                    type="text"
                                    placeholder="Cari item..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-48"
                                />
                            </div>
                            {/* Category filter */}
                            {categories.length > 0 && (
                                <select
                                    value={categoryFilter}
                                    onChange={(e) => setCategoryFilter(e.target.value)}
                                    className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">Semua Kategori</option>
                                    {categories.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        {loadingRab ? (
                            <div className="px-6 py-12 text-center">
                                <svg className="animate-spin h-6 w-6 text-blue-500 mx-auto mb-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                <p className="text-sm text-gray-500">Memuat data RAB...</p>
                            </div>
                        ) : rabData.length === 0 ? (
                            <div className="px-6 py-12 text-center">
                                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                <p className="text-sm text-gray-500">Belum ada data RAB.</p>
                                <p className="text-xs text-gray-400 mt-1">Upload file Excel di atas untuk memulai.</p>
                            </div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">#</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kode</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Uraian Pekerjaan</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Volume</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Satuan</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Harga Satuan</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Kategori</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredData.map((item, i) => (
                                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 text-sm text-gray-400">{i + 1}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500 font-mono">{item.code_item || '—'}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">{item.description}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600 text-center">{item.volume || '—'}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600 text-center">{item.unit || '—'}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600 text-right font-mono">{fmt(item.unit_price)}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold font-mono">{fmt(item.total_price)}</td>
                                            <td className="px-4 py-3 text-center">
                                                {item.category ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                                        {item.category}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
        </ErrorBoundary>
    );
}