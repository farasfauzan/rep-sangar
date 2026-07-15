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
                    { name: 'Dashboard', route: 'dashboard', icon: '📊' },
                    { name: 'Kontrol RAB', route: 'rab-control', icon: '📋' },
                    { name: 'Penyimpanan RAB', route: 'rab-storage', icon: '💾' },
                    { name: 'Purchase Orders', route: 'po', icon: '🛒' },
                    { name: 'Supplier', route: 'suppliers', icon: '🏭' },
                    { name: 'Kontrak SPK', route: 'spk', icon: '📜' },
                    { name: 'Penerimaan Barang', route: 'goods-receipts', icon: '📦' },
                    { name: 'Input Opname', route: 'opname', icon: '🏗️' },
                    { name: 'Input Tagihan', route: 'invoicing', icon: '📥' },
                    { name: 'Approval', route: 'approval', icon: '✍️' },
                    { name: 'LPJ & Permohonan', route: 'fund-requests', icon: '💸' },
                    { name: 'Pembayaran', route: 'payment', icon: '💸' },
                    { name: 'Kelola User', route: 'admin.users', icon: '👥' },
                ];
            case 'LAPANGAN':
                return [
                    { name: 'Dashboard Proyek', route: 'dashboard', icon: '📊' },
                    { name: 'Draft PO', route: 'po', icon: '📝' },
                    { name: 'Penerimaan Barang', route: 'goods-receipts', icon: '📦' },
                    { name: 'Input Opname', route: 'opname', icon: '🏗️' },
                    { name: 'LPJ & Permohonan', route: 'fund-requests', icon: '💸' },
                ];
            case 'ENGINEER':
                return [
                    { name: 'Dashboard Verifikasi', route: 'dashboard', icon: '📋' },
                    { name: 'Kontrol RAB', route: 'rab-control', icon: '📋' },
                    { name: 'Penyimpanan RAB', route: 'rab-storage', icon: '💾' },
                    { name: 'Verifikasi Kebutuhan', route: 'dashboard', icon: '🔍' },
                    { name: 'Verifikasi Tagihan', route: 'approval', icon: '✅' },
                ];
            case 'PURCHASING_LEGAL':
                return [
                    { name: 'Dashboard Pengadaan', route: 'dashboard', icon: '📊' },
                    { name: 'Purchase Orders', route: 'po', icon: '🛒' },
                    { name: 'Supplier', route: 'suppliers', icon: '🏭' },
                    { name: 'Kontrak SPK', route: 'spk', icon: '📜' },
                    { name: 'Input Tagihan', route: 'invoicing', icon: '📥' },
                ];
            case 'VERIFIKATOR_KEU':
                return [
                    { name: 'Dashboard Verifikasi', route: 'dashboard', icon: '📊' },
                    { name: 'Verifikasi Dokumen', route: 'approval', icon: '📑' },
                    { name: 'Verifikasi LPJ', route: 'approval', icon: '⚖️' },
                ];
            case 'MGR_KOMERSIAL':
                return [
                    { name: 'Executive Dashboard', route: 'dashboard', icon: '📈' },
                    { name: 'Kontrol RAB', route: 'rab-control', icon: '📋' },
                    { name: 'Penyimpanan RAB', route: 'rab-storage', icon: '💾' },
                    { name: 'Approval PO & SPK', route: 'approval', icon: '✍️' },
                    { name: 'Approval Cashflow', route: 'approval', icon: '✍️' },
                ];
            case 'KEU_KANTOR':
                return [
                    { name: 'Dashboard Arus Kas', route: 'dashboard', icon: '📊' },
                    { name: 'Daftar Antrean Bayar', route: 'payment', icon: '💳' },
                    { name: 'Eksekusi Pembayaran', route: 'payment', icon: '💸' },
                ];
            case 'PAJAK':
                return [
                    { name: 'Dashboard Pajak', route: 'dashboard', icon: '🏛️' },
                    { name: 'Faktur Pajak', route: 'faktur-pajak', icon: '🧾' },
                    { name: 'E-Faktur CSV', route: 'e-faktur-csv', icon: '⬇️' },
                ];
            case 'ACCOUNTING':
                return [
                    { name: 'Dashboard Akuntansi', route: 'dashboard', icon: '📊' },
                    { name: 'Posting Jurnal', route: 'posting-jurnal', icon: '📔' },
                    { name: 'Laporan Keuangan', route: 'laporan-keuangan', icon: '📉' },
                    { name: 'Audit Trail', route: 'audit-trail', icon: '🔍' },
                ];
            default:
                return [{ name: 'Dashboard', route: 'dashboard', icon: '📊' }];
        }
    };

    const menus = [...getRoleMenus(), { name: 'Inventaris', route: 'inventory', icon: '📦' }];

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
        <div className="h-screen overflow-hidden bg-gray-100 flex">
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
                    'fixed inset-y-0 left-0 z-40 h-screen w-64 bg-gray-900 text-white flex flex-col transition-transform duration-300 ease-in-out ' +
                    'lg:static lg:flex-shrink-0 lg:translate-x-0 ' +
                    (sidebarOpen ? 'translate-x-0' : '-translate-x-full')
                }
            >
                {/* Sidebar header with logo */}
                <div className="h-16 flex items-center justify-between border-b border-gray-800 px-4">
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
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                    {menus.map((menu, idx) => {
                        const isActive = route().current(menu.route);
                        return (
                            <Link
                                key={idx}
                                href={route(menu.route)}
                                className={
                                    'flex items-center gap-3 px-4 py-2.5 rounded-md text-sm transition-colors w-full ' +
                                    (isActive
                                        ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600 font-semibold'
                                        : 'text-gray-300 hover:bg-gray-800 hover:text-white border-l-4 border-transparent')
                                }
                            >
                                <span className="text-base">{menu.icon}</span>
                                <span>{menu.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* User info section at sidebar bottom */}
                <div className="border-t border-gray-800 p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 h-9 w-9 rounded-full bg-gray-700 flex items-center justify-center text-sm font-medium text-white">
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{user.name}</p>
                            <span
                                className={
                                    'inline-block mt-0.5 px-2 py-0.5 text-xs font-medium rounded-full ' +
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
                <nav className="bg-white border-b border-gray-100 shadow-sm">
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
                <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-3">
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
                    <header className="bg-white shadow">
                        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">{header}</div>
                    </header>
                )}

                {/* Page content */}
                <main className="flex-1 overflow-y-auto bg-gray-100 p-4">
                    {children}
                </main>
            </div>
        </div>
    );
}
