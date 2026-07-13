import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import DataTable from '@/Components/ui/DataTable';
import StatusBadge from '@/Components/ui/StatusBadge';
import Button from '@/Components/ui/Button';
import PageHeader from '@/Components/ui/PageHeader';
import ConfirmModal from '@/Components/ui/ConfirmModal';
import { useToast } from '@/Components/ui/Toast';

export default function SupplierList() {
    const toast = useToast();
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({});
    const [sortKey, setSortKey] = useState('id');
    const [sortDirection, setSortDirection] = useState('desc');
    const [confirmDelete, setConfirmDelete] = useState({ open: false, supplier: null });

    const fetchSuppliers = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                page,
                per_page: 15,
            };
            if (search) params.search = search;
            if (statusFilter !== '') params.is_active = statusFilter;

            const res = await axios.get('/api/suppliers', { params });
            const payload = res.data?.data ?? res.data;
            setSuppliers(payload?.data ?? payload ?? []);
            setMeta({
                current_page: payload?.current_page ?? 1,
                last_page: payload?.last_page ?? 1,
                total: payload?.total ?? 0,
            });
        } catch (err) {
            toast.error('Gagal memuat data supplier.');
        } finally {
            setLoading(false);
        }
    }, [page, search, statusFilter]);

    useEffect(() => {
        fetchSuppliers();
    }, [fetchSuppliers]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const handleSort = (key, direction) => {
        setSortKey(key);
        setSortDirection(direction);
    };

    const handleDelete = async () => {
        if (!confirmDelete.supplier) return;
        try {
            await axios.delete(`/api/suppliers/${confirmDelete.supplier.id}`);
            toast.success('Supplier berhasil dihapus.');
            setConfirmDelete({ open: false, supplier: null });
            fetchSuppliers();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal menghapus supplier.');
        }
    };

    const columns = [
        {
            key: 'code',
            label: 'Kode',
            sortable: true,
            render: (val) => (
                <span className="font-mono text-sm font-medium text-gray-900">{val}</span>
            ),
        },
        {
            key: 'name',
            label: 'Nama Supplier',
            sortable: true,
            render: (val) => (
                <span className="font-medium text-gray-900">{val}</span>
            ),
        },
        {
            key: 'npwp',
            label: 'NPWP',
            render: (val) => (
                <span className="font-mono text-sm text-gray-600">{val || '—'}</span>
            ),
        },
        {
            key: 'phone',
            label: 'Telepon',
            render: (val) => val || '—',
        },
        {
            key: 'contact_person',
            label: 'Kontak',
            render: (val) => val || '—',
        },
        {
            key: 'is_active',
            label: 'Status',
            render: (val) => (
                <StatusBadge status={val ? 'active' : 'inactive'} />
            ),
        },
        {
            key: 'actions',
            label: 'Aksi',
            className: 'text-right',
            headerClassName: 'text-right',
            render: (_, row) => (
                <div className="flex items-center justify-end gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.get(`/suppliers/${row.id}/edit`)}
                    >
                        Edit
                    </Button>
                    <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setConfirmDelete({ open: true, supplier: row })}
                    >
                        Hapus
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <AuthenticatedLayout>
            <Head title="Supplier" />

            <div className="py-6">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
                    <PageHeader
                        title="Daftar Supplier"
                        subtitle={`Total ${meta.total || 0} supplier`}
                        actions={
                            <Button onClick={() => router.get('/suppliers/create')}>
                                + Tambah Supplier
                            </Button>
                        }
                    />

                    {/* Filters */}
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Cari berdasarkan nama atau kode..."
                                className="block w-full rounded-lg border-gray-300 pl-10 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setPage(1);
                            }}
                            className="rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        >
                            <option value="">Semua Status</option>
                            <option value="1">Aktif</option>
                            <option value="0">Nonaktif</option>
                        </select>
                    </div>

                    {/* Table */}
                    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                        <DataTable
                            columns={columns}
                            data={suppliers}
                            loading={loading}
                            emptyMessage="Belum ada data supplier."
                            sortKey={sortKey}
                            sortDirection={sortDirection}
                            onSort={handleSort}
                        />

                        {/* Pagination */}
                        {meta.last_page > 1 && (
                            <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-3">
                                <span className="text-sm text-gray-600">
                                    Halaman {meta.current_page} dari {meta.last_page}
                                </span>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={meta.current_page <= 1}
                                        onClick={() => setPage((p) => p - 1)}
                                    >
                                        ← Sebelumnya
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={meta.current_page >= meta.last_page}
                                        onClick={() => setPage((p) => p + 1)}
                                    >
                                        Selanjutnya →
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ConfirmModal
                open={confirmDelete.open}
                onClose={() => setConfirmDelete({ open: false, supplier: null })}
                onConfirm={handleDelete}
                title="Hapus Supplier"
                message={
                    confirmDelete.supplier
                        ? `Yakin ingin menghapus supplier "${confirmDelete.supplier.name}" (${confirmDelete.supplier.code})? Tindakan ini tidak dapat dibatalkan.`
                        : ''
                }
                confirmText="Hapus"
                confirmVariant="danger"
            />
        </AuthenticatedLayout>
    );
}
