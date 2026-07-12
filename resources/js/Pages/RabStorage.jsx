import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { useState, useMemo } from 'react';

const fmt = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n ?? 0);
const fmtDate = (d) => d ? new Date(d).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const P = {
    parchment: '#f5e6cc',
    parchmentD: '#e8d4b0',
    parchmentDD: '#d4bc8e',
    gold: '#c4942a',
    goldLight: '#dbb45c',
    goldDark: '#8b6914',
    goldBg: '#faf3e2',
    sienna: '#a0522d',
    siennaDeep: '#7a3b1e',
    burgundy: '#8b2e1e',
    burgundyDeep: '#6b1a10',
    umber: '#4a2008',
    umberLight: '#6b3a1a',
    cream: '#fef9f0',
    creamWarm: '#fdf5e6',
    olive: '#6b7a3a',
    oliveDark: '#4a5528',
    shadow: 'rgba(74,32,8,0.15)',
    shadowDeep: 'rgba(74,32,8,0.30)',
    text: '#3a1f0a',
    textMuted: '#8b7355',
    textLight: '#a89272',
    border: '#c4a878',
    borderLight: '#dcc8a4',
    borderDark: '#a08050',
};

const cardStyle = {
    background: `linear-gradient(145deg, ${P.cream} 0%, ${P.creamWarm} 30%, ${P.parchment} 100%)`,
    border: `2px solid ${P.border}`,
    borderRadius: '4px',
    boxShadow: `0 6px 30px ${P.shadowDeep}, 0 2px 8px ${P.shadow}, inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(160,82,45,0.08)`,
    position: 'relative',
};

const sectionTitle = {
    fontSize: '0.68rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    color: P.textMuted,
};

const inputBase = {
    border: `1.5px solid ${P.border}`,
    borderRadius: '3px',
    padding: '0.5rem 0.75rem',
    fontSize: '0.85rem',
    color: P.text,
    background: `linear-gradient(180deg, ${P.cream} 0%, ${P.creamWarm} 100%)`,
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxShadow: `inset 0 1px 3px rgba(74,32,8,0.08)`,
};

const btnSecondary = {
    padding: '0.5rem 1rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: P.sienna,
    background: `linear-gradient(180deg, ${P.cream} 0%, ${P.parchment} 100%)`,
    border: `1.5px solid ${P.border}`,
    borderRadius: '3px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: `0 1px 4px ${P.shadow}`,
};

const btnPrimary = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.55rem 1.25rem',
    background: `linear-gradient(180deg, ${P.burgundy} 0%, ${P.burgundyDeep} 100%)`,
    color: '#fef0d8',
    fontSize: '0.85rem',
    fontWeight: 600,
    borderRadius: '3px',
    border: `1px solid ${P.burgundyDeep}`,
    cursor: 'pointer',
    boxShadow: `0 3px 12px rgba(107,26,16,0.4), inset 0 1px 0 rgba(255,255,255,0.12)`,
    transition: 'all 0.2s',
    letterSpacing: '0.03em',
    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
};

const FrameCorner = ({ position }) => {
    const base = { position: 'absolute', width: '36px', height: '36px', opacity: 0.3, pointerEvents: 'none' };
    const transforms = {
        tl: {}, tr: { transform: 'scaleX(-1)' }, bl: { transform: 'scaleY(-1)' }, br: { transform: 'scale(-1,-1)' },
    };
    const positions = {
        tl: { top: 4, left: 4 }, tr: { top: 4, right: 4 }, bl: { bottom: 4, left: 4 }, br: { bottom: 4, right: 4 },
    };
    return (
        <svg style={{ ...base, ...positions[position], ...transforms[position] }} viewBox="0 0 32 32">
            <path d="M2 2 L2 28" stroke={P.gold} strokeWidth="1.5" fill="none" />
            <path d="M2 2 L28 2" stroke={P.gold} strokeWidth="1.5" fill="none" />
            <circle cx="4" cy="4" r="2" fill={P.gold} opacity="0.4" />
        </svg>
    );
};

