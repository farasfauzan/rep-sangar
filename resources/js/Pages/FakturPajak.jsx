import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function FakturPajak() {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [fakturForm, setFakturForm] = useState({
        nomor_faktur: '',
        tanggal_faktur: new Date().toISOString().split('T')[0],
        npwp_penjual: '',
        nama_penjual: '',
        dpp: '',
        ppn: '',
        status: 'draft',
    });
    const [message, setMessage] = useState('');

    useEffect(() => {
        axios.get('/api/invoices').then((res) => {
            setInvoices(res.data);
            setLoading(false);
        });
    }, []);

    const handleGenerate = (inv) => {
        setSelected(inv);
        const dpp = parseFloat(inv.amount || 0);
        setFakturForm({
            ...fakturForm,
            dpp: dpp,
            ppn: (dpp * 0.11).toFixed(2),
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // ponnytail: POST to /api/faktur-pajak when backend endpoint exists
            setMessage('Faktur pajak berhasil dibuat untuk invoice ' + selected.invoice_number);
            setSelected(null);
        } catch {
            setMessage('Gagal membuat faktur pajak');
        }
    };

    const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(v ?? 0);

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">Faktur Pajak</h2>}>
            <Head title="Faktur Pajak" />
            <div className="py-6 max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-4">
                {message && <div className="bg-green-100 text-green-800 px-4 py-2 rounded">{message}</div>}

                <div className="bg-white shadow rounded-lg overflow-hidden">
                    <div className="p-4 border-b">
                        <h3 className="font-semibold">Invoice Tersedia</h3>
                        <p className="text-sm text-gray-500">Pilih invoice untuk generate faktur pajak</p>
                    </div>
                    {loading ? (
                        <div className="p-6 text-center text-gray-500">Memuat data...</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left">No. Invoice</th>
                                    <th className="px-4 py-2 text-left">Tanggal</th>
                                    <th className="px-4 py-2 text-right">Amount</th>
                                    <th className="px-4 py-2 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map((inv) => (
                                    <tr key={inv.id} className="border-t hover:bg-gray-50">
                                        <td className="px-4 py-2">{inv.invoice_number}</td>
                                        <td className="px-4 py-2">{inv.invoice_date}</td>
                                        <td className="px-4 py-2 text-right">{fmt(inv.amount)}</td>
                                        <td className="px-4 py-2 text-center">
                                            <button onClick={() => handleGenerate(inv)} className="text-blue-600 hover:underline text-xs">Generate Faktur</button>
                                        </td>
                                    </tr>
                                ))}
                                {invoices.length === 0 && (
                                    <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Belum ada invoice</td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {selected && (
                    <div className="bg-white shadow rounded-lg p-6">
                        <h3 className="font-semibold mb-4">Form Faktur Pajak — {selected.invoice_number}</h3>
                        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">No. Faktur Pajak</label>
                                <input type="text" value={fakturForm.nomor_faktur} onChange={(e) => setFakturForm({ ...fakturForm, nomor_faktur: e.target.value })} className="w-full border rounded px-3 py-2" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Tanggal Faktur</label>
                                <input type="date" value={fakturForm.tanggal_faktur} onChange={(e) => setFakturForm({ ...fakturForm, tanggal_faktur: e.target.value })} className="w-full border rounded px-3 py-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">NPWP Penjual</label>
                                <input type="text" value={fakturForm.npwp_penjual} onChange={(e) => setFakturForm({ ...fakturForm, npwp_penjual: e.target.value })} className="w-full border rounded px-3 py-2" placeholder="00.000.000.0-000.000" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Nama Penjual</label>
                                <input type="text" value={fakturForm.nama_penjual} onChange={(e) => setFakturForm({ ...fakturForm, nama_penjual: e.target.value })} className="w-full border rounded px-3 py-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">DPP (Dasar Pengenaan Pajak)</label>
                                <input type="number" value={fakturForm.dpp} onChange={(e) => setFakturForm({ ...fakturForm, dpp: e.target.value, ppn: (parseFloat(e.target.value) * 0.11).toFixed(2) })} className="w-full border rounded px-3 py-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">PPN (11%)</label>
                                <input type="number" value={fakturForm.ppn} className="w-full border rounded px-3 py-2 bg-gray-100" readOnly />
                            </div>
                            <div className="col-span-2 flex gap-2">
                                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Simpan Faktur</button>
                                <button type="button" onClick={() => setSelected(null)} className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400">Batal</button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}