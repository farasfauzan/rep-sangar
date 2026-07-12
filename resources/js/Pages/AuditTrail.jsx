import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function AuditTrail() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        axios.get('/api/audit-logs').then((res) => {
            setLogs(res.data);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const filtered = filter
        ? logs.filter((l) =>
            (l.action || '').toLowerCase().includes(filter.toLowerCase()) ||
            (l.model_type || l.entity || '').toLowerCase().includes(filter.toLowerCase()) ||
            (l.user?.name || '').toLowerCase().includes(filter.toLowerCase())
        )
        : logs;

    const actionColor = (a) => {
        if (a === 'create') return 'bg-green-100 text-green-800';
        if (a === 'update') return 'bg-blue-100 text-blue-800';
        if (a === 'delete') return 'bg-red-100 text-red-800';
        return 'bg-gray-100 text-gray-800';
    };

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">Audit Trail</h2>}>
            <Head title="Audit Trail" />
            <div className="py-6 max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-4">
                <div className="bg-white shadow rounded-lg p-4">
                    <input
                        type="text"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="Cari berdasarkan aksi, model, atau user..."
                        className="w-full border rounded px-3 py-2"
                    />
                </div>

                <div className="bg-white shadow rounded-lg overflow-hidden">
                    {loading ? (
                        <div className="p-6 text-center text-gray-500">Memuat data...</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left">Waktu</th>
                                    <th className="px-4 py-2 text-left">User</th>
                                    <th className="px-4 py-2 text-left">Aksi</th>
                                    <th className="px-4 py-2 text-left">Model</th>
                                    <th className="px-4 py-2 text-left">ID</th>
                                    <th className="px-4 py-2 text-left">Keterangan</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((log) => (
                                    <tr key={log.id} className="border-t hover:bg-gray-50">
                                        <td className="px-4 py-2 whitespace-nowrap">{log.created_at}</td>
                                        <td className="px-4 py-2">{log.user?.name || '-'}</td>
                                        <td className="px-4 py-2">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${actionColor(log.action)}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2">{log.model_type || log.entity}</td>
                                        <td className="px-4 py-2">{log.model_id || log.entity_id}</td>
                                        <td className="px-4 py-2 text-xs max-w-xs truncate">{log.description || JSON.stringify(log.changes || {})}</td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Tidak ada data</td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}