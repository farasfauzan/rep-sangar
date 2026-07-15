import { useState, useEffect } from 'react';
import ApplicationLogo from '@/Components/ApplicationLogo';
import Dropdown from '@/Components/Dropdown';
import { Link, usePage } from '@inertiajs/react';

export default function Authenticated({ header, children }) {
    const { auth } = usePage().props;
    const user = auth.user;
    const roleName = user.role?.role_name || 'LAPANGAN';
    const currentUrl = usePage().url;

    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Close sidebar on route change (mobile)
    useEffect(() => {
        setSidebarOpen(false);
    }, [currentUrl]);

    // Derive breadcrumb name from current URL
    const getBreadcrumb = () => {
        const path = currentUrl.split('?')[0].split('#')[0];
        const segments = path.split('/').filter(Boolean);
        if (segments.length === 0) return 'Dashboard';
        const last = segments[segments.length - 1];
        // Map known routes to friendly names
        const nameMap = {
            dashboard: 'Dashboard',
            'rab-control': 'Kontrol RAB',
            'rab-storage': 'Penyimpanan RAB',
            po: 'Purchase Orders',
            spk: 'Kontrak SPK',
            'goods-receipts': 'Penerimaan Barang',
            opname: 'Input Opname',
            invoicing: 'Input Tagihan',
            approval: 'Approval',
            'fund-requests': 'LPJ & Permohonan',
            payment: 'Pembayaran',
            'faktur-pajak': 'Faktur Pajak',
            'e-faktur-csv': 'E-Faktur CSV',
            'posting-jurnal': 'Posting Jurnal',
            'laporan-keuangan': 'Laporan Keuangan',
            'audit-trail': 'Audit Trail',
            'bank-statements': 'Rekening Koran',
            admin: 'Kelola User',
            suppliers: 'Supplier',
            create: 'Tambah Supplier',
            edit: 'Edit Supplier',
            inventory: 'Inventaris',
            movements: 'Pergerakan Stok',
            'profile.edit': 'Profile',
        };
        return nameMap[last] || last.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    };

    // Sidebar Menus based on Role Name
    const getRoleMenus = () => {
        switch (roleName) {
            case 'ADMIN':
                return [
                    { name: 'Dashboard', route: 'dashboard' },
                    { name: 'Kontrol RAB', route: 'rab-control' },
                    { name: 'Penyimpanan RAB', route: 'rab-storage' },
                    { name: 'Purchase Orders', route: 'po' },
                    { name: 'Supplier', route: 'suppliers' },
                    { name: 'Kontrak SPK', route: 'spk' },
                    { name: 'Penerimaan Barang', route: 'goods-receipts' },
                    { name: 'Input Opname', route: 'opname' },
                    { name: 'Input Tagihan', route: 'invoicing' },
                    { name: 'Approval', route: 'approval' },
                    { name: 'LPJ & Permohonan', route: 'fund-requests' },
                    { name: 'Pembayaran', route: 'payment' },
                    { name: 'Rekening Koran', route: 'bank-statements' },
                    { name: 'Kelola User', route: 'admin.users' },
                ];
            case 'LAPANGAN':
                return [
                    { name: 'Dashboard Proyek', route: 'dashboard' },
                    { name: 'Draft PO', route: 'po' },
                    { name: 'Penerimaan Barang', route: 'goods-receipts' },
                    { name: 'Input Opname', route: 'opname' },
                    { name: 'LPJ & Permohonan', route: 'fund-requests' },
                ];
            case 'ENGINEER':
                return [
                    { name: 'Dashboard Verifikasi', route: 'dashboard' },
                    { name: 'Kontrol RAB', route: 'rab-control' },
                    { name: 'Penyimpanan RAB', route: 'rab-storage' },
                    { name: 'Verifikasi Kebutuhan', route: 'dashboard' },
                    { name: 'Verifikasi Tagihan', route: 'approval' },
                ];
            case 'PURCHASING_LEGAL':
                return [
                    { name: 'Dashboard Pengadaan', route: 'dashboard' },
                    { name: 'Purchase Orders', route: 'po' },
                    { name: 'Supplier', route: 'suppliers' },
                    { name: 'Kontrak SPK', route: 'spk' },
                    { name: 'Input Tagihan', route: 'invoicing' },
                ];
            case 'VERIFIKATOR_KEU':
                return [
                    { name: 'Dashboard Verifikasi', route: 'dashboard' },
                    { name: 'Verifikasi Dokumen', route: 'approval' },
                    { name: 'Verifikasi LPJ', route: 'approval' },
                ];
            case 'MGR_KOMERSIAL':
                return [
                    { name: 'Executive Dashboard', route: 'dashboard' },
                    { name: 'Kontrol RAB', route: 'rab-control' },
                    { name: 'Penyimpanan RAB', route: 'rab-storage' },
                    { name: 'Approval PO & SPK', route: 'approval' },
                    { name: 'Approval Cashflow', route: 'approval' },
                ];
            case 'KEU_KANTOR':
                return [
                    { name: 'Dashboard Arus Kas', route: 'dashboard' },
                    { name: 'Daftar Antrean Bayar', route: 'payment' },
                    { name: 'Eksekusi Pembayaran', route: 'payment' },
                ];
            case 'PAJAK':
                return [
                    { name: 'Dashboard Pajak', route: 'dashboard' },
                    { name: 'Faktur Pajak', route: 'faktur-pajak' },
                    { name: 'E-Faktur CSV', route: 'e-faktur-csv' },
                ];
            case 'ACCOUNTING':
                return [
                    { name: 'Dashboard Akuntansi', route: 'dashboard' },
                    { name: 'Posting Jurnal', route: 'posting-jurnal' },
                    { name: 'Laporan Keuangan', route: 'laporan-keuangan' },
                    { name: 'Audit Trail', route: 'audit-trail' },
                    { name: 'Rekening Koran', route: 'bank-statements' },
                ];
            default:
                return [{ name: 'Dashboard', route: 'dashboard' }];
        }
    };

    const menus = [...getRoleMenus(), { name: 'Inventaris', route: 'inventory' }];

    // Role badge color mapping
    const getRoleBadgeClasses = () => {
        switch (roleName) {
            case 'ADMIN':
                return 'bg-red-100 text-red-800';
            case 'ENGINEER':
                return 'bg-blue-100 text-blue-800';
            case 'LAPANGAN':
                return 'bg-green-100 text-green-800';
            case 'PURCHASING_LEGAL':
                return 'bg-purple-100 text-purple-800';
            case 'VERIFIKATOR_KEU':
                return 'bg-yellow-100 text-yellow-800';
            case 'MGR_KOMERSIAL':
                return 'bg-indigo-100 text-indigo-800';
            case 'KEU_KANTOR':
                return 'bg-pink-100 text-pink-800';
            case 'PAJAK':
                return 'bg-orange-100 text-orange-800';
            case 'ACCOUNTING':
                return 'bg-teal-100 text-teal-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="flex h-screen overflow-hidden bg-slate-100">
            {/* Mobile overlay backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black bg-opacity-50 transition-opacity lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={
                    'fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-col border-r border-slate-800 bg-slate-950 text-white transition-transform duration-300 ease-in-out ' +
                    'lg:static lg:flex-shrink-0 lg:translate-x-0 ' +
                    (sidebarOpen ? 'translate-x-0' : '-translate-x-full')
                }
            >
                {/* Sidebar header with logo */}
                <div className="flex h-[72px] items-center justify-between border-b border-slate-800 px-4">
                    <Link href="/" className="flex items-center">
                        <ApplicationLogo className="block h-auto w-[215px] max-w-full" />
                    </Link>
                    {/* Close button on mobile */}
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 focus:outline-none"
                    >
                        <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Navigation links */}
                <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
                    {menus.map((menu, idx) => {
                        const isActive = route().current(menu.route);
                        return (
                            <Link
                                key={idx}
                                href={route(menu.route)}
                                className={
                                    'relative flex w-full items-center px-4 py-2.5 text-sm transition-colors ' +
                                    (isActive
                                        ? 'bg-slate-800 text-white font-semibold before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:bg-blue-400'
                                        : 'text-slate-300 hover:bg-slate-900 hover:text-white')
                                }
                            >
                                <span>{menu.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* User info section at sidebar bottom */}
                <div className="border-t border-slate-800 p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-slate-800 text-sm font-semibold text-white">
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{user.name}</p>
                            <span
                                className={
                                    'mt-0.5 inline-block rounded px-2 py-0.5 text-xs font-medium ' +
                                    getRoleBadgeClasses()
                                }
                            >
                                {roleName.replace(/_/g, ' ')}
                            </span>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* Top navbar */}
                <nav className="border-b border-slate-200 bg-white">
                    <div className="px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between h-16">
                            {/* Hamburger button - visible on mobile, hidden on lg+ */}
                            <div className="flex items-center lg:hidden">
                                <button
                                    onClick={() => setSidebarOpen(true)}
                                    className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 focus:text-gray-500 transition duration-150 ease-in-out"
                                >
                                    <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M4 6h16M4 12h16M4 18h16"
                                        />
                                    </svg>
                                </button>
                            </div>

                            {/* Spacer for desktop (sidebar is static on lg+) */}
                            <div className="hidden lg:flex lg:items-center" />

                            {/* User dropdown - right side */}
                            <div className="flex items-center sm:ms-6 ml-auto">
                                <div className="ms-3 relative">
                                    <Dropdown>
                                        <Dropdown.Trigger>
                                            <span className="inline-flex rounded-md">
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-500 bg-white hover:text-gray-700 focus:outline-none transition ease-in-out duration-150"
                                                >
                                                    {user.name}

                                                    <svg
                                                        className="ms-2 -me-0.5 h-4 w-4"
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        viewBox="0 0 20 20"
                                                        fill="currentColor"
                                                    >
                                                        <path
                                                            fillRule="evenodd"
                                                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                                            clipRule="evenodd"
                                                        />
                                                    </svg>
                                                </button>
                                            </span>
                                        </Dropdown.Trigger>

                                        <Dropdown.Content>
                                            <Dropdown.Link href={route('profile.edit')}>Profile</Dropdown.Link>
                                            <Dropdown.Link href={route('logout')} method="post" as="button">
                                                Log Out
                                            </Dropdown.Link>
                                        </Dropdown.Content>
                                    </Dropdown>
                                </div>
                            </div>
                        </div>
                    </div>
                </nav>

                {/* Breadcrumb */}
                <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
                    <nav className="flex items-center text-sm text-gray-500" aria-label="Breadcrumb">
                        <Link href={route('dashboard')} className="hover:text-gray-700 transition-colors">
                            Home
                        </Link>
                        <svg className="mx-2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="text-gray-900 font-medium">{getBreadcrumb()}</span>
                    </nav>
                </div>

                {/* Header slot */}
                {header && (
                    <header className="border-b border-slate-200 bg-white">
                        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">{header}</div>
                    </header>
                )}

                {/* Page content */}
                <main className="flex-1 overflow-y-auto bg-slate-100">
                    {children}
                </main>
            </div>
        </div>
    );
}
