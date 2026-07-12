import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function LaporanKeuangan() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });

    const fetchData = () => {
        setLoading(true);
        axios.get('/api/dashboard/reports', { params: filters })
            .then((res) => { setData(res.data); setLoading(false); })
            .catch(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, []);

    const fmt = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(v ?? 0);
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">Laporan Keuangan</h2>}>
            <Head title="Laporan Keuangan" />
            <div className="py-6 max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-4">
                <div className="bg-white shadow rounded-lg p-4 flex gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium mb-1">Bulan</label>
                        <select value={filters.month} onChange={(e) => setFilters({ ...filters, month: e.target.value })} className="border rounded px-3 py-2">
                            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Tahun</label>
                        <input type="number" value={filters.year} onChange={(e) => setFilters({ ...filters, year: e.target.value })} className="border rounded px-3 py-2 w-24" />
                    </div>
                    <button onClick={fetchData} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Filter</button>
                </div>

                {loading ? <div className="p-6 text-center text-gray-500">Memuat...</div> : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white shadow rounded-lg p-6">
                            <h3 className="text-sm text-gray-500 mb-1">Total Pendapatan</h3>
                            <p className="text-2xl font-bold text-green-600">{fmt(data?.totalIncome || data?.total_income || 0)}</p>
                        </div>
                        <div className="bg-white shadow rounded-lg p-6">
                            <h3 className="text-sm text-gray-500 mb-1">Total Pengeluaran</h3>
                            <p className="text-2xl font-bold text-red-600">{fmt(data?.totalExpense || data?.total_expense || 0)}</p>
                        </div>
                        <div className="bg-white shadow rounded-lg p-6">
                            <h3 className="text-sm text-gray-500 mb-1">Laba Bersih</h3>
                            <p className="text-2xl font-bold text-blue-600">{fmt((data?.totalIncome || data?.total_income || 0) - (data?.totalExpense || data?.total_expense || 0))}</p>
                        </div>
                    </div>
                )}

                <div className="bg-white shadow rounded-lg p-6">
                    <h3 className="font-semibold mb-4">Ringkasan Per Proyek</h3>
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left">Proyek</th>
                                <th className="px-4 py-2 text-right">Budget</th>
                                <th className="px-4 py-2 text-right">Realisasi</th>
                                <th className="px-4 py-2 text-right">Selisih</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(data?.projects || []).map((p, i) => (
                                <tr key={i} className="border-t hover:bg-gray-50">
                                    <td className="px-4 py-2">{p.name}</td>
                                    <td className="px-4 py-2 text-right">{fmt(p.budget)}</td>
                                    <td className="px-4 py-2 text-right">{fmt(p.spent || p.realization)}</td>
                                    <td className="px-4 py-2 text-right">{fmt((p.budget || 0) - (p.spent || p.realization || 0))}</td>
                                </tr>
                            ))}
                            {(!data?.projects || data.projects.length === 0) && (
                                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Belum ada data</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}