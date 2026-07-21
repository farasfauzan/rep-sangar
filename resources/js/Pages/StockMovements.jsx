import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';
import { useState, useEffect, useCallback } from 'react';
import DataTable from '@/Components/ui/DataTable';
import StatusBadge from '@/Components/ui/StatusBadge';
import Button from '@/Components/ui/Button';
import PageHeader from '@/Components/ui/PageHeader';
import Card from '@/Components/ui/Card';
import Modal from '@/Components/ui/Modal';
import FormField from '@/Components/ui/FormField';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/Components/ui/Toast';

const movementTypeMap = {
    in: { label: 'Masuk', color: 'bg-emerald-100 text-emerald-800' },
    out: { label: 'Keluar', color: 'bg-red-100 text-red-800' },
    adjustment: { label: 'Penyesuaian', color: 'bg-indigo-100 text-indigo-800' },
};

export default function StockMovements({ id }) {
    const { url } = usePage();
    const requestedAction = new URLSearchParams(url.split('?')[1] || '').get('action');
    const api = useApi();
    const toast = useToast();
    const [item, setItem] = useState(null);
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState('all');
    const [sortKey, setSortKey] = useState('created_at');
    const [sortDirection, setSortDirection] = useState('desc');
    const [showAdjustModal, setShowAdjustModal] = useState(false);
    const [adjustForm, setAdjustForm] = useState({
        type: 'increase',
        quantity: '',
        notes: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.get(`/api/inventory/${id}/movements`, {}, { silent: true });
            const rows = data?.movements ?? data?.data?.data ?? data?.data ?? data ?? [];
            setItem(data?.stock_item ?? null);
            setMovements(Array.isArray(rows) ? rows : []);
        } catch {
            toast.error('Gagal memuat data pergerakan stok.');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (requestedAction !== 'in' && requestedAction !== 'out') return;

        setAdjustForm((form) => ({
            ...form,
            type: requestedAction === 'out' ? 'decrease' : 'increase',
        }));
        setShowAdjustModal(true);
    }, [requestedAction]);

    const handleSort = (key, direction) => {
        setSortKey(key);
        setSortDirection(direction);
    };

    const handleAdjustSubmit = async (e) => {
        e.preventDefault();
        setErrors({});

        // Validate
        const newErrors = {};
        if (!adjustForm.quantity || Number(adjustForm.quantity) <= 0) {
            newErrors.quantity = 'Jumlah harus lebih dari 0.';
        }
        if (!adjustForm.notes.trim()) {
            newErrors.notes = 'Catatan wajib diisi.';
        }
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setSubmitting(true);
        try {
            await api.post(`/api/inventory/${id}/adjust`, {
                type: adjustForm.type,
                quantity: Number(adjustForm.quantity),
                notes: adjustForm.notes.trim(),
            });
            toast.success('Penyesuaian stok berhasil disimpan.');
            setShowAdjustModal(false);
            setAdjustForm({ type: 'increase', quantity: '', notes: '' });
            fetchData();
        } catch (err) {
            const serverErrors = err.response?.data?.errors;
            if (serverErrors) {
                setErrors(
                    Object.fromEntries(
                        Object.entries(serverErrors).map(([key, val]) => [key, Array.isArray(val) ? val[0] : val])
                    )
                );
            }
            toast.error(err.response?.data?.message || 'Gagal menyimpan penyesuaian stok.');
        } finally {
            setSubmitting(false);
        }
    };

    // Filter movements
    const filteredMovements = typeFilter === 'all'
        ? movements
        : movements.filter((m) => m.type === typeFilter);

    // Sort movements
    const sortedMovements = [...filteredMovements].sort((a, b) => {
        const aVal = a[sortKey] ?? '';
        const bVal = b[sortKey] ?? '';
        if (sortKey === 'created_at') {
            const dateA = new Date(aVal);
            const dateB = new Date(bVal);
            return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
        }
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        const strA = String(aVal).toLowerCase();
        const strB = String(bVal).toLowerCase();
        if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
        if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    const columns = [
        {
            key: 'created_at',
            label: 'Tanggal',
            sortable: true,
            render: (val) => {
                if (!val) return '—';
                const date = new Date(val);
                return (
                    <span className="text-sm text-gray-700">
                        {date.toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                        })}
                        {' '}
                        <span className="text-gray-400">
                            {date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </span>
                );
            },
        },
        {
            key: 'type',
            label: 'Tipe',
            sortable: true,
            render: (val) => {
                const mapped = movementTypeMap[val] || { label: val, color: 'bg-gray-100 text-gray-700' };
                return (
                    <StatusBadge
                        status={mapped.label}
                        colorMap={{ [mapped.label.toLowerCase()]: mapped.color }}
                    />
                );
            },
        },
        {
            key: 'quantity',
            label: 'Jumlah',
            sortable: true,
            render: (val, row) => {
                const quantity = Number(val);
                const isOut = row.type === 'out' || quantity < 0;
                return (
                    <span className={`font-semibold ${isOut ? 'text-red-600' : 'text-emerald-600'}`}>
                        {isOut ? '-' : '+'}{Math.abs(quantity).toLocaleString('id-ID')}
                    </span>
                );
            },
        },
        {
            key: 'notes',
            label: 'Catatan',
            render: (val) => (
                <span className="text-sm text-gray-600 max-w-xs truncate inline-block" title={val}>
                    {val || '—'}
                </span>
            ),
        },
        {
            key: 'created_by',
            label: 'Dibuat Oleh',
            render: (val, row) => {
                const name = row.creator?.name || row.user?.name || val || '—';
                return <span className="text-sm text-gray-600">{name}</span>;
            },
        },
    ];

    return (
        <AuthenticatedLayout>
            <Head title={`Pergerakan Stok — ${item?.item_name || 'Item'}`} />

            <div className="py-6">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
                    <PageHeader
                        title={`Pergerakan Stok: ${item?.item_name || 'Item'}`}
                        subtitle={
                            item
                                ? `Stok saat ini: ${Number(item.quantity).toLocaleString('id-ID')} ${item.unit || ''}`
                                : 'Memuat...'
                        }
                        breadcrumbs={[
                            { label: 'Inventaris', href: '/inventory' },
                            { label: item?.item_name || 'Pergerakan' },
                        ]}
                        actions={
                            <Button onClick={() => setShowAdjustModal(true)}>
                                Penyesuaian Stok
                            </Button>
                        }
                    />

                    {/* Summary Cards */}
                    {item && (
                        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
                            <Card>
                                <p className="text-sm text-gray-500">Stok Saat Ini</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {Number(item.quantity).toLocaleString('id-ID')} <span className="text-sm font-normal text-gray-400">{item.unit}</span>
                                </p>
                            </Card>
                            <Card>
                                <p className="text-sm text-gray-500">Stok Minimum</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {item.min_quantity != null ? Number(item.min_quantity).toLocaleString('id-ID') : '—'}
                                </p>
                            </Card>
                            <Card>
                                <p className="text-sm text-gray-500">Proyek</p>
                                <p className="text-lg font-semibold text-gray-900 truncate">
                                    {item.project_name || item.project?.project_name || '—'}
                                </p>
                            </Card>
                            <Card>
                                <p className="text-sm text-gray-500">Status Stok</p>
                                {Number(item.quantity) < Number(item.min_quantity) ? (
                                    <StatusBadge
                                        status="Stok Rendah"
                                        colorMap={{ 'stok rendah': 'bg-amber-100 text-amber-800' }}
                                    />
                                ) : (
                                    <StatusBadge
                                        status="Aman"
                                        colorMap={{ aman: 'bg-emerald-100 text-emerald-800' }}
                                    />
                                )}
                            </Card>
                        </div>
                    )}

                    {/* Filter */}
                    <div className="mb-4 flex items-center gap-2">
                        <span className="text-sm text-gray-600">Filter:</span>
                        <Button
                            variant={typeFilter === 'all' ? 'primary' : 'outline'}
                            size="sm"
                            onClick={() => setTypeFilter('all')}
                        >
                            Semua
                        </Button>
                        <Button
                            variant={typeFilter === 'in' ? 'success' : 'outline'}
                            size="sm"
                            onClick={() => setTypeFilter('in')}
                        >
                            Masuk
                        </Button>
                        <Button
                            variant={typeFilter === 'out' ? 'danger' : 'outline'}
                            size="sm"
                            onClick={() => setTypeFilter('out')}
                        >
                            Keluar
                        </Button>
                        <Button
                            variant={typeFilter === 'adjustment' ? 'secondary' : 'outline'}
                            size="sm"
                            onClick={() => setTypeFilter('adjustment')}
                        >
                            Penyesuaian
                        </Button>
                    </div>

                    {/* Movements Table */}
                    <div className="app-panel">
                        <DataTable
                            columns={columns}
                            data={sortedMovements}
                            loading={loading}
                            emptyMessage="Belum ada pergerakan stok."
                            sortKey={sortKey}
                            sortDirection={sortDirection}
                            onSort={handleSort}
                        />
                    </div>
                </div>
            </div>

            {/* Adjustment Modal */}
            <Modal
                open={showAdjustModal}
                onClose={() => {
                    setShowAdjustModal(false);
                    setErrors({});
                    setAdjustForm({ type: 'increase', quantity: '', notes: '' });
                }}
                title={adjustForm.type === 'increase' ? 'Stok Masuk' : 'Stok Keluar'}
                size="md"
            >
                <form onSubmit={handleAdjustSubmit} className="space-y-4">
                    <FormField label="Tipe Penyesuaian" required>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setAdjustForm({ ...adjustForm, type: 'increase' })}
                                className={`flex-1 rounded-lg border-2 px-4 py-3 text-center text-sm font-medium transition-colors ${
                                    adjustForm.type === 'increase'
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                }`}
                            >
                                Tambah (Masuk)
                            </button>
                            <button
                                type="button"
                                onClick={() => setAdjustForm({ ...adjustForm, type: 'decrease' })}
                                className={`flex-1 rounded-lg border-2 px-4 py-3 text-center text-sm font-medium transition-colors ${
                                    adjustForm.type === 'decrease'
                                        ? 'border-red-500 bg-red-50 text-red-700'
                                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                }`}
                            >
                                Kurangi (Keluar)
                            </button>
                        </div>
                    </FormField>

                    <FormField label="Jumlah" required error={errors.quantity}>
                        <input
                            type="number"
                            min="1"
                            step="1"
                            value={adjustForm.quantity}
                            onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                            placeholder="Masukkan jumlah..."
                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                    </FormField>

                    <FormField label="Catatan" required error={errors.notes}>
                        <textarea
                            rows="3"
                            value={adjustForm.notes}
                            onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                            placeholder="Alasan penyesuaian, keterangan, dll..."
                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                    </FormField>

                    <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowAdjustModal(false);
                                setErrors({});
                                setAdjustForm({ type: 'increase', quantity: '', notes: '' });
                            }}
                        >
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            loading={submitting}
                            variant={adjustForm.type === 'increase' ? 'success' : 'danger'}
                        >
                            {adjustForm.type === 'increase' ? 'Tambah Stok' : 'Kurangi Stok'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </AuthenticatedLayout>
    );
}
