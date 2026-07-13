import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/Components/ui/Toast';
import ConfirmModal from '@/Components/ui/ConfirmModal';

export default function PurchaseOrder() {
    const [pos, setPos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [confirmState, setConfirmState] = useState({ open: false, poId: null });
    const api = useApi();
    const toast = useToast();

    useEffect(() => {
        fetchPos();
    }, []);

    const fetchPos = async () => {
        setLoading(true);
        try {
            const data = await api.get('/api/pos', {}, { silent: true });
            setPos(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const submitPo = async (id) => {
        setConfirmState({ open: true, poId: id });
    };

    const handleConfirmSubmit = async () => {
        const id = confirmState.poId;
        setConfirmState({ open: false, poId: null });
        try {
            await api.put(`/api/pos/${id}/submit`);
            await fetchPos();
        } catch (err) {
            // toast shown by useApi
        }
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800">
                    Draft PO (Purchase Order)
                </h2>
            }
        >
            <Head title="Purchase Orders" />

            <div className="py-12">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
                    <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg">
                        <div className="p-6 text-gray-900">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold">Daftar Purchase Order</h3>
                                <a href={route("po.create")} className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700">
                                    + Buat PO Baru
                                </a>
                            </div>

                            {loading ? (
                                <p>Memuat data...</p>
                            ) : (
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No. PO</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proyek</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {pos.length === 0 ? (
                                            <tr><td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">Belum ada data PO.</td></tr>
                                        ) : (
                                            pos.map((po, idx) => (
                                                <tr key={idx}>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{po.po_number}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{po.project?.project_name ?? 'N/A'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{po.supplier_name}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Rp {Number(po.total_amount).toLocaleString('id-ID')}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                                            {po.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        <a
                                                            href={`/purchase-orders/${po.id}`}
                                                            className="rounded bg-indigo-600 px-3 py-1 text-sm text-white shadow hover:bg-indigo-700 mr-2"
                                                        >
                                                            Lihat Detail
                                                        </a>
                                                        {po.status === 'DRAFT' ? (
                                                            <>
                                                                <a
                                                                    href={`/purchase-orders/${po.id}/edit`}
                                                                    className="rounded bg-amber-500 px-3 py-1 text-sm text-white shadow hover:bg-amber-600 mr-2"
                                                                >
                                                                    Edit
                                                                </a>
                                                                <button onClick={() => submitPo(po.id)} className="rounded bg-emerald-600 px-3 py-1 text-sm text-white shadow hover:bg-emerald-700">Submit</button>
                                                            </>
                                                        ) : '-'}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <ConfirmModal
                open={confirmState.open}
                onClose={() => setConfirmState({ open: false, poId: null })}
                onConfirm={handleConfirmSubmit}
                title="Kirim PO"
                message="Kirim PO untuk approval?"
                confirmText="Kirim"
            />
        </AuthenticatedLayout>
    );
}
