import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/Components/ui/Toast';

const today = () => new Date().toISOString().slice(0, 10);
const initialForm = () => ({ transaction_date: today(), bank_name: '', account_number: '', reference_number: '', description: '', debit: 0, credit: 0 });
const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function BankStatements() {
    const api = useApi();
    const toast = useToast();
    const [statements, setStatements] = useState([]);
    const [form, setForm] = useState(initialForm());
    const [csv, setCsv] = useState(null);

    const load = async () => {
        try {
            const response = await api.get('/api/bank-statements', { per_page: 100 }, { silent: true });
            setStatements(response.data || response || []);
        } catch { /* handled by API */ }
    };
    useEffect(() => { load(); }, []);

    const submit = async (event) => {
        event.preventDefault();
        try {
            await api.post('/api/bank-statements', form);
            setForm(initialForm());
            await load();
            toast.success('Mutasi rekening disimpan.');
        } catch { /* toast from API */ }
    };

    const upload = async () => {
        if (!csv) return toast.error('Pilih CSV rekening koran.');
        const body = new FormData();
        body.append('file', csv);
        try {
            await api.post('/api/bank-statements/upload', body);
            setCsv(null);
            await load();
            toast.success('CSV rekening koran diimpor.');
        } catch { /* toast from API */ }
    };

    const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-gray-800">Rekening Koran & Rekonsiliasi</h2>}>
            <Head title="Rekening Koran" />
            <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
                <section className="rounded-lg bg-white p-6 shadow-sm">
                    <h3 className="text-lg font-bold">Input Mutasi Rekening</h3>
                    <form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-4">
                        <input type="date" value={form.transaction_date} onChange={(e) => set('transaction_date', e.target.value)} className="rounded border-gray-300 text-sm" required />
                        <input placeholder="Nama bank" value={form.bank_name} onChange={(e) => set('bank_name', e.target.value)} className="rounded border-gray-300 text-sm" required />
                        <input placeholder="No rekening" value={form.account_number} onChange={(e) => set('account_number', e.target.value)} className="rounded border-gray-300 text-sm" />
                        <input placeholder="No referensi" value={form.reference_number} onChange={(e) => set('reference_number', e.target.value)} className="rounded border-gray-300 text-sm" />
                        <input placeholder="Keterangan" value={form.description} onChange={(e) => set('description', e.target.value)} className="rounded border-gray-300 text-sm md:col-span-2" />
                        <input type="number" min="0" placeholder="Debit" value={form.debit} onChange={(e) => set('debit', e.target.value)} className="rounded border-gray-300 text-sm" />
                        <input type="number" min="0" placeholder="Kredit" value={form.credit} onChange={(e) => set('credit', e.target.value)} className="rounded border-gray-300 text-sm" />
                        <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white md:col-span-4">Simpan Mutasi</button>
                    </form>
                    <div className="mt-5 flex flex-wrap items-center gap-3 border-t pt-4">
                        <span className="text-sm font-medium text-gray-700">Impor CSV:</span>
                        <input type="file" accept=".csv,.txt" onChange={(e) => setCsv(e.target.files?.[0] || null)} className="text-sm" />
                        <button type="button" onClick={upload} className="rounded bg-slate-700 px-4 py-2 text-sm text-white">Impor CSV</button>
                        <span className="text-xs text-gray-500">Kolom: transaction_date, bank_name, debit, credit, reference_number, description</span>
                    </div>
                </section>

                <section className="overflow-hidden rounded-lg bg-white shadow-sm">
                    <div className="p-6">
                        <h3 className="text-lg font-bold">Daftar Mutasi</h3>
                        <table className="mt-4 min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50"><tr>{['Tanggal', 'Bank', 'Referensi', 'Keterangan', 'Debit', 'Kredit', 'Status'].map((heading) => <th key={heading} className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">{heading}</th>)}</tr></thead>
                            <tbody className="divide-y divide-gray-200">
                                {statements.length ? statements.map((statement) => <tr key={statement.id}>
                                    <td className="px-3 py-2 text-sm">{statement.transaction_date}</td>
                                    <td className="px-3 py-2 text-sm">{statement.bank_name}</td>
                                    <td className="px-3 py-2 text-sm">{statement.reference_number || '-'}</td>
                                    <td className="px-3 py-2 text-sm">{statement.description || '-'}</td>
                                    <td className="px-3 py-2 text-sm">{money(statement.debit)}</td>
                                    <td className="px-3 py-2 text-sm">{money(statement.credit)}</td>
                                    <td className="px-3 py-2 text-sm font-semibold">{statement.status}</td>
                                </tr>) : <tr><td colSpan="7" className="px-3 py-6 text-center text-sm text-gray-500">Belum ada mutasi rekening.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </AuthenticatedLayout>
    );
}
