import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { useState, useEffect, useCallback } from 'react';
import DataTable from '@/Components/ui/DataTable';
import StatusBadge from '@/Components/ui/StatusBadge';
import Button from '@/Components/ui/Button';
import PageHeader from '@/Components/ui/PageHeader';
import Card from '@/Components/ui/Card';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/Components/ui/Toast';

export default function InventoryDashboard() {
    const api = useApi();
    const toast = useToast();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all'); // 'all' | 'low_stock'
    const [sortKey, setSortKey] = useState('item_name');
    const [sortDirection, setSortDirection] = useState('asc');

    const fetchInventory = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (search) params.search = search;
            const data = await api.get('/api/inventory', params, { silent: true });
            const payload = data?.data?.data ?? data?.data ?? data ?? [];
            setItems(Array.isArray(payload) ? payload : []);
        } catch {
            toast.error('Gagal memuat data inventaris.');
        } finally {
            setLoading(false);
        }
    }, [search]);

    useEffect(() => {
        fetchInventory();
    }, [fetchInventory]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchInventory();
        }, 400);
        return () => clearTimeout(timer);
    }, [search]);

    const handleSort = (key, direction) => {
        setSortKey(key);
        setSortDirection(direction);
    };

    const handleStockIn = (item) => {
        router.get(`/inventory/${item.id}/movements`, { action: 'in' });
    };

    const handleStockOut = (item) => {
        router.get(`/inventory/${item.id}/movements`, { action: 'out' });
    };

    const handleRowClick = (item) => {
        router.get(`/inventory/${item.id}/movements`);
    };

    // Filter items
    const filteredItems = filter === 'low_stock'
        ? items.filter((item) => Number(item.quantity) < Number(item.min_quantity))
        : items;

    // Sort items
    const sortedItems = [...filteredItems].sort((a, b) => {
        const aVal = a[sortKey] ?? '';
        const bVal = b[sortKey] ?? '';
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        const strA = String(aVal).toLowerCase();
        const strB = String(bVal).toLowerCase();
        if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
        if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    const lowStockCount = items.filter(
        (item) => Number(item.quantity) < Number(item.min_quantity)
    ).length;

    const columns = [
        {
            key: 'item_name',
            label: 'Nama Barang',
            sortable: true,
            render: (val, row) => (
                <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{val}</span>
                    {Number(row.quantity) < Number(row.min_quantity) && (
                        <StatusBadge
                            status="Stok Rendah"
                            colorMap={{
                                'stok rendah': 'bg-amber-100 text-amber-800',
                            }}
                        />
                    )}
                </div>
            ),
        },
        {
            key: 'quantity',
            label: 'Jumlah',
            sortable: true,
            render: (val, row) => {
                const isLow = Number(val) < Number(row.min_quantity);
                return (
                    <span className={isLow ? 'font-bold text-red-600' : 'text-gray-700'}>
                        {Number(val).toLocaleString('id-ID')}
                    </span>
                );
            },
        },
        {
            key: 'unit',
            label: 'Satuan',
            render: (val) => val || '—',
        },
        {
            key: 'project_name',
            label: 'Proyek',
            sortable: true,
            render: (val, row) => row.project?.project_name || val || '—',
        },
        {
            key: 'min_quantity',
            label: 'Stok Minimum',
            sortable: true,
            render: (val) => (
                <span className="text-gray-500">
                    {val != null ? Number(val).toLocaleString('id-ID') : '—'}
                </span>
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
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(row);
                        }}
                    >
                        Lihat Detail
                    </Button>
                    <Button
                        variant="success"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleStockIn(row);
                        }}
                    >
                        Stok Masuk
                    </Button>
                    <Button
                        variant="danger"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleStockOut(row);
                        }}
                    >
                        Stok Keluar
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <AuthenticatedLayout>
            <Head title="Inventaris" />

            <div className="py-6">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
                    <PageHeader
                        title="Manajemen Inventaris"
                        subtitle={`Total ${items.length} item stok${lowStockCount > 0 ? ` · ${lowStockCount} stok rendah` : ''}`}
                    />

                    {/* Summary Cards */}
                    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <Card>
                            <div className="border-l-2 border-blue-700 pl-3">
                                <div>
                                    <p className="text-sm text-gray-500">Total Item</p>
                                    <p className="text-2xl font-bold text-gray-900">{items.length}</p>
                                </div>
                            </div>
                        </Card>
                        <Card>
                            <div className="border-l-2 border-amber-600 pl-3">
                                <div>
                                    <p className="text-sm text-gray-500">Stok Rendah</p>
                                    <p className="text-2xl font-bold text-amber-600">{lowStockCount}</p>
                                </div>
                            </div>
                        </Card>
                        <Card>
                            <div className="border-l-2 border-emerald-600 pl-3">
                                <div>
                                    <p className="text-sm text-gray-500">Stok Aman</p>
                                    <p className="text-2xl font-bold text-emerald-600">
                                        {items.length - lowStockCount}
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </div>

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
                                placeholder="Cari berdasarkan nama barang..."
                                className="block w-full rounded-lg border-gray-300 pl-10 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant={filter === 'all' ? 'primary' : 'outline'}
                                size="sm"
                                onClick={() => setFilter('all')}
                            >
                                Semua
                            </Button>
                            <Button
                                variant={filter === 'low_stock' ? 'danger' : 'outline'}
                                size="sm"
                                onClick={() => setFilter('low_stock')}
                            >
                                Stok Rendah
                                {lowStockCount > 0 && (
                                    <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-red-600">
                                        {lowStockCount}
                                    </span>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="app-panel">
                        <DataTable
                            columns={columns}
                            data={sortedItems}
                            loading={loading}
                            emptyMessage="Belum ada data inventaris."
                            sortKey={sortKey}
                            sortDirection={sortDirection}
                            onSort={handleSort}
                            className="[&_tbody_tr]:cursor-pointer"
                        />
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
