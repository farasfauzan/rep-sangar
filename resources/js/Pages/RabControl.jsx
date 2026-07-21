import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useApi } from '@/hooks/useApi';
import { useProjects } from '@/hooks/useProjects';
import { useEffect, useMemo, useState, Fragment } from 'react';
import ConfirmModal from '@/Components/ui/ConfirmModal';

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export default function RabControl() {
    const { projects } = useProjects();
    const [projectId, setProjectId] = useState('');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [confirmState, setConfirmState] = useState({ open: false, endpoint: '', message: '', payload: null });
    const api = useApi();

    const loadItems = async (id) => {
        if (!id) {
            setItems([]);
            return;
        }

        setLoading(true);
        try {
            const response = await api.get('/api/rab', { project_id: id, per_page: 500 }, { silent: true });
            const payload = response?.data;
            setItems(payload?.data ?? payload ?? []);
            setSelectedIds(new Set());
        } catch (error) {
            setItems([]);
            setMessage(error.response?.data?.message || 'Gagal memuat item RAB.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (projects.length > 0 && !projectId) {
            setProjectId(String(projects[0]?.id || ''));
        }
    }, [projects]);

    useEffect(() => {
        loadItems(projectId);
    }, [projectId]);

    const counts = useMemo(() => items.reduce((result, item) => {
        const status = item.status || 'DRAFT';
        result[status] = (result[status] || 0) + 1;
        return result;
    }, {}), [items]);

    const groupedItems = useMemo(() => {
        const groups = {};
        items.forEach(item => {
            const category = item.category || 'Tanpa Kategori';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(item);
        });
        return Object.entries(groups).map(([category, groupItems]) => ({
            category,
            items: groupItems
        }));
    }, [items]);

    const selectedDraftCount = items.filter((item) => (item.status || 'DRAFT') === 'DRAFT' && selectedIds.has(item.id)).length;
    const selectedPendingCount = items.filter((item) => item.status === 'PENDING' && selectedIds.has(item.id)).length;
    const allItemsSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));

    const toggleItem = (id) => setSelectedIds((current) => {
        const next = new Set(current);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    const toggleAllItems = (checked) => setSelectedIds(checked ? new Set(items.map((item) => item.id)) : new Set());

    const runAction = async (endpoint, confirmation) => {
        if (!projectId) return;
        setConfirmState({ open: true, endpoint, message: confirmation, payload: null });
    };

    const runSelectedAction = (endpoint, status, confirmation) => {
        const itemIds = items
            .filter((item) => (item.status || 'DRAFT') === status && selectedIds.has(item.id))
            .map((item) => item.id);
        if (!itemIds.length) {
            setMessage(`Pilih minimal satu item berstatus ${status} terlebih dahulu.`);
            return;
        }
        setConfirmState({ open: true, endpoint, message: confirmation, payload: { item_ids: itemIds } });
    };

    const handleConfirmAction = async () => {
        const { endpoint, payload } = confirmState;
        setConfirmState({ open: false, endpoint: '', message: '', payload: null });

        setSubmitting(true);
        setMessage('');
        try {
            const response = await api.post(endpoint, payload || { project_id: projectId });
            setMessage(response?.message || 'Status RAB berhasil diperbarui.');
            await loadItems(projectId);
        } catch (error) {
            setMessage(error.response?.data?.message || 'Aksi RAB gagal dilakukan.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold leading-tight text-gray-800">Kontrol RAB</h2>}>
            <Head title="Kontrol RAB" />

            <div className="py-12">
                <div className="mx-auto max-w-7xl space-y-6 sm:px-6 lg:px-8">
                    <section className="bg-white p-6 shadow-sm sm:rounded-lg">
                        <div className="flex flex-wrap items-end justify-between gap-4">
                            <label className="block min-w-64 text-sm font-medium text-gray-700">
                                Proyek
                                <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="mt-1 block w-full rounded border-gray-300">
                                    {projects.map((project) => <option key={project.id} value={project.id}>{project.project_name}</option>)}
                                </select>
                            </label>
                            <div className="flex flex-wrap justify-end gap-2">
                                <button disabled={submitting || !selectedDraftCount} onClick={() => runSelectedAction('/rab/submit-for-approval', 'DRAFT', `Ajukan ${selectedDraftCount} item terpilih untuk approval?`)} className="rounded bg-indigo-500 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">Ajukan Terpilih ({selectedDraftCount})</button>
                                <button disabled={submitting || !counts.DRAFT} onClick={() => runAction('/rab/submit-for-approval', 'Ajukan seluruh item RAB draft untuk approval?')} className="rounded bg-indigo-700 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">Ajukan Semua ({counts.DRAFT || 0})</button>
                                <button disabled={submitting || !selectedPendingCount} onClick={() => runSelectedAction('/rab/approve', 'PENDING', `Setujui ${selectedPendingCount} item terpilih? Setelah disetujui, item terkunci.`)} className="rounded bg-emerald-500 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">Setujui Terpilih ({selectedPendingCount})</button>
                                <button disabled={submitting || !counts.PENDING} onClick={() => runAction('/rab/approve', 'Setujui seluruh RAB yang menunggu approval? Setelah disetujui, item terkunci.')} className="rounded bg-emerald-700 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">Setujui Semua ({counts.PENDING || 0})</button>
                                <button disabled={submitting || !selectedPendingCount} onClick={() => runSelectedAction('/rab/reject', 'PENDING', `Tolak ${selectedPendingCount} item terpilih?`)} className="rounded bg-red-500 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">Tolak Terpilih ({selectedPendingCount})</button>
                                <button disabled={submitting || !counts.PENDING} onClick={() => runAction('/rab/reject', 'Tolak seluruh RAB yang menunggu approval?')} className="rounded bg-red-700 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">Tolak Semua ({counts.PENDING || 0})</button>
                            </div>
                        </div>

                        <p className="mt-4 text-sm text-gray-600">Pilih item satu per satu memakai kolom pertama, lalu gunakan aksi <strong>Terpilih</strong>. Tombol <strong>Semua</strong> tetap tersedia untuk proses massal. RAB harus berstatus <strong>APPROVED</strong> sebelum dapat digunakan untuk membuat PO.</p>
                        {message && <div className="mt-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">{message}</div>}
                    </section>

                    <section className="overflow-hidden bg-white shadow-sm sm:rounded-lg">
                        <div className="p-6">
                            <h3 className="mb-4 text-lg font-bold">Item RAB</h3>
                            {loading ? <p>Memuat data...</p> : (
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500"><input type="checkbox" checked={allItemsSelected} onChange={(event) => toggleAllItems(event.target.checked)} aria-label={allItemsSelected ? 'Lepas semua item' : 'Pilih semua item'} /></th>
                                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Kode</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Uraian</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Nilai</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {groupedItems.length > 0 ? groupedItems.map((group) => (
                                            <Fragment key={group.category}>
                                                <tr className="bg-indigo-50 border-t-2 border-indigo-200">
                                                    <td colSpan={5} className="px-4 py-3 text-sm font-bold text-indigo-900">
                                                        {group.category}
                                                    </td>
                                                </tr>
                                                {group.items.map((item) => (
                                                    <tr key={item.id} className={selectedIds.has(item.id) ? 'bg-blue-50' : ''}>
                                                        <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleItem(item.id)} aria-label={`Pilih ${item.description}`} /></td>
                                                        <td className="px-4 py-3 text-sm text-gray-600">{item.code_item || '-'}</td>
                                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.description}</td>
                                                        <td className="px-4 py-3 text-right text-sm text-gray-600">{money(item.total_price)}</td>
                                                        <td className="px-4 py-3"><Status status={item.status || 'DRAFT'} /></td>
                                                    </tr>
                                                ))}
                                            </Fragment>
                                        )) : <tr><td colSpan="5" className="px-4 py-5 text-center text-sm text-gray-500">Belum ada item RAB pada proyek ini.</td></tr>}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </section>
                </div>
            </div>

            <ConfirmModal
                open={confirmState.open}
                onClose={() => setConfirmState({ open: false, endpoint: '', message: '', payload: null })}
                onConfirm={handleConfirmAction}
                title="Konfirmasi"
                message={confirmState.message}
                confirmText="Ya, Lanjutkan"
                loading={submitting}
            />
        </AuthenticatedLayout>
    );
}

function Status({ status }) {
    const colors = {
        DRAFT: 'bg-gray-100 text-gray-700',
        PENDING: 'bg-amber-100 text-amber-800',
        APPROVED: 'bg-emerald-100 text-emerald-800',
        REJECTED: 'bg-red-100 text-red-800',
    };

    return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${colors[status] || 'bg-gray-100 text-gray-700'}`}>{status}</span>;
}
