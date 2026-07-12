import { useState } from 'react';
import ApplicationLogo from '@/Components/ApplicationLogo';
import Dropdown from '@/Components/Dropdown';
import NavLink from '@/Components/NavLink';
import ResponsiveNavLink from '@/Components/ResponsiveNavLink';
import { Link, usePage } from '@inertiajs/react';

export default function Authenticated({ header, children }) {
    const user = usePage().props.auth.user;
    const roleName = user.role?.role_name || 'LAPANGAN'; // Default to LAPANGAN if not loaded

    const [showingNavigationDropdown, setShowingNavigationDropdown] = useState(false);

    // Sidebar Menus based on Role Name
    const getRoleMenus = () => {
        switch (roleName) {
            case 'ADMIN':
                return [
                    { name: 'Dashboard', route: 'dashboard', icon: '📊' },
                    { name: 'Kontrol RAB', route: 'rab-control', icon: '📋' },
                    { name: 'Penyimpanan RAB', route: 'rab-storage', icon: '💾' },
                    { name: 'Purchase Orders', route: 'po', icon: '🛒' },
                    { name: 'Kontrak SPK', route: 'spk', icon: '📜' },
                    { name: 'Penerimaan Barang', route: 'goods-receipts', icon: '📦' },
                    { name: 'Input Opname', route: 'opname', icon: '🏗️' },
                    { name: 'Input Tagihan', route: 'invoicing', icon: '📥' },
                    { name: 'Approval', route: 'approval', icon: '✍️' },
                    { name: 'LPJ & Permohonan', route: 'fund-requests', icon: '💸' },
                    { name: 'Pembayaran', route: 'payment', icon: '💸' },
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

    const menus = getRoleMenus();

    return (
        <div className="min-h-screen bg-gray-100 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-gray-900 text-white flex-shrink-0 hidden md:flex flex-col">
                <div className="h-16 flex items-center justify-center border-b border-gray-800">
                    <Link href="/">
                        <ApplicationLogo className="block h-9 w-auto fill-current text-gray-200" />
                    </Link>
                </div>
                <nav className="flex-1 px-2 py-4 space-y-2">
                    {menus.map((menu, idx) => (
                        <NavLink
                            key={idx}
                            href={route(menu.route)}
                            active={route().current(menu.route)}
                            className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-md transition-colors w-full"
                        >
                            <span>{menu.icon}</span>
                            <span>{menu.name}</span>
                        </NavLink>
                    ))}
                </nav>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <nav className="bg-white border-b border-gray-100">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between h-16">
                            <div className="flex items-center md:hidden">
                                <button
                                    onClick={() => setShowingNavigationDropdown((previousState) => !previousState)}
                                    className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 focus:text-gray-500 transition duration-150 ease-in-out"
                                >
                                    <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                                        <path
                                            className={!showingNavigationDropdown ? 'inline-flex' : 'hidden'}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M4 6h16M4 12h16M4 18h16"
                                        />
                                        <path
                                            className={showingNavigationDropdown ? 'inline-flex' : 'hidden'}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </div>

                            <div className="hidden sm:flex sm:items-center sm:ms-6 ml-auto">
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

                    <div className={(showingNavigationDropdown ? 'block' : 'hidden') + ' sm:hidden'}>
                        <div className="pt-2 pb-3 space-y-1">
                            {menus.map((menu, idx) => (
                                <ResponsiveNavLink key={idx} href={route(menu.route)} active={route().current(menu.route)}>
                                    {menu.icon} {menu.name}
                                </ResponsiveNavLink>
                            ))}
                        </div>

                        <div className="pt-4 pb-1 border-t border-gray-200">
                            <div className="px-4">
                                <div className="font-medium text-base text-gray-800">{user.name}</div>
                                <div className="font-medium text-sm text-gray-500">{user.email}</div>
                            </div>

                            <div className="mt-3 space-y-1">
                                <ResponsiveNavLink href={route('profile.edit')}>Profile</ResponsiveNavLink>
                                <ResponsiveNavLink method="post" href={route('logout')} as="button">
                                    Log Out
                                </ResponsiveNavLink>
                            </div>
                        </div>
                    </div>
                </nav>

                {header && (
                    <header className="bg-white shadow">
                        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">{header}</div>
                    </header>
                )}

                <main className="flex-1 overflow-y-auto bg-gray-100 p-4">
                    {children}
                </main>
            </div>
        </div>
    );
}
