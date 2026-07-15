import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useApi } from '@/hooks/useApi';
import { useProjects } from '@/hooks/useProjects';
import { useEffect, useState } from 'react';
import ConfirmModal from '@/Components/ui/ConfirmModal';

const today = () => new Date().toISOString().slice(0, 10).replaceAll('-', '');
const initialForm = () => ({
    project_id: '',
    spk_number: `SPK-${today()}-${String(Date.now()).slice(-4)}`,
    spk_type: 'SUBKON',
    subcon_name: '',
    subtotal: '',
    include_ppn: true,
    payment_terms: '',
    jadwal_kirim: '',
    source_po_id: '',
});
const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function Spk() {
    const { projects } = useProjects();
    const [spks, setSpks] = useState([]);
    const [form, setForm] = useState(initialForm);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [message, setMessage] = useState('');
    const [confirmState, setConfirmState] = useState({ open: false, spk: null });
    const [pos, setPos] = useState([]);
    const api = useApi();

    const load = async () => {
        setLoading(true);
        try {
            const spkData = await api.get('/api/spks', {}, { silent: true });
            const spkList = spkData?.data ?? spkData ?? [];
            setSpks(spkList);
            setForm((current) => ({ ...current, project_id: current.project_id || String(projects[0]?.id || '') }));
        } catch (error) {
            setMessage(error.response?.data?.message || 'Gagal memuat data SPK.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

    const fetchPos = async (projectId) => {
        if (!projectId) { setPos([]); return; }
        try {
            const res = await api.get('/api/pos', { params: { project_id: projectId } }, { silent: true });
            const list = res?.data ?? res ?? [];
            setPos(list.filter((po) => po.po_level === 'PROJECT' && po.status === 'ROUTED' && po.routed_to === 'SPK' && !(po.child_spks || []).length));
        } catch { setPos([]); }
    };

    const handleProjectChange = (projectId) => {
        update('project_id', projectId);
        fetchPos(projectId);
        update('subtotal', '');
    };

    const handlePoSelect = (poId) => {
        update('source_po_id', poId);
        const po = pos.find(p => String(p.id) === String(poId));
        if (po) {
            if (po.subcon_name && !form.subcon_name) update('subcon_name', po.subcon_name || '');
        }
    };

    const createSpk = async (event) => {
        event.preventDefault();
        setSaving(true);
        setMessage('');
        try {
            const response = await api.post('/api/spks', form);
            setMessage(response?.message || 'Draft SPK berhasil dibuat.');
            setShowForm(false);
            setForm({ ...initialForm(), project_id: form.project_id || String(projects[0]?.id || '') });
            await load();
        } catch (error) {
            setMessage(error.response?.data?.message || 'Gagal membuat SPK.');
        } finally {
            setSaving(false);
        }
    };

    const submit = async (spk) => {
        setConfirmState({ open: true, spk });
    };

    const handleConfirmSubmit = async () => {
        const spk = confirmState.spk;
        setConfirmState({ open: false, spk: null });
        try {
            const response = await api.put(`/api/spks/${spk.id}/submit`);
            setMessage(response?.message || 'SPK dikirim untuk approval.');
            await load();
        } catch (error) {
            setMessage(error.response?.data?.message || 'Gagal mengirim SPK.');
        }
    };

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold leading-tight text-gray-800">Kontrak SPK</h2>}>
            <Head title="Kontrak SPK" />

            <div className="py-12">
                <div className="mx-auto max-w-7xl space-y-6 sm:px-6 lg:px-8">
                    {message && <div className="rounded border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{message}</div>}

                    <section className="bg-white p-6 shadow-sm sm:rounded-lg">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-bold">Draft Kontrak Subkon</h3>
                                <p className="mt-1 text-sm text-gray-600">Alur SPK: Draft → Approval → Opname → Invoice → Pembayaran.</p>
                            </div>
                            <button onClick={() => setShowForm((current) => !current)} className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white">{showForm ? 'Tutup Form' : '+ Buat SPK'}</button>
                        </div>

                        {showForm && (
                            <form onSubmit={createSpk} className="mt-6 grid gap-4 border-t pt-6 md:grid-cols-2">
                                <Field label="Proyek">
                                    <select value={form.project_id} onChange={(event) => handleProjectChange(event.target.value)} required className="mt-1 block w-full rounded border-gray-300">
                                        <option value="">Pilih proyek</option>
                                        {projects.map((project) => <option key={project.id} value={project.id}>{project.project_name}</option>)}
                                    </select>
                                </Field>
                                <Field label="Nomor SPK"><input value={form.spk_number} onChange={(event) => update('spk_number', event.target.value)} required className="mt-1 block w-full rounded border-gray-300" /></Field>
                                <Field label="Tipe SPK">
                                    <select value={form.spk_type} onChange={(event) => update('spk_type', event.target.value)} required className="mt-1 block w-full rounded border-gray-300">
                                        <option value="SUBKON">Subkon</option>
                                        <option value="MANDOR">Mandor</option>
                                    </select>
                                </Field>
                                <Field label="Nama Subkon"><input value={form.subcon_name} onChange={(event) => update('subcon_name', event.target.value)} required className="mt-1 block w-full rounded border-gray-300" placeholder="Nama perusahaan / mandor" /></Field>
                                <Field label="PO Proyek sumber">
                                    <select value={form.source_po_id || ''} onChange={(event) => handlePoSelect(event.target.value)} required className="mt-1 block w-full rounded border-gray-300">
                                        <option value="">Pilih PO yang diarahkan Engineer ke SPK</option>
                                        {pos.map((po) => (
                                            <option key={po.id} value={po.id}>{po.po_number} — {money(po.total_amount)}</option>
                                        ))}
                                    </select>
                                    {!pos.length && <span className="mt-1 block text-xs text-amber-700">Belum ada PO Proyek yang diarahkan ke SPK.</span>}
                                </Field>
                                <Field label="Nilai sebelum PPN"><input type="number" min="0" step="0.01" value={form.subtotal} onChange={(event) => update('subtotal', event.target.value)} required className="mt-1 block w-full rounded border-gray-300" placeholder="Otomatis dari PO atau input manual" /></Field>
                                <Field label="Termin Pembayaran"><input value={form.payment_terms} onChange={(event) => update('payment_terms', event.target.value)} className="mt-1 block w-full rounded border-gray-300" placeholder="Contoh: termin berdasarkan opname" /></Field>
                                <Field label="Jadwal Kirim"><input type="date" value={form.jadwal_kirim} onChange={(event) => update('jadwal_kirim', event.target.value)} className="mt-1 block w-full rounded border-gray-300" /></Field>
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <input type="checkbox" checked={form.include_ppn} onChange={(event) => update('include_ppn', event.target.checked)} className="rounded border-gray-300" />
                                    Termasuk PPN (11%)
                                </label>
                                <div className="flex items-end"><button disabled={saving} className="rounded bg-emerald-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan Draft SPK'}</button></div>
                            </form>
                        )}
                    </section>

                    <section className="overflow-hidden bg-white shadow-sm sm:rounded-lg">
                        <div className="p-6">
                            <h3 className="mb-4 text-lg font-bold">Daftar SPK</h3>
                            {loading ? <p>Memuat data...</p> : (
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50"><tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nomor SPK</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipe</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Proyek</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Subkon</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Nilai</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Aksi</th>
                                    </tr></thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {spks.length ? spks.map((spk) => <tr key={spk.id}>
                                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{spk.spk_number}</td>
                                        <td className="px-4 py-3 text-sm text-gray-700">{spk.spk_type === 'SUBKON' ? 'Subkon' : 'Mandor'}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{spk.project?.project_name || '-'}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{spk.subcon_name}</td>
                                            <td className="px-4 py-3 text-right text-sm text-gray-600">{money(spk.total_amount)}</td>
                                            <td className="px-4 py-3"><Status value={spk.status} /></td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {spk.status === 'DRAFT' && <button onClick={() => submit(spk)} className="rounded bg-emerald-600 px-3 py-1 text-sm text-white">Kirim Approval</button>}
                                                    <button onClick={() => window.open(`/spks/${spk.id}/print`, '_blank')} disabled={spk.status !== 'APPROVED'} className={`rounded px-3 py-1 text-sm ${spk.status === 'APPROVED' ? 'bg-gray-100 text-blue-700 hover:bg-gray-200' : 'bg-gray-50 text-gray-400 cursor-not-allowed'}`}>Cetak</button>
                                                </div>
                                            </td>
                                        </tr>) : <tr><td colSpan="6" className="px-4 py-5 text-center text-sm text-gray-500">Belum ada SPK.</td></tr>}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </section>
                </div>
            </div>

            <ConfirmModal
                open={confirmState.open}
                onClose={() => setConfirmState({ open: false, spk: null })}
                onConfirm={handleConfirmSubmit}
                title="Kirim SPK"
                message={confirmState.spk ? `Kirim ${confirmState.spk.spk_number} untuk approval?` : ''}
                confirmText="Kirim"
            />
        </AuthenticatedLayout>
    );
}

function Field({ label, children }) {
    return <label className="block text-sm font-medium text-gray-700">{label}{children}</label>;
}

function Status({ value }) {
    const colors = { DRAFT: 'bg-gray-100 text-gray-700', PENDING_APPROVAL: 'bg-amber-100 text-amber-800', APPROVED: 'bg-emerald-100 text-emerald-800', REJECTED: 'bg-red-100 text-red-800' };
    return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${colors[value] || 'bg-gray-100 text-gray-700'}`}>{value}</span>;
}