const CartoucheFrame = () => (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <FrameCorner position="tl" />
        <FrameCorner position="tr" />
        <FrameCorner position="bl" />
        <FrameCorner position="br" />
        <div style={{ position: 'absolute', inset: '8px', border: `1px solid ${P.gold}18`, borderRadius: '2px' }} />
    </div>
);

const statusBadge = (status) => {
    const styles = {
        PENDING: { bg: '#f5e6cc', color: P.umber, border: P.border },
        PROCESSING: { bg: '#fdf5d6', color: P.goldDark, border: P.goldLight },
        VALIDATED: { bg: '#eaf4e6', color: P.oliveDark, border: '#b8d0a8' },
        IMPORTING: { bg: '#f0e6d6', color: P.sienna, border: P.parchmentDD },
        COMPLETED: { bg: '#e6f0e6', color: P.oliveDark, border: '#a8c49a' },
        FAILED: { bg: '#f8e8e4', color: P.burgundyDeep, border: '#d8b0a4' },
    };
    const s = styles[status] || styles.PENDING;
    return (
        <span style={{
            display: 'inline-block', padding: '0.2rem 0.55rem', borderRadius: '2px', fontSize: '0.68rem', fontWeight: 700,
            background: s.bg, color: s.color, border: `1px solid ${s.border}`,
        }}>
            {status}
        </span>
    );
};

