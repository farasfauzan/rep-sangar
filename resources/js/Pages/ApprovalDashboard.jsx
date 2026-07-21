import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useProjects } from '@/hooks/useProjects';
import { useToast } from '@/Components/ui/Toast';
import ConfirmModal from '@/Components/ui/ConfirmModal';
import InputPromptModal from '@/Components/ui/InputPromptModal';

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
const docType = (invoice) => invoice.invoiceable_type?.includes('PurchaseOrder') ? 'PO Material' : 'SPK Subkon';
const poCategory = (po) => String(po.items?.[0]?.rab_budget?.category || '').split(' / ')[0];

function ProjectApprovalPicker({ projects, value, onChange }) {
    const [open, setOpen] = useState(false);
    const selectedProject = projects.find((project) => String(project.id) === String(value));
    const selectedCount = Number(selectedProject?.pending_rab_approval_count || 0);

    const choose = (projectId) => {
        onChange(String(projectId || ''));
        setOpen(false);
    };

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                className="flex w-full items-center gap-3 rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm shadow-sm transition hover:border-blue-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span className={`min-w-0 flex-1 truncate ${selectedProject ? 'text-gray-900' : 'text-gray-500'}`}>
                    {selectedProject?.project_name || selectedProject?.name || '-- Pilih proyek --'}
                </span>
                {selectedCount > 0 && (
                    <span className="flex-none rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                        {selectedCount} menunggu
                    </span>
                )}
                <svg className={`h-4 w-4 flex-none text-gray-500 transition ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 9-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <div className="absolute left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 shadow-xl" role="listbox">
                    <button
                        type="button"
                        onClick={() => choose('')}
                        className="flex w-full rounded px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
                    >
                        -- Pilih proyek --
                    </button>
                    {projects.map((project) => {
                        const count = Number(project.pending_rab_approval_count || 0);
                        const selected = String(project.id) === String(value);

                        return (
                            <button
                                key={project.id}
                                type="button"
                                onClick={() => choose(project.id)}
                                className={`flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm ${selected ? 'bg-blue-50 text-blue-900' : 'text-gray-700 hover:bg-gray-50'}`}
                                role="option"
                                aria-selected={selected}
                            >
                                <span className="min-w-0 flex-1 truncate">{project.project_name || project.name}</span>
                                {count > 0 && (
                                    <span className="flex-none rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                    {projects.length === 0 && <p className="px-3 py-2 text-sm text-gray-500">Belum ada proyek.</p>}
                </div>
            )}
        </div>
    );
}

export default function ApprovalDashboard() {
    const roleName = usePage().props.auth?.user?.role?.role_name || '';
    const can = (...roles) => roleName === 'ADMIN' || roles.includes(roleName);
    const [data, setData] = useState({ pos: [], spks: [], opnames: [], invoices: [], funds: [] });
    const [rabPending, setRabPending] = useState([]);
    const [rabProjectId, setRabProjectId] = useState('');
    const [rabSelected, setRabSelected] = useState(new Set());
    const { projects, refresh: refreshProjects } = useProjects();
    const [loading, setLoading] = useState(true);
    const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null });
    const [promptState, setPromptState] = useState({ open: false, defaultValue: '', callback: null });
    const api = useApi();
    const toast = useToast();
    const refreshApprovalIndicators = () => window.dispatchEvent(new Event('workflow-notifications:refresh'));

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [pos, spks, opnames, invoices, funds] = await Promise.all([
                api.get('/api/pos', {}, { silent: true }),
                api.get('/api/spks', {}, { silent: true }),
                api.get('/api/opnames', {}, { silent: true }),
                api.get('/api/invoices', {}, { silent: true }),
                api.get('/api/fund-requests', {}, { silent: true }),
            ]);
            setData({
                pos: pos?.data || pos,
                spks: spks?.data || spks,
                opnames: opnames?.data || opnames,
                invoices: invoices?.data || invoices,
                funds: funds?.data || funds
            });
        } catch (err) {
            toast.error('Gagal memuat data: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const fetchRabPending = async (projectId) => {
        if (!projectId) { setRabPending([]); setRabSelected(new Set()); return; }
        try {
            const res = await api.get('/api/rab', { project_id: projectId, all: 1 }, { silent: true });
            const items = (res.data || []).filter(i => i.status === 'PENDING');
            setRabPending(items);
            setRabSelected(new Set());
        } catch { setRabPending([]); }
    };

    const toggleRabSelect = (id) => {
        setRabSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
    };

    const toggleRabAll = () => {
        if (rabSelected.size === rabPending.length) setRabSelected(new Set());
        else setRabSelected(new Set(rabPending.map(i => i.id)));
    };

    const approveRabSelected = async () => {
        if (rabSelected.size === 0) return toast.error('Pilih item terlebih dahulu.');
        setConfirmState({
            open: true,
            title: 'Setujui RAB',
            message: `Setujui ${rabSelected.size} item RAB terpilih?`,
            onConfirm: async () => {
                setConfirmState({ open: false, title: '', message: '', onConfirm: null });
                try {
                    await api.post('/rab/approve', { item_ids: [...rabSelected] });
                    await Promise.all([fetchRabPending(rabProjectId), refreshProjects()]);
                    refreshApprovalIndicators();
                } catch (err) { /* toast shown by useApi */ }
            }
        });
    };

    const rejectRabSelected = async () => {
        if (rabSelected.size === 0) return toast.error('Pilih item terlebih dahulu.');
        setConfirmState({
            open: true,
            title: 'Tolak RAB',
            message: `Tolak ${rabSelected.size} item RAB terpilih?`,
            onConfirm: async () => {
                setConfirmState({ open: false, title: '', message: '', onConfirm: null });
                try {
                    await api.post('/rab/reject', { item_ids: [...rabSelected] });
                    await Promise.all([fetchRabPending(rabProjectId), refreshProjects()]);
                    refreshApprovalIndicators();
                } catch (err) { /* toast shown by useApi */ }
            }
        });
    };

    const approveRabAll = async () => {
        if (!rabProjectId) return;
        setConfirmState({
            open: true,
            title: 'Setujui Semua RAB',
            message: 'Setujui SEMUA item RAB pending untuk proyek ini?',
            onConfirm: async () => {
                setConfirmState({ open: false, title: '', message: '', onConfirm: null });
                try {
                    await api.post('/rab/approve', { project_id: parseInt(rabProjectId) });
                    await Promise.all([fetchRabPending(rabProjectId), refreshProjects()]);
                    refreshApprovalIndicators();
                } catch (err) { /* toast shown by useApi */ }
            }
        });
    };

    const run = async (method, url, message, payload = {}) => {
        setConfirmState({
            open: true,
            title: 'Konfirmasi',
            message,
            onConfirm: async () => {
                setConfirmState({ open: false, title: '', message: '', onConfirm: null });
                try {
                    await api[method](url, payload);
                    await Promise.all([fetchData(), refreshProjects()]);
                    refreshApprovalIndicators();
                } catch (err) { /* toast shown by useApi */ }
            }
        });
    };

    const reject = async (type, id, endpoint = 'reject') => {
        setPromptState({
            open: true,
            defaultValue: 'Dokumen belum sesuai.',
            callback: async (notes) => {
                setPromptState({ open: false, defaultValue: '', callback: null });
                await run('put', `/api/${type}/${id}/${endpoint}`, 'Tolak dokumen ini?', { notes });
            }
        });
    };

    const projectPosForRouting = data.pos.filter((po) => po.po_level === 'PROJECT' && po.status === 'DRAFT');
    const pendingPos = data.pos.filter((po) => po.po_level === 'SUPPLIER' && po.status === 'PENDING_APPROVAL');
    const pendingSpks = data.spks.filter((spk) => spk.status === 'PENDING_APPROVAL');
    const pendingOpnames = data.opnames.filter((opname) => opname.status === 'PENDING');
    const pendingInvoices = data.invoices.filter((invoice) => ['PENDING_ENGINEER', 'ENGINEER_VERIFIED', 'PENDING_APPROVAL', 'PENDING_CASHFLOW'].includes(invoice.status));
    const pendingFunds = data.funds.filter((fund) => ['PENDING_VERIFICATION', 'PENDING_APPROVAL', 'LPJ_SUBMITTED', 'LPJ_PENDING_APPROVAL'].includes(fund.status));

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold leading-tight text-gray-800">Approval & Verifikasi</h2>}>
            <Head title="Approval Dashboard" />
            <div className="py-12">
                <div className="mx-auto max-w-7xl space-y-6 sm:px-6 lg:px-8">
                    {loading ? <p>Memuat...</p> : (
                        <>
                            {/* RAB Approval Section */}
                            <div className="relative z-20 overflow-visible bg-white shadow-sm sm:rounded-lg">
                                <div className="p-6">
                                    <h3 className="mb-4 text-lg font-bold">Approval RAB Per Item</h3>
                                    <div className="mb-4 flex items-end gap-3">
                                        <div className="w-full max-w-sm">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Proyek</label>
                                            <ProjectApprovalPicker
                                                projects={projects}
                                                value={rabProjectId}
                                                onChange={(projectId) => { setRabProjectId(projectId); fetchRabPending(projectId); }}
                                            />
                                        </div>
                                        {rabPending.length > 0 && can('ENGINEER') && (
                                            <div className="flex gap-2">
                                                <Button onClick={approveRabSelected}>Setujui Terpilih ({rabSelected.size})</Button>
                                                <Button danger onClick={rejectRabSelected}>Tolak Terpilih ({rabSelected.size})</Button>
                                                <Button onClick={approveRabAll}>Setujui Semua ({rabPending.length})</Button>
                                            </div>
                                        )}
                                        {rabPending.length > 0 && !can('ENGINEER') && <span className="text-xs text-gray-500">Menunggu approval teknis Engineer</span>}
                                    </div>
                                    {rabPending.length > 0 ? (
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                                                        <input type="checkbox" checked={rabSelected.size === rabPending.length && rabPending.length > 0} onChange={toggleRabAll} />
                                                    </th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Kode</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Uraian</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Kategori</th>
                                                    <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Volume</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Satuan</th>
                                                    <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Harga Satuan</th>
                                                    <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500">Jumlah</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 bg-white">
                                                {rabPending.map((item) => (
                                                    <tr key={item.id} className={rabSelected.has(item.id) ? 'bg-emerald-50' : ''}>
                                                        <td className="px-3 py-2">
                                                            <input type="checkbox" checked={rabSelected.has(item.id)} onChange={() => toggleRabSelect(item.id)} />
                                                        </td>
                                                        <td className="px-3 py-2 text-sm font-mono">{item.code_item}</td>
                                                        <td className="px-3 py-2 text-sm">{item.description}</td>
                                                        <td className="px-3 py-2 text-sm text-gray-500">{item.category || '-'}</td>
                                                        <td className="px-3 py-2 text-sm text-right">{item.volume}</td>
                                                        <td className="px-3 py-2 text-sm">{item.unit}</td>
                                                        <td className="px-3 py-2 text-sm text-right">{money(item.unit_price)}</td>
                                                        <td className="px-3 py-2 text-sm text-right font-semibold">{money(item.total_price)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <p className="text-sm text-gray-500">{rabProjectId ? 'Tidak ada item RAB pending untuk proyek ini.' : 'Pilih proyek untuk melihat item RAB pending.'}</p>
                                    )}
                                </div>
                            </div>

                            <Section title="Routing PO Proyek oleh Engineer" empty="Tidak ada PO Proyek yang menunggu routing.">
                                {projectPosForRouting.map((po) => (
                                    <tr key={po.id}>
                                        <Td strong>{po.po_number}</Td>
                                        <Td>{po.project?.project_name ?? 'N/A'}</Td>
                                        <Td>PO Proyek · {poCategory(po) || 'Tanpa kategori'}</Td>
                                        <Td>{po.items?.length || 0} item</Td>
                                        <Td>{po.status}</Td>
                                        <Td>
                                            {can('ENGINEER') ? (
                                                poCategory(po) === 'Material'
                                                    ? <Button onClick={() => run('put', `/api/pos/${po.id}/route`, 'Teruskan item Material ini ke PO Supplier?', { routed_to: 'PURCHASE_ORDER' })}>Ke PO Supplier</Button>
                                                    : poCategory(po)
                                                        ? <Button onClick={() => run('put', `/api/pos/${po.id}/route`, `Teruskan item ${poCategory(po)} ini ke SPK?`, { routed_to: 'SPK' })}>Ke SPK</Button>
                                                        : <span className="text-xs text-red-600">Kategori RAB belum tersedia</span>
                                            ) : <span className="text-xs text-gray-500">Menunggu Engineer</span>}
                                        </Td>
                                    </tr>
                                ))}
                            </Section>

                            <Section title="Approval PO Supplier" empty="Tidak ada PO menunggu approval.">
                                {pendingPos.map((po) => (
                                    <tr key={po.id}>
                                        <Td strong>{po.po_number}</Td>
                                        <Td>{po.project?.project_name ?? 'N/A'}</Td>
                                        <Td>{po.supplier_name}</Td>
                                        <Td strong>{money(po.total_amount)}</Td>
                                        <Td>{po.status}</Td>
                                        <Td>
                                            <Button onClick={() => run('put', `/api/pos/${po.id}/approve`, 'Setujui PO ini?')}>Setujui</Button>
                                            <Button danger onClick={() => reject('pos', po.id)}>Tolak</Button>
                                        </Td>
                                    </tr>
                                ))}
                            </Section>

                            <Section title="Approval SPK" empty="Tidak ada SPK menunggu approval.">
                                {pendingSpks.map((spk) => (
                                    <tr key={spk.id}>
                                        <Td strong>{spk.spk_number}</Td>
                                        <Td>{spk.project?.project_name ?? 'N/A'}</Td>
                                        <Td>{spk.subcon_name}</Td>
                                        <Td strong>{money(spk.total_amount)}</Td>
                                        <Td>{spk.status}</Td>
                                        <Td>
                                            <Button onClick={() => run('put', `/api/spks/${spk.id}/approve`, 'Setujui SPK ini?')}>Setujui</Button>
                                            <Button danger onClick={() => reject('spks', spk.id)}>Tolak</Button>
                                        </Td>
                                    </tr>
                                ))}
                            </Section>

                            <Section title="Approval Opname" empty="Tidak ada opname menunggu approval.">
                                {pendingOpnames.map((opname) => (
                                    <tr key={opname.id}>
                                        <Td strong>{opname.opname_number}</Td>
                                        <Td>{opname.spk?.project?.project_name ?? 'N/A'}</Td>
                                        <Td>{opname.spk?.spk_number ?? '-'}</Td>
                                        <Td strong>{money(opname.amount)} ({opname.progress_percentage}%)</Td>
                                        <Td>{opname.status}</Td>
                                        <Td>
                                            <Button onClick={() => run('put', `/api/opnames/${opname.id}/approve`, 'Setujui opname ini?')}>Setujui</Button>
                                            <Button danger onClick={() => reject('opnames', opname.id)}>Tolak</Button>
                                        </Td>
                                    </tr>
                                ))}
                            </Section>

                            <Section title="Verifikasi & Approval Invoice" empty="Tidak ada invoice menunggu proses.">
                                {pendingInvoices.map((invoice) => (
                                    <tr key={invoice.id}>
                                        <Td strong>{invoice.invoice_number}</Td>
                                        <Td>{docType(invoice)}</Td>
                                        <Td>{invoice.invoiceable?.po_number || invoice.invoiceable?.spk_number || '-'}</Td>
                                        <Td strong>{money(invoice.amount)}</Td>
                                        <Td>
                                            <div className="flex flex-col gap-1">
                                                <span className="font-semibold">{invoice.status}</span>
                                                {(!invoice.missing_documents || invoice.missing_documents.length === 0) ? (
                                                    <span className="inline-flex items-center text-[11px] font-bold text-emerald-700">
                                                        ✓ Dokumen Lengkap
                                                    </span>
                                                ) : (
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-[10px] font-bold text-amber-700">⚠️ Kurang ({invoice.missing_documents.length}):</span>
                                                        <div className="flex flex-wrap gap-1">
                                                            {invoice.missing_documents.map((doc) => (
                                                                <span key={doc} className="rounded bg-rose-100 px-1 py-0.5 text-[9px] font-bold text-rose-700">
                                                                    {doc}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </Td>
                                        <Td>
                                            {invoice.status === 'PENDING_ENGINEER' && (
                                                <Button onClick={() => run('put', `/api/invoices/${invoice.id}/engineer-verify`, 'Verifikasi engineer invoice ini?')}>Engineer OK</Button>
                                            )}
                                            {invoice.status === 'ENGINEER_VERIFIED' && (
                                                <Button onClick={() => run('put', `/api/invoices/${invoice.id}/finance-verify`, 'Verifikasi finance invoice ini?')}>Finance OK</Button>
                                            )}
                                            {invoice.status === 'PENDING_APPROVAL' && can('MGR_KOMERSIAL') && (
                                                <Button onClick={() => run('put', `/api/invoices/${invoice.id}/manager-approve`, 'Setujui invoice ini?')}>Setujui</Button>
                                            )}
                                            {invoice.status === 'PENDING_CASHFLOW' && can('VERIFIKATOR_KEU') && (
                                                <>
                                                    <Button onClick={() => run('put', `/api/invoices/${invoice.id}/cashflow-approve`, 'Setujui cashflow invoice ini?', { cashflow_status: 'APPROVED' })}>Setujui Cashflow</Button>
                                                    <Button danger onClick={() => run('put', `/api/invoices/${invoice.id}/cashflow-approve`, 'Tolak cashflow invoice ini?', { cashflow_status: 'REJECTED' })}>Tolak Cashflow</Button>
                                                </>
                                            )}
                                        </Td>
                                    </tr>
                                ))}
                            </Section>

                            <Section title="Approval Dana & Verifikasi LPJ" empty="Tidak ada permohonan dana/LPJ menunggu proses.">
                                {pendingFunds.map((fund) => (
                                    <tr key={fund.id}>
                                        <Td strong>{fund.request_number}</Td>
                                        <Td>{fund.project?.project_name ?? 'N/A'}</Td>
                                        <Td>{fund.description || '-'}</Td>
                                        <Td strong>{money(fund.amount)}</Td>
                                        <Td>{fund.status}</Td>
                                        <Td>
                                            {fund.status === 'PENDING_VERIFICATION' && can('VERIFIKATOR_KEU') && (
                                                <Button onClick={() => run('put', `/api/fund-requests/${fund.id}/verify`, 'Verifikasi permohonan dana ini?')}>Verifikasi</Button>
                                            )}
                                            {fund.status === 'PENDING_APPROVAL' && can('MGR_KOMERSIAL') && (
                                                <>
                                                    <Button onClick={() => run('put', `/api/fund-requests/${fund.id}/approve`, 'Setujui permohonan dana ini?')}>Setujui</Button>
                                                    <Button danger onClick={() => reject('fund-requests', fund.id, 'reject-manager')}>Tolak</Button>
                                                </>
                                            )}
                                            {fund.status === 'LPJ_SUBMITTED' && can('VERIFIKATOR_KEU') && (
                                                <Button onClick={() => run('put', `/api/fund-requests/${fund.id}/lpj-verify`, 'Verifikasi LPJ ini?')}>Verifikasi LPJ</Button>
                                            )}
                                            {fund.status === 'LPJ_PENDING_APPROVAL' && can('MGR_KOMERSIAL') && (
                                                <Button onClick={() => run('put', `/api/fund-requests/${fund.id}/lpj-approve`, 'Setujui LPJ ini?')}>Setujui LPJ</Button>
                                            )}
                                        </Td>
                                    </tr>
                                ))}
                            </Section>
                        </>
                    )}
                </div>
            </div>

            <ConfirmModal
                open={confirmState.open}
                onClose={() => setConfirmState({ open: false, title: '', message: '', onConfirm: null })}
                onConfirm={confirmState.onConfirm}
                title={confirmState.title}
                message={confirmState.message}
                confirmText="Ya"
            />

            <InputPromptModal
                open={promptState.open}
                onClose={() => setPromptState({ open: false, defaultValue: '', callback: null })}
                onSubmit={promptState.callback}
                title="Catatan Penolakan"
                message="Masukkan alasan penolakan dokumen."
                defaultValue={promptState.defaultValue}
                inputLabel="Catatan"
                submitText="Tolak"
            />
        </AuthenticatedLayout>
    );
}

function Section({ title, empty, children }) {
    const rows = Array.isArray(children) ? children.filter(Boolean) : [children].filter(Boolean);

    return (
        <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg">
            <div className="p-6">
                <h3 className="mb-4 text-lg font-bold">{title}</h3>
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Nomor</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Proyek/Tipe</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Pihak/Referensi</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Nilai</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                        {rows.length ? rows : <tr><td colSpan="6" className="px-4 py-4 text-center text-sm text-gray-500">{empty}</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function Td({ children, strong = false }) {
    return <td className={`px-4 py-3 text-sm ${strong ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{children}</td>;
}

function Button({ children, onClick, danger = false }) {
    return (
        <button onClick={onClick} className={`mr-2 rounded px-3 py-1 text-sm text-white shadow ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            {children}
        </button>
    );
}
