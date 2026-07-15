import { Head } from '@inertiajs/react';

const formatCurrency = (amount) => `Rp ${Number(amount || 0).toLocaleString('id-ID')}`;
const formatDate = (dateStr) => {
    if (!dateStr) return '\u2014';
    return new Date(dateStr).toLocaleDateString('id-ID', {
        year: 'numeric', month: 'long', day: 'numeric',
    });
};

function toRoman(num) {
    const romanNumerals = [
        [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
        [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
        [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
    ];
    let result = '';
    for (const [value, numeral] of romanNumerals) {
        while (num >= value) {
            result += numeral;
            num -= value;
        }
    }
    return result;
}

function getTitle(po) {
    if (po.po_type === 'REVISI') return 'PURCHASE ORDER REVISI';
    if (po.po_type === 'ADDENDUM') {
        const num = po.addendum_number ? toRoman(po.addendum_number) : 'I';
        return `PURCHASE ORDER (ADDENDUM ${num})`;
    }
    return 'PURCHASE ORDER';
}

export default function PurchaseOrderPrint({ po }) {
    if (!po) {
        return <div className="p-8 text-center text-gray-500">Data PO tidak ditemukan.</div>;
    }

    const items = po.items || [];
    const subtotal = items.reduce((sum, item) => sum + (item.total_price || (item.qty * item.unit_price)), 0);
    const discount = Number(po.discount || 0);
    const subtotalAfterDiscount = subtotal - discount;
    const includePpn = po.include_ppn !== false;
    const ppn = includePpn ? subtotalAfterDiscount * 0.11 : 0;
    const grandTotal = subtotalAfterDiscount + ppn;
    const hasDurasi = items.some(item => item.durasi);

    const catatanLines = po.catatan
        ? po.catatan.split('\n').filter(line => line.trim())
        : [];

    return (
        <>
            <Head title={`Cetak PO - ${po.po_number}`} />

            <div className="print-page">
                {/* Print Button - hidden during print */}
                <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
                    <button
                        onClick={() => window.print()}
                        className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 font-medium"
                    >
                        Cetak
                    </button>
                    <button
                        onClick={() => window.history.back()}
                        className="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-lg shadow hover:bg-gray-300 font-medium"
                    >
                        Kembali
                    </button>
                </div>

                {/* Document */}
                <div className="max-w-[210mm] mx-auto bg-white p-8 print:p-4 print:shadow-none shadow-lg" style={{ fontSize: '11px', lineHeight: '1.5' }}>

                    {/* Company Header */}
                    <div className="flex items-start justify-between border-b-2 border-black pb-3 mb-4">
                        <div className="flex flex-col gap-2">
                            <img
                                src="/images/logo-scs.png"
                                alt="PT. Sinar Cerah Sempurna"
                                className="h-auto w-72 max-w-full"
                            />
                            <div>
                                <p className="text-xs text-gray-700">Karangrejo Barat No. 9 RT 002 RW 002</p>
                                <p className="text-xs text-gray-700">Tinjomoyo, Banyumanik, Semarang</p>
                                <p className="text-xs text-gray-700">NPWP: 002.652.984.2-331.000</p>
                            </div>
                        </div>
                    </div>

                    {/* To Section */}
                    <div className="mb-4">
                        <p className="text-xs">Kepada Yth.</p>
                        <p className="text-xs font-bold">{po.supplier_name || '\u2014'}</p>
                        <p className="text-xs">{po.supplier_address || ''}</p>
                        <p className="text-xs">
                            {po.supplier_phone ? `Telp. ${po.supplier_phone}` : ''}
                            {po.supplier_contact_person ? ` Up. ${po.supplier_contact_person}` : ''}
                        </p>
                    </div>

                    {/* Title */}
                    <h2 className="text-center text-sm font-bold underline mb-4">{getTitle(po)}</h2>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-4 text-xs">
                        <div className="flex">
                            <span className="w-28 text-gray-600">Nomor</span>
                            <span>: {po.po_number}</span>
                        </div>
                        <div className="flex">
                            <span className="w-28 text-gray-600">Contact Person</span>
                            <span>: {po.supplier_contact_person || '\u2014'}</span>
                        </div>
                        <div className="flex">
                            <span className="w-28 text-gray-600">Tanggal</span>
                            <span>: {formatDate(po.date)}</span>
                        </div>
                        <div className="flex">
                            <span className="w-28 text-gray-600">Lokasi</span>
                            <span>: {po.project_location || po.project?.location || '\u2014'}</span>
                        </div>
                        <div className="flex">
                            <span className="w-28 text-gray-600">Proyek</span>
                            <span>: {po.project?.project_name || '\u2014'}</span>
                        </div>
                    </div>

                    {/* Opening */}
                    <div className="mb-3 text-xs">
                        <p>Dengan Hormat,</p>
                        <p>Bersama ini kami mohon diadakan material pada proyek tersebut sebagai berikut:</p>
                    </div>

                    {/* Items Table */}
                    <table className="w-full border-collapse mb-3 text-xs" style={{ border: '1px solid #333' }}>
                        <thead>
                            <tr className="bg-gray-800 text-white">
                                <th className="border border-gray-400 px-2 py-1.5 text-center" style={{ width: '30px' }}>No</th>
                                <th className="border border-gray-400 px-2 py-1.5 text-left">Uraian</th>
                                <th className="border border-gray-400 px-2 py-1.5 text-center" style={{ width: '50px' }}>Volume</th>
                                <th className="border border-gray-400 px-2 py-1.5 text-center" style={{ width: '50px' }}>Satuan</th>
                                {hasDurasi && (
                                    <th className="border border-gray-400 px-2 py-1.5 text-center" style={{ width: '60px' }}>Durasi</th>
                                )}
                                <th className="border border-gray-400 px-2 py-1.5 text-right" style={{ width: '90px' }}>Harga Satuan</th>
                                <th className="border border-gray-400 px-2 py-1.5 text-right" style={{ width: '100px' }}>Jumlah</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={hasDurasi ? 7 : 6} className="border border-gray-400 px-2 py-3 text-center text-gray-500">
                                        Tidak ada item
                                    </td>
                                </tr>
                            ) : (
                                items.map((item, index) => {
                                    const isSubItem = item.item_name?.startsWith('-');
                                    return (
                                        <tr key={item.id || index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td className="border border-gray-400 px-2 py-1 text-center">
                                                {isSubItem ? '' : index + 1}
                                            </td>
                                            <td className={`border border-gray-400 px-2 py-1 ${isSubItem ? 'pl-6 italic text-gray-600' : ''}`}>
                                                {item.item_name || item.rab_budget?.description || '\u2014'}
                                            </td>
                                            <td className="border border-gray-400 px-2 py-1 text-center">
                                                {isSubItem ? '' : Number(item.qty).toLocaleString('id-ID')}
                                            </td>
                                            <td className="border border-gray-400 px-2 py-1 text-center">
                                                {isSubItem ? '' : (item.unit || item.rab_budget?.unit || '\u2014')}
                                            </td>
                                            {hasDurasi && (
                                                <td className="border border-gray-400 px-2 py-1 text-center">
                                                    {isSubItem ? '' : (item.durasi || '')}
                                                </td>
                                            )}
                                            <td className="border border-gray-400 px-2 py-1 text-right">
                                                {isSubItem ? '' : formatCurrency(item.unit_price)}
                                            </td>
                                            <td className="border border-gray-400 px-2 py-1 text-right font-medium">
                                                {isSubItem ? '' : formatCurrency(item.total_price || (item.qty * item.unit_price))}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>

                    {/* Totals */}
                    <div className="flex justify-end mb-4">
                        <div className="w-72 text-xs">
                            <div className="flex justify-between py-1">
                                <span className="text-gray-600">SUBTOTAL</span>
                                <span className="font-medium">{formatCurrency(subtotal)}</span>
                            </div>
                            {discount > 0 && (
                                <div className="flex justify-between py-1 text-red-600">
                                    <span>Diskon</span>
                                    <span>- {formatCurrency(discount)}</span>
                                </div>
                            )}
                            {includePpn && (
                                <div className="flex justify-between py-1">
                                    <span className="text-gray-600">PPN 11%</span>
                                    <span className="font-medium">{formatCurrency(ppn)}</span>
                                </div>
                            )}
                            <div className="flex justify-between py-1.5 border-t-2 border-black font-bold text-sm">
                                <span>TOTAL</span>
                                <span>{formatCurrency(grandTotal)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Catatan */}
                    {catatanLines.length > 0 && (
                        <div className="mb-4 text-xs">
                            <p className="font-bold mb-1">Catatan:</p>
                            <ul className="list-disc pl-5 space-y-0.5">
                                {catatanLines.map((line, i) => (
                                    <li key={i}>{line.replace(/^[-•*]\s*/, '')}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Faktur Pajak */}
                    <div className="mb-4 text-xs border border-gray-300 p-3 rounded">
                        <p className="font-bold mb-1">Faktur Pajak</p>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <span className="text-gray-500">Nama:</span> {po.faktur_pajak_nama || 'PT. SINAR CERAH SEMPURNA'}
                            </div>
                            <div>
                                <span className="text-gray-500">NPWP:</span> {po.faktur_pajak_npwp || '002.652.984.2-331.000'}
                            </div>
                            <div>
                                <span className="text-gray-500">Alamat:</span> {po.faktur_pajak_alamat || 'Karangrejo Barat No. 9 RT 002 RW 002, Tinjomoyo, Banyumanik, Semarang'}
                            </div>
                        </div>
                    </div>

                    {/* Closing */}
                    <div className="mb-8 text-xs">
                        <p>Demikian surat dari kami, atas perhatian dan kerjasamanya kami ucapkan terima kasih.</p>
                    </div>

                    {/* Signature Block */}
                    <div className="flex justify-end mt-12">
                        <div className="text-center" style={{ width: '220px' }}>
                            <p className="text-xs mb-1">Hormat Kami,</p>
                            <p className="text-xs font-bold">PT. SINAR CERAH SEMPURNA</p>
                            <div className="h-16 mb-1" />
                            <p className="text-xs font-bold border-t border-black pt-1">NARWAN PRATANTA ST</p>
                            <p className="text-xs">Manager Komersial</p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-8 pt-3 border-t border-gray-200 text-xs text-gray-400 text-center">
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
