import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/Components/ui/Toast';
import ConfirmModal from '@/Components/ui/ConfirmModal';

const today = () => new Date().toISOString().slice(0, 10);
const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function PaymentExecution() {
    const [invoices, setInvoices] = useState([]);
    const [funds, setFunds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [payment, setPayment] = useState({ payment_method: 'TRANSFER', payment_date: today(), amount: '', proof_of_payment: '' });
    const [confirmState, setConfirmState] = useState({ open: false, url: '', message: '' });
    const api = useApi();
    const toast = useToast();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [invoiceData, fundData] = await Promise.all([
                api.get('/api/invoices', {}, { silent: true }),
                api.get('/api/fund-requests', {}, { silent: true }),
            ]);
            setInvoices(invoiceData.data || invoiceData);
            setFunds(fundData.data || fundData);
        } catch (err) {
            // error handled silently
        } finally {
            setLoading(false);
        }
    };

    const updatePayment = (field, value) => setPayment((current) => ({ ...current, [field]: value }));

    const pay = (url, message, amount) => {
        setPayment((current) => ({ ...current, amount: amount ?? '' }));
        setConfirmState({ open: true, url, message });
    };

    const handleConfirmPay = async () => {
        const { url } = confirmState;
        setConfirmState({ open: false, url: '', message: '' });
        try {
            await api.post(url, payment);
            toast.success('Pembayaran dan bukti bayar dicatat.');
            setPayment((current) => ({ ...current, amount: '', proof_of_payment: '' }));
            await fetchData();
        } catch (err) {
            // toast shown by useApi
        }
    };

    const payableInvoices = invoices.filter((invoice) => ['UNPAID', 'PARTIAL'].includes(invoice.status));
    const payableFunds = funds.filter((fund) => fund.status === 'APPROVED');

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold leading-tight text-gray-800">Eksekusi Pembayaran</h2>}>
            <Head title="Payment Execution" />
            <div className="py-12">
                <div className="mx-auto max-w-7xl space-y-6 sm:px-6 lg:px-8">
                    <div className="bg-white p-6 shadow-sm sm:rounded-lg">
                        <h3 className="mb-4 text-lg font-bold">Data Bukti Bayar</h3>
                        <div className="grid gap-4 md:grid-cols-3">
                            <label className="text-sm font-medium text-gray-700">
                                Metode
                                <select value={payment.payment_method} onChange={(e) => updatePayment('payment_method', e.target.value)} className="mt-1 w-full rounded border-gray-300">
                                    <option value="TRANSFER">Transfer</option>
                                    <option value="BG">BG</option>
                                    <option value="TUNAI">Tunai</option>
                                </select>
                            </label>
                            <label className="text-sm font-medium text-gray-700">
                                Tanggal Bayar
                                <input type="date" value={payment.payment_date} onChange={(e) => updatePayment('payment_date', e.target.value)} className="mt-1 w-full rounded border-gray-300" />
                            </label>
                            <label className="text-sm font-medium text-gray-700">
                                No Bukti / Referensi
                                <input value={payment.proof_of_payment} onChange={(e) => updatePayment('proof_of_payment', e.target.value)} className="mt-1 w-full rounded border-gray-300" placeholder="TRF-001 / BG-001" />
                            </label>
                            <label className="text-sm font-medium text-gray-700">
                                Nilai Bayar (boleh bertahap)
                                <input type="number" min="0.01" step="0.01" value={payment.amount} onChange={(e) => updatePayment('amount', e.target.value)} className="mt-1 w-full rounded border-gray-300" placeholder="Kosongkan untuk pelunasan" />
                            </label>
                        </div>
                    </div>

                    {loading ? <p>Memuat...</p> : (
                        <>
                            <PaymentTable title="Antrean Bayar Invoice" empty="Tidak ada invoice siap bayar.">
                                {payableInvoices.map((invoice) => (
                                    <tr key={invoice.id}>
                                        <Td strong>{invoice.invoice_number}</Td>
                                        <Td>{invoice.invoiceable_type?.includes('PurchaseOrder') ? 'PO Material' : 'SPK Subkon'}</Td>
                                        <Td>{money(invoice.amount)}</Td>
                                        <Td>{invoice.status}</Td>
                                        <Td><Button onClick={() => pay(`/api/invoices/${invoice.id}/payments`, 'Bayar invoice ini?', Number(invoice.amount) - Number(invoice.transactions?.reduce((sum, tx) => sum + Number(tx.amount || 0), 0))) }>Bayar</Button></Td>
                                    </tr>
                                ))}
                            </PaymentTable>

                            <PaymentTable title="Antrean Bayar Dana Proyek" empty="Tidak ada permohonan dana siap bayar.">
                                {payableFunds.map((fund) => (
                                    <tr key={fund.id}>
                                        <Td strong>{fund.request_number}</Td>
                                        <Td>{fund.project?.project_name ?? 'N/A'}</Td>
                                        <Td>{money(fund.amount)}</Td>
                                        <Td>{fund.status}</Td>
                                        <Td><Button onClick={() => pay(`/api/fund-requests/${fund.id}/payments`, 'Bayar dana proyek ini?')}>Bayar Dana</Button></Td>
                                    </tr>
                                ))}
                            </PaymentTable>
                        </>
                    )}
                </div>
            </div>

            <ConfirmModal
                open={confirmState.open}
                onClose={() => setConfirmState({ open: false, url: '', message: '' })}
                onConfirm={handleConfirmPay}
                title="Konfirmasi Pembayaran"
                message={confirmState.message}
                confirmText="Bayar"
            />
        </AuthenticatedLayout>
    );
}

function PaymentTable({ title, empty, children }) {
    const rows = Array.isArray(children) ? children.filter(Boolean) : [children].filter(Boolean);

    return (
        <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg">
            <div className="p-6">
                <h3 className="mb-4 text-lg font-bold">{title}</h3>
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Nomor</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Tipe/Proyek</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Nilai</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                        {rows.length ? rows : <tr><td colSpan="5" className="px-4 py-4 text-center text-sm text-gray-500">{empty}</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function Td({ children, strong = false }) {
    return <td className={`px-4 py-3 text-sm ${strong ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{children}</td>;
}

function Button({ children, onClick }) {
    return <button onClick={onClick} className="rounded bg-blue-600 px-3 py-1 text-sm text-white shadow hover:bg-blue-700">{children}</button>;
}
