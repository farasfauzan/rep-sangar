import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function EFakturCsv() {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState([]);
    const [generating, setGenerating] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        axios.get('/api/invoices').then((res) => {
            setInvoices(res.data);
            setLoading(false);
        });
    }, []);

    const toggle = (id) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
    };

    const toggleAll = () => {
        if (selectedIds.length === invoices.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(invoices.map((i) => i.id));
        }
    };

    const handleExport = async () => {
        if (selectedIds.length === 0) return;
        setGenerating(true);
        try {
            // ponnytail: POST to /api/e-faktur/export when backend endpoint exists
            // Build CSV client-side as placeholder
            const selected = invoices.filter((i) => selectedIds.includes(i.id));
            const header = 'FK,KD_JENIS_TRANSAKSI,FG_PENGGANTI,NOMOR_FAKTUR,MASA_PAJAK,TAHUN_PAJAK,TANGGAL_FAKTUR,NPWP,NAMA,ALAMAT_LENGKAP,JUMLAH_DPP,JUMLAH_PPN,JUMLAH_PPNBM,ID_KETERANGAN_TAMBAHAN,FG_UANG_MUKA,UANG_MUKA_DPP,UANG_MUKA_PPN,UANG_MUKA_PPNBM,REFERENSI';
            const rows = selected.map((inv) =>
                `FK,01,0,${inv.invoice_number},${new Date(inv.invoice_date).getMonth() + 1},${new Date(inv.invoice_date).getFullYear()},${inv.invoice_date},0000000000000000,Vendor,Alamat,${inv.amount || 0},${(parseFloat(inv.amount || 0) * 0.11).toFixed(2)},0,,,0,0,0,`
            );
            const csv = [header, ...rows].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `e-faktur-export-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            setMessage(`Berhasil export ${selected.length} baris ke CSV`);
        } catch {
            setMessage('Gagal export CSV');
        }
        setGenerating(false);
    };

    const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(v ?? 0);

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">E-Faktur CSV</h2>}>
            <Head title="E-Faktur CSV" />
            <div className="py-6 max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-4">
                {message && <div className="bg-green-100 text-green-800 px-4 py-2 rounded">{message}</div>}

                <div className="bg-white shadow rounded-lg overflow-hidden">
                    <div className="p-4 border-b flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold">Pilih Invoice untuk Export</h3>
                            <p className="text-sm text-gray-500">Format CSV sesuai template DJP e-Faktur</p>
                        </div>
                        <button
                            onClick={handleExport}
                            disabled={selectedIds.length === 0 || generating}
                            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                        >
                            {generating ? 'Mengexport...' : `Export CSV (${selectedIds.length})`}
                        </button>
                    </div>
                    {loading ? (
                        <div className="p-6 text-center text-gray-500">Memuat data...</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 w-10">
                                        <input type="checkbox" checked={selectedIds.length === invoices.length && invoices.length > 0} onChange={toggleAll} />
                                    </th>
                                    <th className="px-4 py-2 text-left">No. Invoice</th>
                                    <th className="px-4 py-2 text-left">Tanggal</th>
                                    <th className="px-4 py-2 text-right">DPP</th>
                                    <th className="px-4 py-2 text-right">PPN (11%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map((inv) => (
                                    <tr key={inv.id} className="border-t hover:bg-gray-50">
                                        <td className="px-4 py-2 text-center">
                                            <input type="checkbox" checked={selectedIds.includes(inv.id)} onChange={() => toggle(inv.id)} />
                                        </td>
                                        <td className="px-4 py-2">{inv.invoice_number}</td>
                                        <td className="px-4 py-2">{inv.invoice_date}</td>
                                        <td className="px-4 py-2 text-right">{fmt(inv.amount)}</td>
                                        <td className="px-4 py-2 text-right">{fmt(parseFloat(inv.amount || 0) * 0.11)}</td>
                                    </tr>
                                ))}
                                {invoices.length === 0 && (
                                    <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Belum ada invoice</td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}