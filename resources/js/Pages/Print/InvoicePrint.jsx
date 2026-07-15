import { Head } from '@inertiajs/react';

const formatCurrency = (amount) => `Rp ${Number(amount || 0).toLocaleString('id-ID')}`;
const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('id-ID', {
        year: 'numeric', month: 'long', day: 'numeric',
    });
};

const statusLabels = {
    PENDING_ENGINEER: 'Menunggu Verifikasi Engineer',
    ENGINEER_VERIFIED: 'Terverifikasi Engineer',
    PENDING_APPROVAL: 'Menunggu Approval',
    UNPAID: 'Belum Dibayar',
    PAID: 'Sudah Dibayar',
};

const statusColors = {
    PENDING_ENGINEER: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    ENGINEER_VERIFIED: 'bg-blue-100 text-blue-800 border-blue-300',
    PENDING_APPROVAL: 'bg-orange-100 text-orange-800 border-orange-300',
    UNPAID: 'bg-red-100 text-red-800 border-red-300',
    PAID: 'bg-green-100 text-green-800 border-green-300',
};

export default function InvoicePrint({ invoice }) {
    if (!invoice) {
        return <div className="p-8 text-center text-gray-500">Data invoice tidak ditemukan.</div>;
    }

    const isMaterial = invoice.invoiceable_type?.includes('PurchaseOrder');
    const refType = isMaterial ? 'Purchase Order (Material)' : 'Kontrak SPK (Subkon)';
    const refNumber = isMaterial
        ? (invoice.invoiceable?.po_number || `PO #${invoice.invoiceable_id}`)
        : (invoice.invoiceable?.spk_number || `SPK #${invoice.invoiceable_id}`);

    return (
        <>
            <Head title={`Cetak Invoice - ${invoice.invoice_number}`} />

            <div className="print-page">
                {/* Print Button */}
                <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
                    <button
                        onClick={() => window.print()}
                        className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 font-medium"
                    >
                        🖨️ Cetak
                    </button>
                    <button
                        onClick={() => window.history.back()}
                        className="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-lg shadow hover:bg-gray-300 font-medium"
                    >
                        ← Kembali
                    </button>
                </div>

                {/* Document */}
                <div className="max-w-[210mm] mx-auto bg-white p-8 print:p-4 print:shadow-none shadow-lg">
                    {/* Company Header */}
                    <div className="flex items-start justify-between border-b-2 border-gray-800 pb-4 mb-6">
                        <div className="flex flex-col gap-2">
                            <img
                                src="/images/logo-scs.png"
                                alt="PT. Sinar Cerah Sempurna"
                                className="h-auto w-72 max-w-full"
                            />
                            <div>
                                <p className="text-sm text-gray-600">Karangrejo Barat No. 9 RT 002 RW 002</p>
                                <p className="text-sm text-gray-600">Tinjomoyo, Banyumanik, Semarang</p>
                                <p className="text-sm text-gray-600">NPWP: 002.652.984.2-331.000</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">Invoice</h2>
                        </div>
                    </div>

                    {/* Invoice Info */}
                    <div className="grid grid-cols-2 gap-6 mb-6">
                        <div>
                            <table className="text-sm">
                                <tbody>
                                    <tr>
                                        <td className="pr-3 py-1 text-gray-500 align-top">No. Invoice</td>
                                        <td className="py-1 font-semibold text-gray-900">: {invoice.invoice_number}</td>
                                    </tr>
                                    <tr>
                                        <td className="pr-3 py-1 text-gray-500 align-top">Tanggal Invoice</td>
                                        <td className="py-1 font-semibold text-gray-900">: {formatDate(invoice.invoice_date)}</td>
                                    </tr>
                                    {invoice.due_date && (
                                        <tr>
                                            <td className="pr-3 py-1 text-gray-500 align-top">Jatuh Tempo</td>
                                            <td className="py-1 font-semibold text-gray-900">: {formatDate(invoice.due_date)}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div>
                            <table className="text-sm">
                                <tbody>
                                    <tr>
                                        <td className="pr-3 py-1 text-gray-500 align-top">Tipe Tagihan</td>
                                        <td className="py-1 font-semibold text-gray-900">: {refType}</td>
                                    </tr>
                                    <tr>
                                        <td className="pr-3 py-1 text-gray-500 align-top">Referensi</td>
                                        <td className="py-1 font-semibold text-gray-900">: {refNumber}</td>
                                    </tr>
                                    <tr>
                                        <td className="pr-3 py-1 text-gray-500 align-top">Status</td>
                                        <td className="py-1">
                                            : <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border ${statusColors[invoice.status] || 'bg-gray-100 text-gray-700 border-gray-300'}`}>
                                                {statusLabels[invoice.status] || invoice.status?.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Supplier / Subcontractor Info */}
                    {(invoice.invoiceable?.supplier_name || invoice.invoiceable?.subcon_name) && (
                        <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-200">
                            <p className="text-sm text-gray-500">
                                {isMaterial ? 'Supplier' : 'Subkontraktor'}:
                            </p>
                            <p className="text-sm font-semibold text-gray-900">
                                {invoice.invoiceable?.supplier_name || invoice.invoiceable?.subcon_name}
                            </p>
                            {invoice.invoiceable?.project?.project_name && (
                                <p className="text-sm text-gray-600 mt-1">
                                    Proyek: {invoice.invoiceable.project.project_name}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Items (for PO-based invoices) */}
                    {isMaterial && invoice.invoiceable?.items && invoice.invoiceable.items.length > 0 && (
                        <table className="w-full border-collapse mb-6 text-sm">
                            <thead>
                                <tr className="bg-gray-800 text-white">
                                    <th className="border border-gray-300 px-3 py-2 text-center w-10">No</th>
                                    <th className="border border-gray-300 px-3 py-2 text-left">Nama Item</th>
                                    <th className="border border-gray-300 px-3 py-2 text-center w-16">Qty</th>
                                    <th className="border border-gray-300 px-3 py-2 text-right w-28">Harga Satuan</th>
                                    <th className="border border-gray-300 px-3 py-2 text-right w-32">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.invoiceable.items.map((item, index) => (
                                    <tr key={item.id || index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="border border-gray-300 px-3 py-2 text-center">{index + 1}</td>
                                        <td className="border border-gray-300 px-3 py-2">{item.item_name || item.rab_budget?.description || '—'}</td>
                                        <td className="border border-gray-300 px-3 py-2 text-center">{Number(item.qty).toLocaleString('id-ID')}</td>
                                        <td className="border border-gray-300 px-3 py-2 text-right">{formatCurrency(item.unit_price)}</td>
                                        <td className="border border-gray-300 px-3 py-2 text-right font-medium">{formatCurrency(item.total_price || (item.qty * item.unit_price))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {/* Invoice Amount */}
                    <div className="flex justify-end mb-8">
                        <div className="w-72">
                            <div className="flex justify-between py-2.5 border-b-2 border-gray-800 text-base font-bold">
                                <span>Total Tagihan</span>
                                <span className="text-indigo-700">{formatCurrency(invoice.amount)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Payment Info */}
                    {invoice.transactions && invoice.transactions.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Riwayat Pembayaran</h3>
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="border border-gray-300 px-3 py-2 text-left">Metode</th>
                                        <th className="border border-gray-300 px-3 py-2 text-right">Jumlah</th>
                                        <th className="border border-gray-300 px-3 py-2 text-center">Tanggal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoice.transactions.map((tx, i) => (
                                        <tr key={tx.id || i}>
                                            <td className="border border-gray-300 px-3 py-2">{tx.payment_method || '—'}</td>
                                            <td className="border border-gray-300 px-3 py-2 text-right font-medium">{formatCurrency(tx.amount)}</td>
                                            <td className="border border-gray-300 px-3 py-2 text-center">{formatDate(tx.payment_date)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Approval Signatures */}
                    <div className="grid grid-cols-3 gap-8 mt-12 pt-4 border-t border-gray-300">
                        <div className="text-center">
                            <p className="text-sm font-medium text-gray-600 mb-1">Disiapkan oleh</p>
                            <div className="h-20 border-b border-gray-400 mx-4 mb-2" />
                            <p className="text-sm text-gray-500">(___________________)</p>
                            <p className="text-xs text-gray-400 mt-1">Nama & Tanda Tangan</p>
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium text-gray-600 mb-1">Diverifikasi oleh</p>
                            <div className="h-20 border-b border-gray-400 mx-4 mb-2" />
                            <p className="text-sm text-gray-500">(___________________)</p>
                            <p className="text-xs text-gray-400 mt-1">Nama & Tanda Tangan</p>
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium text-gray-600 mb-1">Disetujui oleh</p>
                            <div className="h-20 border-b border-gray-400 mx-4 mb-2" />
                            <p className="text-sm text-gray-500">(___________________)</p>
                            <p className="text-xs text-gray-400 mt-1">Nama & Tanda Tangan</p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-400 text-center">
                        Dicetak pada {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </div>

            <style>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 15mm;
                    }
                    body {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-page {
                        padding: 0;
                        margin: 0;
                    }
                }
            `}</style>
        </>
    );
}