export default function RabStorage({ projects, selectedProject, importJobs, budgets, totals, storage }) {
    const [projectId, setProjectId] = useState(selectedProject?.id || (projects[0]?.id ?? ''));
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('files');

    const handleProjectChange = (e) => {
        const id = e.target.value;
        setProjectId(id);
        router.get('/rab-storage', { project_id: id }, { preserveState: true, preserveScroll: true });
    };

    const filteredBudgets = useMemo(() => {
        if (!budgets) return [];
        const rows = budgets.data || [];
        if (!searchTerm) return rows;
        const term = searchTerm.toLowerCase();
        return rows.filter((item) =>
            (item.description || '').toLowerCase().includes(term) ||
            (item.code_item || '').toLowerCase().includes(term)
        );
    }, [budgets, searchTerm]);

    return (
        <AuthenticatedLayout
            header={
                <div style={{ textAlign: 'center', position: 'relative' }}>
                    <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: P.umber, fontFamily: 'Georgia, "Palatino Linotype", "Times New Roman", serif', letterSpacing: '0.06em', textShadow: `0 1px 0 ${P.parchmentD}`, marginBottom: '6px' }}>
                        Penyimpanan RAB
                    </h1>
                    <p style={{ fontSize: '0.75rem', color: P.textMuted, fontStyle: 'italic' }}>File import & data tabel rab_budgets</p>
                </div>
            }
        >
            <Head title="Penyimpanan RAB" />

            <div style={{
                minHeight: 'calc(100vh - 120px)',
                background: `radial-gradient(ellipse at 30% 20%, rgba(219,180,92,0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(139,46,30,0.05) 0%, transparent 50%), linear-gradient(180deg, ${P.parchment} 0%, #efe0c8 40%, ${P.parchmentD} 100%)`,
                paddingBottom: '56px',
            }}>
                <div style={{ maxWidth: '74rem', margin: '0 auto', padding: '1.5rem 1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Storage info banner */}
                    <div style={{
                        padding: '0.6rem 1rem',
                        background: `linear-gradient(135deg, ${P.goldBg} 0%, ${P.creamWarm} 100%)`,
                        border: `1px solid ${P.gold}40`,
                        borderRadius: '3px',
                        fontSize: '0.72rem',
                        color: P.textMuted,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                    }}>
                        <span style={{ fontWeight: 700, color: P.siennaDeep }}>💾 Penyimpanan:</span>
                        <span>{storage.description}</span>
                        <span style={{ color: P.border }}>•</span>
                        <span>Data tersimpan di tabel <code style={{ background: P.parchment, padding: '1px 5px', borderRadius: '2px', fontFamily: 'monospace', fontSize: '0.68rem', color: P.umber }}>rab_budgets</code></span>
                    </div>

                    {/* Project selector */}
                    <div style={{ ...cardStyle, padding: '1rem 1.25rem', overflow: 'hidden' }}>
                        <CartoucheFrame />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                            <label style={sectionTitle}>Proyek</label>
                            <select value={projectId} onChange={handleProjectChange} style={{ ...inputBase, minWidth: '240px', cursor: 'pointer' }}>
                                <option value="">Pilih proyek...</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.project_name || `Project #${p.id}`}</option>
                                ))}
                            </select>
                            {selectedProject && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: P.textMuted }}>
                                    <span>📍 {selectedProject.location || '—'}</span>
                                    <span>•</span>
                                    <span style={{ textTransform: 'capitalize' }}>{selectedProject.status}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Totals */}
                    {totals && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                            <div style={{ ...cardStyle, padding: '1.1rem 1.25rem', overflow: 'hidden' }}>
                                <CartoucheFrame />
                                <p style={{ ...sectionTitle, marginBottom: '0.25rem' }}>Total Item</p>
                                <p style={{ fontSize: '1.2rem', fontWeight: 800, color: P.umber, fontFamily: 'Georgia, serif' }}>{totals.total_items}</p>
                            </div>
                            <div style={{ ...cardStyle, padding: '1.1rem 1.25rem', overflow: 'hidden' }}>
                                <CartoucheFrame />
                                <p style={{ ...sectionTitle, marginBottom: '0.25rem' }}>Total Anggaran</p>
                                <p style={{ fontSize: '1.2rem', fontWeight: 800, color: P.umber, fontFamily: 'Georgia, serif' }}>{fmt(totals.total_budget)}</p>
                            </div>
                            <div style={{ ...cardStyle, padding: '1.1rem 1.25rem', overflow: 'hidden' }}>
                                <CartoucheFrame />
                                <p style={{ ...sectionTitle, marginBottom: '0.25rem' }}>Versi RAB</p>
                                <p style={{ fontSize: '1.2rem', fontWeight: 800, color: P.umber, fontFamily: 'Georgia, serif' }}>
                                    {totals.versions.length > 0 ? totals.versions.join(', ') : '—'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: '0.5rem', borderBottom: `2px solid ${P.border}`, paddingBottom: '0.25rem' }}>
                        {[
                            { id: 'files', label: 'File Import', icon: '📁' },
                            { id: 'data', label: 'Data RAB', icon: '📋' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    padding: '0.6rem 1.1rem',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    borderRadius: '3px 3px 0 0',
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: activeTab === tab.id ? `linear-gradient(180deg, ${P.umber} 0%, ${P.umberLight} 100%)` : 'transparent',
                                    color: activeTab === tab.id ? '#fef0d8' : P.textMuted,
                                }}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* File import list */}
                    {activeTab === 'files' && (
                        <div style={{ ...cardStyle, overflow: 'hidden' }}>
                            <CartoucheFrame />
                            <div style={{
                                padding: '0.85rem 1.5rem',
                                background: `linear-gradient(135deg, ${P.umber} 0%, ${P.umberLight} 50%, ${P.siennaDeep} 100%)`,
                                borderBottom: `2px solid ${P.goldDark}`,
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem',
                            }}>
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fef0d8', fontFamily: 'Georgia, serif' }}>📁 File Import RAB</h3>
                                <span style={{ fontSize: '0.7rem', color: P.parchmentDD }}>{importJobs.total} file</span>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                {importJobs.data.length === 0 ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: P.textMuted, fontStyle: 'italic' }}>Belum ada file import.</div>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                        <thead>
                                            <tr style={{ background: `linear-gradient(180deg, ${P.parchmentD}, ${P.parchmentDD})` }}>
                                                {['Nama File', 'Proyek', 'Status', 'Baris', 'Tanggal', 'Aksi'].map(h => (
                                                    <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', ...sectionTitle, borderBottom: `2.5px solid ${P.borderDark}` }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {importJobs.data.map((job, i) => (
                                                <tr key={job.id} style={{ background: i % 2 === 0 ? P.cream : P.parchment, borderBottom: `1px solid ${P.borderLight}` }}>
                                                    <td style={{ padding: '0.5rem 0.75rem', color: P.text, fontWeight: 600 }}>
                                                        <div>{job.file_name}</div>
                                                        <div style={{ fontSize: '0.65rem', color: P.textMuted, textTransform: 'uppercase' }}>{job.file_type}</div>
                                                    </td>
                                                    <td style={{ padding: '0.5rem 0.75rem', color: P.textMuted }}>{job.project_name}</td>
                                                    <td style={{ padding: '0.5rem 0.75rem' }}>{statusBadge(job.status)}</td>
                                                    <td style={{ padding: '0.5rem 0.75rem', color: P.textMuted, fontFamily: 'monospace' }}>
                                                        {job.processed_rows || 0} / {job.total_rows || 0}
                                                    </td>
                                                    <td style={{ padding: '0.5rem 0.75rem', color: P.textMuted, fontSize: '0.72rem' }}>{fmtDate(job.created_at)}</td>
                                                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                                        {job.download_url ? (
                                                            <a href={job.download_url} style={btnSecondary}>Unduh</a>
                                                        ) : (
                                                            <span style={{ fontSize: '0.7rem', color: P.textLight, fontStyle: 'italic' }}>File tidak tersedia</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            {importJobs.data.length > 0 && importJobs.links && importJobs.links.length > 3 && (
                                <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                                    {importJobs.links.map((link, idx) => {
                                        if (link.label === '...') return <span key={idx} style={{ padding: '0.35rem 0.6rem', color: P.textMuted }}>...</span>;
                                        return link.url ? (
                                            <a
                                                key={idx}
                                                href={link.url}
                                                style={{
                                                    padding: '0.35rem 0.6rem',
                                                    borderRadius: '3px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    textDecoration: 'none',
                                                    background: link.active ? P.gold : P.cream,
                                                    color: link.active ? '#fef0d8' : P.text,
                                                    border: `1px solid ${P.border}`,
                                                }}
                                            >
                                                {link.label.replace('&laquo;', '«').replace('&raquo;', '»')}
                                            </a>
                                        ) : (
                                            <span key={idx} style={{ padding: '0.35rem 0.6rem', borderRadius: '3px', fontSize: '0.75rem', color: P.textLight, border: `1px solid ${P.borderLight}`, background: P.cream }}>
                                                {link.label.replace('&laquo;', '«').replace('&raquo;', '»')}
                                            </span>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* RAB data list */}
                    {activeTab === 'data' && (
                        <div style={{ ...cardStyle, overflow: 'hidden' }}>
                            <CartoucheFrame />
                            <div style={{
                                padding: '0.85rem 1.5rem',
                                background: `linear-gradient(135deg, ${P.umber} 0%, ${P.umberLight} 50%, ${P.siennaDeep} 100%)`,
                                borderBottom: `2px solid ${P.goldDark}`,
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem',
                            }}>
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fef0d8', fontFamily: 'Georgia, serif' }}>📋 Data RAB</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <svg style={{ width: '14px', height: '14px', color: P.parchmentDD }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    <input
                                        type="text"
                                        placeholder="Cari item..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ ...inputBase, paddingLeft: '2rem', width: '200px' }}
                                    />
                                </div>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                {!budgets || budgets.data.length === 0 ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: P.textMuted, fontStyle: 'italic' }}>
                                        Belum ada data RAB untuk proyek ini.
                                    </div>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                        <thead>
                                            <tr style={{ background: `linear-gradient(180deg, ${P.parchmentD}, ${P.parchmentDD})` }}>
                                                {['#', 'Kode', 'Uraian', 'Volume', 'Satuan', 'Harga Satuan', 'Total', 'Kategori', 'AI'].map(h => (
                                                    <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: h === 'Volume' || h === 'Satuan' || h === 'Kategori' || h === 'AI' ? 'center' : 'left', ...sectionTitle, borderBottom: `2.5px solid ${P.borderDark}` }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredBudgets.map((item, i) => (
                                                <tr key={item.id} style={{ background: i % 2 === 0 ? P.cream : P.parchment, borderBottom: `1px solid ${P.borderLight}` }}>
                                                    <td style={{ padding: '0.5rem 0.75rem', color: P.textMuted, fontSize: '0.72rem' }}>{i + 1}</td>
                                                    <td style={{ padding: '0.5rem 0.75rem', color: P.textMuted, fontFamily: 'monospace', fontSize: '0.72rem' }}>{item.code_item || '—'}</td>
                                                    <td style={{ padding: '0.5rem 0.75rem', color: P.text, fontWeight: 600 }}>{item.description}</td>
                                                    <td style={{ padding: '0.5rem 0.75rem', color: P.text, textAlign: 'center' }}>{item.volume || '—'}</td>
                                                    <td style={{ padding: '0.5rem 0.75rem', color: P.text, textAlign: 'center' }}>{item.unit || '—'}</td>
                                                    <td style={{ padding: '0.5rem 0.75rem', color: P.text, textAlign: 'right', fontFamily: 'monospace' }}>{fmt(item.unit_price)}</td>
                                                    <td style={{ padding: '0.5rem 0.75rem', color: P.umber, textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{fmt(item.total_price)}</td>
                                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                                        {item.category ? (
                                                            <span style={{ display: 'inline-block', padding: '0.12rem 0.55rem', borderRadius: '2px', fontSize: '0.65rem', fontWeight: 600, background: P.goldBg, color: P.siennaDeep, border: `1px solid ${P.gold}40` }}>{item.category}</span>
                                                        ) : <span style={{ color: P.border }}>—</span>}
                                                    </td>
                                                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                                        {item.ai_category ? (
                                                            <span style={{ display: 'inline-block', padding: '0.12rem 0.55rem', borderRadius: '2px', fontSize: '0.65rem', fontWeight: 600, background: '#eaf4e6', color: P.oliveDark, border: `1px solid #b8d0a8` }}>{item.ai_category}</span>
                                                        ) : <span style={{ color: P.border }}>—</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            {budgets && budgets.data.length > 0 && budgets.links && budgets.links.length > 3 && (
                                <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                                    {budgets.links.map((link, idx) => {
                                        if (link.label === '...') return <span key={idx} style={{ padding: '0.35rem 0.6rem', color: P.textMuted }}>...</span>;
                                        return link.url ? (
                                            <a
                                                key={idx}
                                                href={link.url}
                                                style={{
                                                    padding: '0.35rem 0.6rem',
                                                    borderRadius: '3px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    textDecoration: 'none',
                                                    background: link.active ? P.gold : P.cream,
                                                    color: link.active ? '#fef0d8' : P.text,
                                                    border: `1px solid ${P.border}`,
                                                }}
                                            >
                                                {link.label.replace('&laquo;', '«').replace('&raquo;', '»')}
                                            </a>
                                        ) : (
                                            <span key={idx} style={{ padding: '0.35rem 0.6rem', borderRadius: '3px', fontSize: '0.75rem', color: P.textLight, border: `1px solid ${P.borderLight}`, background: P.cream }}>
                                                {link.label.replace('&laquo;', '«').replace('&raquo;', '»')}
                                            </span>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>
        </AuthenticatedLayout>
    );
}
