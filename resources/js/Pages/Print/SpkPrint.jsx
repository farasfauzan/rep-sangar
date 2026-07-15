import { Head } from '@inertiajs/react';

const formatCurrency = (amount) => `Rp ${Number(amount || 0).toLocaleString('id-ID')}`;
const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('id-ID', {
        year: 'numeric', month: 'long', day: 'numeric',
    });
};

const statusLabels = {
    DRAFT: 'Draft',
    PENDING_APPROVAL: 'Menunggu Approval',
    APPROVED: 'Disetujui',
    REJECTED: 'Ditolak',
};

const statusColors = {
    DRAFT: 'bg-gray-100 text-gray-700 border-gray-300',
    PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    APPROVED: 'bg-green-100 text-green-800 border-green-300',
    REJECTED: 'bg-red-100 text-red-800 border-red-300',
};

export default function SpkPrint({ spk }) {
    if (!spk) {
        return <div className="p-8 text-center text-gray-500">Data SPK tidak ditemukan.</div>;
    }

    const subtotal = Number(spk.subtotal || 0);
    const ppn = subtotal * 0.11;
    const grandTotal = subtotal + ppn;

    return (
        <>
            <Head title={`Cetak SPK - ${spk.spk_number}`} />

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
                            <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide">Surat Perintah Kerja</h2>
                        </div>
                    </div>

                    {/* SPK Info */}
                    <div className="grid grid-cols-2 gap-6 mb-6">
                        <div>
                            <table className="text-sm">
                                <tbody>
                                    <tr>
                                        <td className="pr-3 py-1 text-gray-500 align-top">No. SPK</td>
                                        <td className="py-1 font-semibold text-gray-900">: {spk.spk_number}</td>
                                    </tr>
                                    <tr>
                                        <td className="pr-3 py-1 text-gray-500 align-top">Tanggal</td>
                                        <td className="py-1 font-semibold text-gray-900">: {formatDate(spk.created_at)}</td>
                                    </tr>
                                    <tr>
                                        <td className="pr-3 py-1 text-gray-500 align-top">Status</td>
                                        <td className="py-1">
                                            : <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border ${statusColors[spk.status] || 'bg-gray-100 text-gray-700 border-gray-300'}`}>
                                                {statusLabels[spk.status] || spk.status?.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div>
                            <table className="text-sm">
                                <tbody>
                                    <tr>
                                        <td className="pr-3 py-1 text-gray-500 align-top">Subkontraktor</td>
                                        <td className="py-1 font-semibold text-gray-900">: {spk.subcon_name}</td>
                                    </tr>
                                    <tr>
                                        <td className="pr-3 py-1 text-gray-500 align-top">Proyek</td>
                                        <td className="py-1 font-semibold text-gray-900">: {spk.project?.project_name || '—'}</td>
                                    </tr>
                                    <tr>
                                        <td className="pr-3 py-1 text-gray-500 align-top">Termin Bayar</td>
                                        <td className="py-1 font-semibold text-gray-900">: {spk.payment_terms || '—'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Scope of Work */}
                    <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-200">
                        <h3 className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Ruang Lingkup Pekerjaan</h3>
                        <p className="text-sm text-gray-700 leading-relaxed">
                            {spk.scope_of_work || 'Pekerjaan subkontraktor sesuai dengan ketentuan dalam kontrak SPK ini dan lampiran terkait.'}
                        </p>
                    </div>

                    {/* Value Breakdown */}
                    <table className="w-full border-collapse mb-6 text-sm">
                        <thead>
                            <tr className="bg-gray-800 text-white">
                                <th className="border border-gray-300 px-3 py-2 text-left">Deskripsi</th>
                                <th className="border border-gray-300 px-3 py-2 text-right w-40">Nilai (Rp)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border border-gray-300 px-3 py-2">Nilai Kontrak (sebelum PPN)</td>
                                <td className="border border-gray-300 px-3 py-2 text-right font-medium">{formatCurrency(subtotal)}</td>
                            </tr>
                            <tr>
                                <td className="border border-gray-300 px-3 py-2">PPN 11%</td>
                                <td className="border border-gray-300 px-3 py-2 text-right font-medium">{formatCurrency(ppn)}</td>
                            </tr>
                            <tr className="bg-gray-50">
                                <td className="border border-gray-300 px-3 py-2 font-bold">Total Nilai Kontrak</td>
                                <td className="border border-gray-300 px-3 py-2 text-right font-bold text-indigo-700">{formatCurrency(grandTotal)}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Progress Tracking */}
                    {spk.progress && spk.progress.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Progres Pekerjaan</h3>
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="border border-gray-300 px-3 py-2 text-left">Deskripsi Pekerjaan</th>
                                        <th className="border border-gray-300 px-3 py-2 text-center">Progres (%)</th>
                                        <th className="border border-gray-300 px-3 py-2 text-right">Nilai (Rp)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {spk.progress.map((item, i) => (
                                        <tr key={item.id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td className="border border-gray-300 px-3 py-2">{item.work_description || '—'}</td>
                                            <td className="border border-gray-300 px-3 py-2 text-center font-medium">{item.progress_percentage}%</td>
                                            <td className="border border-gray-300 px-3 py-2 text-right font-medium">{formatCurrency(item.amount)}</td>
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
                            <p className="text-sm font-medium text-gray-600 mb-1">Disetujui oleh</p>
                            <div className="h-20 border-b border-gray-400 mx-4 mb-2" />
                            <p className="text-sm text-gray-500">(___________________)</p>
                            <p className="text-xs text-gray-400 mt-1">Nama & Tanda Tangan</p>
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium text-gray-600 mb-1">Diterima oleh</p>
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
