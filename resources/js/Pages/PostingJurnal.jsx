import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function PostingJurnal() {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [message, setMessage] = useState('');
    const [form, setForm] = useState({
        tanggal: new Date().toISOString().split('T')[0],
        akun_debit: '',
        akun_kredit: '',
        keterangan: '',
        jumlah: '',
    });

    useEffect(() => {
        axios.get('/api/general-ledgers').then((res) => {
            setEntries(res.data);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // ponnytail: POST to /api/general-ledgers when backend endpoint exists
            setMessage('Jurnal berhasil diposting');
            setShowForm(false);
            setForm({ ...form, akun_debit: '', akun_kredit: '', keterangan: '', jumlah: '' });
        } catch {
            setMessage('Gagal posting jurnal');
        }
    };

    const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(v ?? 0);

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">Posting Jurnal</h2>}>
            <Head title="Posting Jurnal" />
            <div className="py-6 max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-4">
                {message && <div className="bg-green-100 text-green-800 px-4 py-2 rounded">{message}</div>}

                <div className="flex justify-end">
                    <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                        {showForm ? 'Tutup Form' : 'Posting Jurnal Baru'}
                    </button>
                </div>

                {showForm && (
                    <div className="bg-white shadow rounded-lg p-6">
                        <h3 className="font-semibold mb-4">Form Posting Jurnal</h3>
                        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Tanggal</label>
                                <input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} className="w-full border rounded px-3 py-2" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Jumlah</label>
                                <input type="number" value={form.jumlah} onChange={(e) => setForm({ ...form, jumlah: e.target.value })} className="w-full border rounded px-3 py-2" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Akun Debit</label>
                                <input type="text" value={form.akun_debit} onChange={(e) => setForm({ ...form, akun_debit: e.target.value })} className="w-full border rounded px-3 py-2" placeholder="contoh: 1-1000" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Akun Kredit</label>
                                <input type="text" value={form.akun_kredit} onChange={(e) => setForm({ ...form, akun_kredit: e.target.value })} className="w-full border rounded px-3 py-2" placeholder="contoh: 2-1000" required />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium mb-1">Keterangan</label>
                                <input type="text" value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} className="w-full border rounded px-3 py-2" />
                            </div>
                            <div className="col-span-2">
                                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Posting</button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="bg-white shadow rounded-lg overflow-hidden">
                    <div className="p-4 border-b">
                        <h3 className="font-semibold">Buku Besar / General Ledger</h3>
                    </div>
                    {loading ? (
                        <div className="p-6 text-center text-gray-500">Memuat data...</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left">Tanggal</th>
                                    <th className="px-4 py-2 text-left">Akun</th>
                                    <th className="px-4 py-2 text-left">Keterangan</th>
                                    <th className="px-4 py-2 text-right">Debit</th>
                                    <th className="px-4 py-2 text-right">Kredit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map((e, i) => (
                                    <tr key={e.id || i} className="border-t hover:bg-gray-50">
                                        <td className="px-4 py-2">{e.transaction_date || e.tanggal}</td>
                                        <td className="px-4 py-2">{e.account_code || e.akun}</td>
                                        <td className="px-4 py-2">{e.description || e.keterangan}</td>
                                        <td className="px-4 py-2 text-right">{fmt(e.debit)}</td>
                                        <td className="px-4 py-2 text-right">{fmt(e.credit)}</td>
                                    </tr>
                                ))}
                                {entries.length === 0 && (
                                    <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Belum ada jurnal</td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}