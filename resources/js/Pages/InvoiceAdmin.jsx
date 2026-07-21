import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';

export default function InvoiceAdmin() {
    const [invoices, setInvoices] = useState([]);
    const [pos, setPos] = useState([]);
    const [opnames, setOpnames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [message, setMessage] = useState('');
    const [attachment, setAttachment] = useState({ invoiceId: '', docType: 'INVOICE', file: null });
    const api = useApi();

    const [form, setForm] = useState({
        invoiceable_type: 'App\\Models\\PurchaseOrder',
        invoiceable_id: '',
        invoice_number: 'INV-' + Math.floor(Math.random() * 100000),
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: '',
        opname_id: '',
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [invData, poData, opnameData] = await Promise.all([
                api.get('/api/invoices', {}, { silent: true }),
                api.get('/api/pos', {}, { silent: true }),
                api.get('/api/opnames', {}, { silent: true }),
            ]);
            setInvoices(invData.data || invData);
            setPos(poData.data || poData);
            setOpnames(opnameData.data || opnameData);
        } catch (err) {
            // errors logged silently
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/api/invoices', form);
            setMessage(res.message || 'Invoice berhasil dibuat.');
            setShowForm(false);
            await loadData();
            setForm({
                ...form,
                invoice_number: 'INV-' + Math.floor(Math.random() * 100000),
                invoiceable_id: '',
                due_date: '',
                opname_id: '',
            });
        } catch (err) {
            setMessage(err.response?.data?.message || 'Gagal membuat invoice.');
        }
    };

    const receivablePos = pos.filter((po) => po.po_level === 'SUPPLIER' && po.status === 'RECEIVED' && !invoices.some((invoice) => invoice.invoiceable_type?.includes('PurchaseOrder') && invoice.invoiceable_id === po.id));
    const invoiceableOpnames = opnames.filter((opname) => opname.status === 'APPROVED' && opname.spk?.status === 'APPROVED' && !invoices.some((invoice) => invoice.opname_id === opname.id));

    const uploadAttachment = async () => {
        if (!attachment.invoiceId || !attachment.file) {
            setMessage('Pilih invoice, jenis dokumen, dan file terlebih dahulu.');
            return;
        }
        const body = new FormData();
        body.append('doc_type', attachment.docType);
        body.append('file', attachment.file);
        try {
            await api.post(`/api/invoices/${attachment.invoiceId}/attachments`, body);
            setAttachment({ invoiceId: '', docType: 'INVOICE', file: null });
            await loadData();
            setMessage('Dokumen invoice berhasil diunggah.');
        } catch (err) {
            setMessage(err.response?.data?.message || 'Gagal mengunggah dokumen invoice.');
        }
    };

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold leading-tight text-gray-800">Drafting Tagihan (Invoicing)</h2>}>
            <Head title="Invoice Admin" />
            <div className="py-12">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8 space-y-6">

                    {message && (
                        <div className="p-4 bg-green-100 text-green-700 rounded shadow">
                            {message}
                        </div>
                    )}

                    <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold">Terbitkan Tagihan Baru</h3>
                                <button
                                    onClick={() => setShowForm(!showForm)}
                                    className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700"
                                >
                                    {showForm ? 'Tutup Form' : '+ Buat Invoice'}
                                </button>
                            </div>

                            {showForm && (
                                <form onSubmit={handleSubmit} className="space-y-4 mt-4 border-t pt-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Tipe Referensi</label>
                                            <select
                                                value={form.invoiceable_type}
                                                onChange={e => setForm({...form, invoiceable_type: e.target.value, invoiceable_id: '', opname_id: ''})}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
                                            >
                                                <option value="App\Models\PurchaseOrder">Purchase Order (Material)</option>
                                                <option value="App\Models\Spk">Kontrak SPK (Subkon)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">{form.invoiceable_type === 'App\\Models\\PurchaseOrder' ? 'Pilih PO yang sudah diterima' : 'Pilih Opname yang sudah disetujui'}</label>
                                            <select
                                                required
                                                value={form.invoiceable_type === 'App\\Models\\PurchaseOrder' ? form.invoiceable_id : form.opname_id}
                                                onChange={e => {
                                                    if (form.invoiceable_type === 'App\\Models\\PurchaseOrder') {
                                                        setForm({...form, invoiceable_id: e.target.value});
                                                        return;
                                                    }
                                                    const opname = invoiceableOpnames.find((item) => item.id === Number(e.target.value));
                                                    setForm({...form, opname_id: e.target.value, invoiceable_id: opname?.spk_id || ''});
                                                }}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
                                            >
                                                <option value="">-- Pilih --</option>
                                                {form.invoiceable_type === 'App\\Models\\PurchaseOrder' ? 
                                                    receivablePos.map(p => <option key={p.id} value={p.id}>{p.po_number} - Rp {Number(p.total_amount).toLocaleString('id-ID')}</option>)
                                                    :
                                                    invoiceableOpnames.map(opname => <option key={opname.id} value={opname.id}>{opname.opname_number} — {opname.spk?.spk_number || 'SPK'} - Rp {Number(opname.amount).toLocaleString('id-ID')}</option>)
                                                }
                                            </select>
                                            {form.invoiceable_type === 'App\\Models\\PurchaseOrder' && !receivablePos.length && <p className="mt-1 text-xs text-amber-700">Tidak ada PO yang sudah diterima dan belum ditagihkan.</p>}
                                            {form.invoiceable_type === 'App\\Models\\Spk' && !invoiceableOpnames.length && <p className="mt-1 text-xs text-amber-700">Tidak ada opname SPK yang sudah disetujui dan belum ditagihkan.</p>}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">No. Invoice (Faktur)</label>
                                            <input type="text" required value={form.invoice_number} onChange={e => setForm({...form, invoice_number: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Tanggal Invoice</label>
                                            <input type="date" required value={form.invoice_date} onChange={e => setForm({...form, invoice_date: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" />
                                        </div>
                                    </div>
                                    <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded shadow hover:bg-green-700">
                                        Terbitkan Invoice
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>

                    <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg">
                        <div className="p-6">
                            <h3 className="text-lg font-bold">Kelengkapan Dokumen Tagihan</h3>
                            <p className="mt-1 text-sm text-gray-600">Upload dokumen sebelum Verifikator Keuangan memproses invoice.</p>
                            <div className="mt-4 grid gap-3 md:grid-cols-4">
                                <select value={attachment.invoiceId} onChange={(e) => setAttachment((current) => ({ ...current, invoiceId: e.target.value }))} className="rounded border-gray-300 text-sm">
                                    <option value="">Pilih invoice</option>
                                    {invoices.filter((inv) => !['PAID', 'CASHFLOW_REJECTED'].includes(inv.status)).map((inv) => <option key={inv.id} value={inv.id}>{inv.invoice_number}</option>)}
                                </select>
                                <select value={attachment.docType} onChange={(e) => setAttachment((current) => ({ ...current, docType: e.target.value }))} className="rounded border-gray-300 text-sm">
                                    <option value="INVOICE">Invoice</option>
                                    <option value="PO">PO</option>
                                    <option value="SPK">SPK</option>
                                    <option value="SURAT_JALAN">Surat Jalan</option>
                                    <option value="OPNAME">Opname</option>
                                    <option value="BAST">BAST</option>
                                    <option value="FAKTUR_PAJAK">Faktur Pajak</option>
                                </select>
                                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls" onChange={(e) => setAttachment((current) => ({ ...current, file: e.target.files?.[0] || null }))} className="text-sm" />
                                <button type="button" onClick={uploadAttachment} className="rounded bg-indigo-600 px-4 py-2 text-sm text-white">Upload Dokumen</button>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg">
                        <div className="p-6">
                            <h3 className="text-lg font-bold mb-4">Daftar Tagihan (Menunggu Approval)</h3>
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">No. Invoice</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipe Tagihan</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nilai (Rp)</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dokumen Tagihan</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {invoices.length === 0 ? (
                                        <tr><td colSpan="6" className="px-6 py-4 text-center text-gray-500">Belum ada tagihan.</td></tr>
                                    ) : (
                                        invoices.map((inv) => (
                                            <tr key={inv.id}>
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{inv.invoice_number}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    {inv.invoiceable_type.includes('PurchaseOrder') ? 'Material (PO)' : 'Subkon (SPK)'}
                                                </td>
                                                <td className="px-6 py-4 text-sm font-bold text-gray-900">
                                                    Rp {Number(inv.amount).toLocaleString('id-ID')}
                                                </td>
                                                <td className="px-6 py-4 text-sm">
                                                    {(!inv.missing_documents || inv.missing_documents.length === 0) ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                                                            ✓ Lengkap
                                                        </span>
                                                    ) : (
                                                        <div className="flex flex-col gap-1">
                                                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700">
                                                                ⚠️ Kurang ({inv.missing_documents.length}):
                                                            </span>
                                                            <div className="flex flex-wrap gap-1">
                                                                {inv.missing_documents.map((doc) => (
                                                                    <span key={doc} className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                                                                        {doc}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-sm">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                        inv.status === 'PENDING_APPROVAL' ? 'bg-yellow-100 text-yellow-800' : 
                                                        (inv.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800')
                                                    }`}>
                                                        {inv.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm">
                                                    <button
                                                        onClick={() => window.open(`/invoices/${inv.id}/print`, '_blank')}
                                                        className="text-indigo-600 hover:text-indigo-900 font-medium"
                                                    >
                                                        Cetak
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </div>
        </AuthenticatedLayout>
    );
}
