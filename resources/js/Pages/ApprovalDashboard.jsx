import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';

const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
const docType = (invoice) => invoice.invoiceable_type?.includes('PurchaseOrder') ? 'PO Material' : 'SPK Subkon';

export default function ApprovalDashboard() {
    const [data, setData] = useState({ pos: [], spks: [], opnames: [], invoices: [], funds: [] });
    const [rabPending, setRabPending] = useState([]);
    const [rabProjectId, setRabProjectId] = useState('');
    const [rabSelected, setRabSelected] = useState(new Set());
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
        axios.get('/api/projects').then(res => setProjects(res.data.data || res.data || [])).catch(() => { });
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [pos, spks, opnames, invoices, funds] = await Promise.all([
                axios.get('/api/pos'),
                axios.get('/api/spks'),
                axios.get('/api/opnames'),
                axios.get('/api/invoices'),
                axios.get('/api/fund-requests'),
            ]);
            setData({ pos: pos.data, spks: spks.data, opnames: opnames.data, invoices: invoices.data, funds: funds.data });
        } catch (err) {
            alert('Gagal memuat data: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const fetchRabPending = async (projectId) => {
        if (!projectId) { setRabPending([]); setRabSelected(new Set()); return; }
        try {
            const res = await axios.get('/api/rab', { params: { project_id: projectId, all: 1 } });
            const items = (res.data.data || []).filter(i => i.status === 'PENDING');
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
        if (rabSelected.size === 0) return alert('Pilih item terlebih dahulu.');
        if (!confirm(`Setujui ${rabSelected.size} item RAB terpilih?`)) return;
        try {
            await axios.post('/api/rab/approve', { item_ids: [...rabSelected] });
            fetchRabPending(rabProjectId);
        } catch (err) { alert(err.response?.data?.message || 'Gagal approve.'); }
    };

    const rejectRabSelected = async () => {
        if (rabSelected.size === 0) return alert('Pilih item terlebih dahulu.');
        if (!confirm(`Tolak ${rabSelected.size} item RAB terpilih?`)) return;
        try {
            await axios.post('/api/rab/reject', { item_ids: [...rabSelected] });
            fetchRabPending(rabProjectId);
        } catch (err) { alert(err.response?.data?.message || 'Gagal reject.'); }
    };

    const approveRabAll = async () => {
        if (!rabProjectId) return;
        if (!confirm('Setujui SEMUA item RAB pending untuk proyek ini?')) return;
        try {
            await axios.post('/api/rab/approve', { project_id: parseInt(rabProjectId) });
            fetchRabPending(rabProjectId);
        } catch (err) { alert(err.response?.data?.message || 'Gagal approve.'); }
    };

    const run = async (method, url, message, payload = {}) => {
        if (!confirm(message)) return;
        try {
            await axios[method](url, payload);
            await fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Aksi gagal.');
        }
    };

    const reject = async (type, id) => {
        const notes = prompt('Catatan penolakan:', 'Dokumen belum sesuai.');
        if (notes === null) return;
        await run('put', `/api/${type}/${id}/reject`, 'Tolak dokumen ini?', { notes });
    };

    const pendingPos = data.pos.filter((po) => po.status === 'PENDING_APPROVAL');
    const pendingSpks = data.spks.filter((spk) => spk.status === 'PENDING_APPROVAL');
    const pendingOpnames = data.opnames.filter((opname) => opname.status === 'PENDING');
    const pendingInvoices = data.invoices.filter((invoice) => ['PENDING_ENGINEER', 'ENGINEER_VERIFIED', 'PENDING_APPROVAL'].includes(invoice.status));
    const pendingFunds = data.funds.filter((fund) => ['PENDING_APPROVAL', 'LPJ_SUBMITTED'].includes(fund.status));

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold leading-tight text-gray-800">Approval & Verifikasi</h2>}>
            <Head title="Approval Dashboard" />
            <div className="py-12">
                <div className="mx-auto max-w-7xl space-y-6 sm:px-6 lg:px-8">
                    {loading ? <p>Memuat...</p> : (
                        <>
                            {/* RAB Approval Section */}
                            <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg">
                                <div className="p-6">
                                    <h3 className="mb-4 text-lg font-bold">Approval RAB Per Item</h3>
                                    <div className="mb-4 flex items-end gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Proyek</label>
                                            <select
                                                value={rabProjectId}
                                                onChange={(e) => { setRabProjectId(e.target.value); fetchRabPending(e.target.value); }}
                                                className="rounded border-gray-300 text-sm"
                                            >
                                                <option value="">-- Pilih --</option>
                                                {projects.map(p => <option key={p.id} value={p.id}>{p.project_name || p.name}</option>)}
                                            </select>
                                        </div>
                                        {rabPending.length > 0 && (
                                            <div className="flex gap-2">
                                                <Button onClick={approveRabSelected}>Setujui Terpilih ({rabSelected.size})</Button>
                                                <Button danger onClick={rejectRabSelected}>Tolak Terpilih ({rabSelected.size})</Button>
                                                <Button onClick={approveRabAll}>Setujui Semua ({rabPending.length})</Button>
                                            </div>
                                        )}
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

                            <Section title="Approval PO" empty="Tidak ada PO menunggu approval.">
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
                                        <Td>{invoice.status}</Td>
                                        <Td>
                                            {invoice.status === 'PENDING_ENGINEER' && (
                                                <Button onClick={() => run('put', `/api/invoices/${invoice.id}/engineer-verify`, 'Verifikasi engineer invoice ini?')}>Engineer OK</Button>
                                            )}
                                            {invoice.status === 'ENGINEER_VERIFIED' && (
                                                <Button onClick={() => run('put', `/api/invoices/${invoice.id}/finance-verify`, 'Verifikasi finance invoice ini?')}>Finance OK</Button>
                                            )}
                                            {invoice.status === 'PENDING_APPROVAL' && (
                                                <Button onClick={() => run('put', `/api/invoices/${invoice.id}/manager-approve`, 'Setujui invoice ini?')}>Setujui</Button>
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
                                            {fund.status === 'PENDING_APPROVAL' && (
                                                <>
                                                    <Button onClick={() => run('put', `/api/fund-requests/${fund.id}/approve`, 'Setujui permohonan dana ini?')}>Setujui</Button>
                                                    <Button danger onClick={() => reject('fund-requests', fund.id)}>Tolak</Button>
                                                </>
                                            )}
                                            {fund.status === 'LPJ_SUBMITTED' && (
                                                <Button onClick={() => run('put', `/api/fund-requests/${fund.id}/lpj-verify`, 'Verifikasi LPJ ini?')}>Verifikasi LPJ</Button>
                                            )}
                                        </Td>
                                    </tr>
                                ))}
                            </Section>
                        </>
                    )}
                </div>
            </div>
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
