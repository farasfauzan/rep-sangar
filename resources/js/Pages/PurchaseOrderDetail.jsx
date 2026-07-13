import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '@/Components/ui/Toast';
import Card from '@/Components/ui/Card';
import StatusBadge from '@/Components/ui/StatusBadge';
import DataTable from '@/Components/ui/DataTable';
import Button from '@/Components/ui/Button';
import PageHeader from '@/Components/ui/PageHeader';
import LoadingSpinner from '@/Components/ui/LoadingSpinner';
import ConfirmModal from '@/Components/ui/ConfirmModal';

const STATUS_STEPS = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'];
const REJECTED_STATUSES = ['REJECTED'];

const statusColors = {
    DRAFT: 'bg-gray-400',
    PENDING_APPROVAL: 'bg-yellow-400',
    APPROVED: 'bg-emerald-500',
    REJECTED: 'bg-red-500',
};

function StatusTimeline({ currentStatus }) {
    const steps = currentStatus === 'REJECTED'
        ? [...STATUS_STEPS.slice(0, 2), 'REJECTED']
        : STATUS_STEPS;

    const currentIndex = steps.indexOf(currentStatus);
    const isRejected = currentStatus === 'REJECTED';

    return (
        <div className="flex items-center justify-between w-full max-w-2xl mx-auto py-4">
            {steps.map((step, index) => {
                const isCompleted = index < currentIndex || (isRejected && step === 'PENDING_APPROVAL');
                const isCurrent = index === currentIndex;
                const isRejectedStep = step === 'REJECTED';

                return (
                    <div key={step} className="flex flex-col items-center flex-1 relative">
                        {/* Connector line */}
                        {index < steps.length - 1 && (
                            <div
                                className={`absolute top-4 left-1/2 w-full h-0.5 ${
                                    isCompleted
                                        ? isRejectedStep ? 'bg-red-400' : 'bg-emerald-400'
                                        : 'bg-gray-200'
                                }`}
                                style={{ transform: 'translateX(0%)' }}
                            />
                        )}

                        {/* Circle */}
                        <div
                            className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                                isCurrent
                                    ? isRejectedStep
                                        ? 'bg-red-500 text-white border-red-600'
                                        : 'bg-emerald-500 text-white border-emerald-600'
                                    : isCompleted
                                        ? isRejectedStep
                                            ? 'bg-red-400 text-white border-red-400'
                                            : 'bg-emerald-400 text-white border-emerald-400'
                                        : 'bg-white text-gray-400 border-gray-300'
                            }`}
                        >
                            {isCompleted || isCurrent ? (
                                isRejectedStep ? (
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                )
                            ) : (
                                index + 1
                            )}
                        </div>

                        {/* Label */}
                        <span
                            className={`mt-2 text-xs font-medium text-center whitespace-nowrap ${
                                isCurrent
                                    ? isRejectedStep ? 'text-red-600' : 'text-emerald-600'
                                    : isCompleted
                                        ? 'text-gray-600'
                                        : 'text-gray-400'
                            }`}
                        >
                            {step.replace(/_/g, ' ')}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

export default function PurchaseOrderDetail() {
    const [po, setPo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [approving, setApproving] = useState(false);
    const [confirmState, setConfirmState] = useState({ open: false, action: null });
    const toast = useToast();

    const poId = window.location.pathname.split('/').pop();

    useEffect(() => {
        fetchPo();
    }, []);

    const fetchPo = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/purchase-orders/${poId}`);
            setPo(res.data);
        } catch (err) {
            toast.error('Gagal memuat data PO.');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        setApproving(true);
        try {
            await axios.put(`/api/purchase-orders/${poId}/approve`);
            toast.success('PO berhasil di-approve.');
            await fetchPo();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal approve PO.');
        } finally {
            setApproving(false);
            setConfirmState({ open: false, action: null });
        }
    };

    const handleReject = async () => {
        setApproving(true);
        try {
            await axios.put(`/api/purchase-orders/${poId}/reject`);
            toast.success('PO berhasil ditolak.');
            await fetchPo();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal reject PO.');
        } finally {
            setApproving(false);
            setConfirmState({ open: false, action: null });
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const formatCurrency = (amount) => `Rp ${Number(amount || 0).toLocaleString('id-ID')}`;

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('id-ID', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    };

    if (loading) {
        return (
            <AuthenticatedLayout header={<h2 className="text-xl font-semibold leading-tight text-gray-800">Detail Purchase Order</h2>}>
                <Head title="Detail PO" />
                <div className="py-12 flex justify-center">
                    <LoadingSpinner message="Memuat data PO..." />
                </div>
            </AuthenticatedLayout>
        );
    }

    if (!po) {
        return (
            <AuthenticatedLayout header={<h2 className="text-xl font-semibold leading-tight text-gray-800">Detail Purchase Order</h2>}>
                <Head title="Detail PO" />
                <div className="py-12 text-center text-gray-500">PO tidak ditemukan.</div>
            </AuthenticatedLayout>
        );
    }

    const itemColumns = [
        { key: 'item_name', label: 'Nama Item', render: (val, row) => val || row.rab_budget?.description || '—' },
        { key: 'qty', label: 'Qty', render: (val) => Number(val).toLocaleString('id-ID') },
        { key: 'unit_price', label: 'Harga Satuan', render: (val) => formatCurrency(val) },
        {
            key: 'total_price',
            label: 'Subtotal',
            render: (val, row) => formatCurrency(val || (row.qty * row.unit_price)),
        },
    ];

    const approvalHistory = po.approval_history || po.approvals || [];

    const subtotal = (po.items || []).reduce((sum, item) => sum + (item.total_price || (item.qty * item.unit_price)), 0);
    const ppn = subtotal * 0.11;
    const grandTotal = subtotal + ppn;

    const isDraft = po.status === 'DRAFT';
    const isPending = po.status === 'PENDING_APPROVAL';

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800">
                    Detail Purchase Order
                </h2>
            }
        >
            <Head title={`Detail PO - ${po.po_number}`} />

            <div className="py-12">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8 space-y-6">

                    <PageHeader
                        title={`PO: ${po.po_number}`}
                        subtitle={`Dibuat pada ${formatDate(po.created_at)}`}
                        breadcrumbs={[
                            { label: 'Purchase Orders', href: '/po' },
                            { label: po.po_number },
                        ]}
                        actions={
                            <div className="flex items-center gap-2 no-print">
                                {isDraft && (
                                    <Button
                                        variant="primary"
                                        onClick={() => window.location.href = `/purchase-orders/${poId}/edit`}
                                    >
                                        ✏️ Edit
                                    </Button>
                                )}
                                {isPending && (
                                    <>
                                        <Button
                                            variant="success"
                                            loading={approving && confirmState.action === 'approve'}
                                            onClick={() => setConfirmState({ open: true, action: 'approve' })}
                                        >
                                            ✓ Approve
                                        </Button>
                                        <Button
                                            variant="danger"
                                            loading={approving && confirmState.action === 'reject'}
                                            onClick={() => setConfirmState({ open: true, action: 'reject' })}
                                        >
                                            ✕ Reject
                                        </Button>
                                    </>
                                )}
                                <Button variant="outline" onClick={handlePrint}>
                                    🖨️ Cetak
                                </Button>
                            </div>
                        }
                    />

                    {/* Status Timeline */}
                    <Card title="Status PO">
                        <StatusTimeline currentStatus={po.status} />
                    </Card>

                    {/* PO Header Info */}
                    <Card title="Informasi PO">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div>
                                <p className="text-sm text-gray-500">Nomor PO</p>
                                <p className="text-sm font-semibold text-gray-900">{po.po_number}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Tanggal</p>
                                <p className="text-sm font-semibold text-gray-900">{formatDate(po.date)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Status</p>
                                <StatusBadge status={po.status} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Supplier</p>
                                <p className="text-sm font-semibold text-gray-900">{po.supplier_name}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Proyek</p>
                                <p className="text-sm font-semibold text-gray-900">{po.project?.project_name || '—'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Syarat Pembayaran</p>
                                <p className="text-sm font-semibold text-gray-900">{po.payment_terms || '—'}</p>
                            </div>
                        </div>
                        {po.notes && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <p className="text-sm text-gray-500">Catatan</p>
                                <p className="text-sm text-gray-900">{po.notes}</p>
                            </div>
                        )}
                    </Card>

                    {/* Line Items */}
                    <Card title="Item Barang">
                        <DataTable
                            columns={itemColumns}
                            data={po.items || []}
                            emptyMessage="Tidak ada item."
                        />

                        {/* Totals */}
                        <div className="flex justify-end mt-4">
                            <div className="w-72 space-y-1">
                                <div className="flex justify-between py-1">
                                    <span className="text-sm text-gray-600">Subtotal:</span>
                                    <span className="text-sm font-semibold">{formatCurrency(subtotal)}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-gray-200">
                                    <span className="text-sm text-gray-600">PPN 11%:</span>
                                    <span className="text-sm font-semibold">{formatCurrency(ppn)}</span>
                                </div>
                                <div className="flex justify-between py-2">
                                    <span className="text-base font-bold text-gray-900">Grand Total:</span>
                                    <span className="text-base font-bold text-indigo-700">{formatCurrency(grandTotal)}</span>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Approval History */}
                    <Card title="Riwayat Approval">
                        {approvalHistory.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-4">Belum ada riwayat approval.</p>
                        ) : (
                            <div className="space-y-3">
                                {approvalHistory.map((entry, index) => (
                                    <div
                                        key={entry.id || index}
                                        className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100"
                                    >
                                        <div className={`flex-shrink-0 w-2 h-2 mt-2 rounded-full ${
                                            entry.action === 'approved' ? 'bg-emerald-500'
                                                : entry.action === 'rejected' ? 'bg-red-500'
                                                : 'bg-yellow-500'
                                        }`} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-medium text-gray-900">
                                                    {entry.user?.name || 'System'}
                                                </p>
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                                    entry.action === 'approved' ? 'bg-green-100 text-green-700'
                                                        : entry.action === 'rejected' ? 'bg-red-100 text-red-700'
                                                        : 'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                    {entry.action?.toUpperCase()}
                                                </span>
                                            </div>
                                            {entry.comment && (
                                                <p className="text-sm text-gray-600 mt-1">{entry.comment}</p>
                                            )}
                                            <p className="text-xs text-gray-400 mt-1">
                                                {formatDate(entry.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            {/* Confirm Modal for Approve/Reject */}
            <ConfirmModal
                open={confirmState.open}
                onClose={() => setConfirmState({ open: false, action: null })}
                onConfirm={confirmState.action === 'approve' ? handleApprove : handleReject}
                title={confirmState.action === 'approve' ? 'Approve PO' : 'Reject PO'}
                message={
                    confirmState.action === 'approve'
                        ? 'Apakah Anda yakin ingin menyetujui PO ini?'
                        : 'Apakah Anda yakin ingin menolak PO ini?'
                }
                confirmText={confirmState.action === 'approve' ? 'Approve' : 'Reject'}
            />

            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    .py-12 { padding-top: 0 !important; padding-bottom: 0 !important; }
                }
            `}</style>
        </AuthenticatedLayout>
    );
}
