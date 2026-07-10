import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState, useEffect, Component } from 'react';
import axios from 'axios';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '2rem', maxWidth: '32rem', margin: '2.5rem auto', background: '#fdf6ee', border: '2px solid #b8860b', borderRadius: '8px', color: '#5a1a0a' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Terjadi Kesalahan</h2>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem' }}>{this.state.error?.toString()}</p>
                    <pre style={{ fontSize: '0.7rem', overflow: 'auto', maxHeight: '16rem', background: '#f5e6d0', padding: '0.75rem', borderRadius: '4px', fontFamily: 'monospace' }}>{this.state.error?.stack}</pre>
                </div>
            );
        }
        return this.props.children;
    }
}

const fmt = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n ?? 0);

/* ── classical baroque palette ── */
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

/* ── ornamental divider ── */
const OrnamentDivider = ({ width = 180 }) => (
    <svg width={width} height="16" viewBox={`0 0 ${width} 16`} style={{ display: 'block', margin: '0 auto' }}>
        <line x1="0" y1="8" x2={width * 0.35} y2="8" stroke={P.gold} strokeWidth="0.5" opacity="0.4" />
        <line x1={width * 0.65} y1="8" x2={width} y2="8" stroke={P.gold} strokeWidth="0.5" opacity="0.4" />
        <polygon points={`${width / 2},2 ${width / 2 + 6},8 ${width / 2},14 ${width / 2 - 6},8`} fill="none" stroke={P.gold} strokeWidth="1" opacity="0.5" />
        <polygon points={`${width / 2},4 ${width / 2 + 3},8 ${width / 2},12 ${width / 2 - 3},8`} fill={P.gold} opacity="0.3" />
        <circle cx={width * 0.32} cy="8" r="1.5" fill={P.goldLight} opacity="0.4" />
        <circle cx={width * 0.68} cy="8" r="1.5" fill={P.goldLight} opacity="0.4" />
    </svg>
);

/* ── classical frame corner ── */
const FrameCorner = ({ position }) => {
    const base = { position: 'absolute', width: '36px', height: '36px', opacity: 0.3, pointerEvents: 'none' };
    const transforms = { tl: {}, tr: { transform: 'scaleX(-1)' }, bl: { transform: 'scaleY(-1)' }, br: { transform: 'scale(-1,-1)' } };
    const positions = { tl: { top: 4, left: 4 }, tr: { top: 4, right: 4 }, bl: { bottom: 4, left: 4 }, br: { bottom: 4, right: 4 } };
    return (
        <svg style={{ ...base, ...positions[position], ...transforms[position] }} viewBox="0 0 32 32">
            <path d="M2 2 L2 28" stroke={P.gold} strokeWidth="1.5" fill="none" />
            <path d="M2 2 L28 2" stroke={P.gold} strokeWidth="1.5" fill="none" />
            <path d="M2 2 C2 10 6 16 12 22" stroke={P.goldLight} strokeWidth="0.6" fill="none" opacity="0.5" />
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

const ParchmentTexture = () => (
    <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(160,82,45,0.012) 3px, rgba(160,82,45,0.012) 6px), repeating-linear-gradient(90deg, transparent, transparent 5px, rgba(160,82,45,0.008) 5px, rgba(160,82,45,0.008) 10px)`,
        borderRadius: 'inherit',
    }} />
);

const Vignette = () => (
    <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        boxShadow: `inset 0 0 60px ${P.shadowDeep}, inset 0 0 120px rgba(74,32,8,0.06)`,
        borderRadius: 'inherit',
    }} />
);

export default function Dashboard({ auth }) {
    const [file, setFile] = useState(null);
    const [projectId, setProjectId] = useState(1);
    const [message, setMessage] = useState('');
    const [step, setStep] = useState(1);
    const [rabData, setRabData] = useState([]);
    const [loadingRab, setLoadingRab] = useState(false);
    const [summary, setSummary] = useState(null);
    const [categoryFilter, setCategoryFilter] = useState('');
    const [categories, setCategories] = useState([]);
    const [projects, setProjects] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('import');

    const [importJob, setImportJob] = useState(null);
    const [importStatus, setImportStatus] = useState('');
    const [importErrors, setImportErrors] = useState([]);
    const [importDiff, setImportDiff] = useState(null);

    const [showAddProjectModal, setShowAddProjectModal] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectLocation, setNewProjectLocation] = useState('');
    const [newProjectStartDate, setNewProjectStartDate] = useState('');
    const [addingProject, setAddingProject] = useState(false);

    const tabs = [
        { id: 'import', label: 'Import', icon: '📥' },
        { id: 'rab', label: 'Data RAB', icon: '📋' },
        { id: 'summary', label: 'Ringkasan', icon: '📊' },
    ];

    const fetchRabData = async (pid) => {
        if (!pid) return;
        setLoadingRab(true);
        try {
            const params = { project_id: pid, per_page: -1 };
            const response = await axios.get('/api/rab', { params });
            const result = response.data?.data;
            const rows = Array.isArray(result) ? result : (result?.data ?? result ?? []);
            setRabData(Array.isArray(rows) ? rows : []);
        } catch (error) {
            console.error('Failed to fetch RAB data', error);
            setRabData([]);
        } finally {
            setLoadingRab(false);
        }
    };

    const fetchSummary = async (pid) => {
        if (!pid) return;
        try {
            const response = await axios.get('/api/rab/summary', { params: { project_id: pid } });
            setSummary(response.data.data);
            const byCategory = response.data.data?.by_category ?? [];
            const cats = Array.isArray(byCategory) ? byCategory.map(c => c.category_name) : [];
            setCategories(cats);
        } catch { setSummary(null); }
    };

    useEffect(() => {
        axios.get('/api/projects').then(res => {
            const list = res.data?.data ?? res.data ?? [];
            setProjects(Array.isArray(list) ? list : []);
        }).catch(() => { });
    }, []);

    useEffect(() => {
        fetchRabData(projectId);
        fetchSummary(projectId);
    }, [projectId]);

    const startPolling = (jobId) => {
        const interval = setInterval(async () => {
            try {
                const response = await axios.get(`/rab/import-job/${jobId}`);
                const job = response.data.data;
                setImportJob(job);
                setImportStatus(job.status);
                setImportErrors(job.errors || []);
                setImportDiff(job.diff);

                if (job.status === 'VALIDATED' || job.status === 'FAILED' || job.status === 'COMPLETED') {
                    clearInterval(interval);
                }

                if (job.status === 'COMPLETED') {
                    setMessage('Import data RAB berhasil diselesaikan! Stok inventory telah diperbarui.');
                    setFile(null);
                    setStep(1);
                    fetchRabData(projectId);
                    fetchSummary(projectId);
                }
            } catch (error) {
                console.error('Error polling import job', error);
                clearInterval(interval);
            }
        }, 1500);
        return interval;
    };

    const handleFileChange = async (e) => {
        const selectedFile = e.target.files[0];
        setFile(selectedFile);
        if (selectedFile) {
            setStep(2);
            setMessage('Mengupload file dan memvalidasi data...');
            setImportStatus('PENDING');
            setImportErrors([]);
            setImportDiff(null);

            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('project_id', projectId);

            try {
                const response = await axios.post('/rab/import-async', formData, {
                    headers: { 
                        'Content-Type': 'multipart/form-data',
                        'Accept': 'application/json'
                    }
                });
                const job = response.data.data;
                setImportJob(job);
                setImportStatus(job.status);
                startPolling(job.id);
            } catch (error) {
                setImportStatus('FAILED');
                const validationErrors = error.response?.data?.errors;
                if (validationErrors && typeof validationErrors === 'object') {
                    const errMsgs = Object.values(validationErrors).flat();
                    setImportErrors(errMsgs);
                } else {
                    setImportErrors([error.response?.data?.message || 'Gagal mengupload file untuk validasi.']);
                }
                setMessage('Gagal mengupload file.');
            }
        }
    };

    const handleConfirmImport = async () => {
        if (!importJob) return;
        try {
            setMessage('Memulai eksekusi import di background...');
            setImportStatus('IMPORTING');
            const response = await axios.post(`/rab/import-job/${importJob.id}/confirm`);
            const job = response.data.data;
            setImportJob(job);
            setImportStatus(job.status);
            startPolling(job.id);
        } catch (error) {
            setImportStatus('FAILED');
            setImportErrors([error.response?.data?.message || 'Gagal memulai eksekusi import.']);
            setMessage('Gagal melakukan konfirmasi import.');
        }
    };

    const handleAddProject = async (e) => {
        if (e) e.preventDefault();
        if (!newProjectName || !newProjectLocation || !newProjectStartDate) {
            alert('Semua field proyek wajib diisi.');
            return;
        }
        setAddingProject(true);
        try {
            const response = await axios.post('/api/projects', {
                project_name: newProjectName,
                location: newProjectLocation,
                start_date: newProjectStartDate,
            });
            const created = response.data.data;
            const updatedProjects = [...projects, created];
            setProjects(updatedProjects);
            setProjectId(created.id);
            setShowAddProjectModal(false);
            setNewProjectName('');
            setNewProjectLocation('');
            setNewProjectStartDate('');
            setMessage('Proyek baru berhasil ditambahkan!');
        } catch (error) {
            alert(error.response?.data?.message || 'Gagal menambahkan proyek.');
        } finally {
            setAddingProject(false);
        }
    };

    const currentProject = projects.find(p => p.id === projectId);
    const projectName = currentProject?.project_name || `Project #${projectId}`;

    const filteredData = rabData.filter(item => {
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            return (item.description || '').toLowerCase().includes(term) ||
                (item.code_item || '').toLowerCase().includes(term);
        }
        if (categoryFilter && item.category !== categoryFilter) return false;
        return true;
    });

    return (
        <ErrorBoundary>
            <AuthenticatedLayout
                header={
                    <div style={{ textAlign: 'center', position: 'relative' }}>
                        <h1 style={{
                            fontSize: '1.4rem', fontWeight: 700, color: P.umber,
                            fontFamily: 'Georgia, "Palatino Linotype", "Times New Roman", serif',
                            letterSpacing: '0.06em', textShadow: `0 1px 0 ${P.parchmentD}`, marginBottom: '6px',
                        }}>
                            Dashboard
                        </h1>
                        <OrnamentDivider width={200} />
                    </div>
                }
            >
                <Head title="Dashboard" />

                {/* main content area — fills space above bottom tabs */}
                <div style={{
                    minHeight: 'calc(100vh - 120px)',
                    background: `
                        radial-gradient(ellipse at 30% 20%, rgba(219,180,92,0.08) 0%, transparent 50%),
                        radial-gradient(ellipse at 70% 80%, rgba(139,46,30,0.05) 0%, transparent 50%),
                        linear-gradient(180deg, ${P.parchment} 0%, #efe0c8 40%, ${P.parchmentD} 100%)
                    `,
                    paddingBottom: '56px', /* space for bottom tab bar */
                }}>
                    <div style={{
                        maxWidth: '74rem', margin: '0 auto', padding: '1.5rem 1.5rem 2rem',
                        display: 'flex', flexDirection: 'column', gap: '1.5rem',
                    }}>

                        {/* ════════ PROJECT TITLE BANNER ════════ */}
                        <div style={{ textAlign: 'center', padding: '0.5rem 2rem 0.25rem' }}>
                            <h2 style={{
                                fontSize: '1.2rem', fontWeight: 700, color: P.umber,
                                fontFamily: 'Georgia, "Palatino Linotype", serif', letterSpacing: '0.03em',
                            }}>
                                {projectName}
                            </h2>
                            <OrnamentDivider width={220} />
                        </div>

                        {/* ════════ TAB: IMPORT ════════ */}
                        {activeTab === 'import' && (
                            <div style={{ ...cardStyle, overflow: 'hidden' }}>
                                <CartoucheFrame />
                                <ParchmentTexture />
                                <Vignette />
                                <div style={{
                                    padding: '0.85rem 1.5rem',
                                    background: `linear-gradient(135deg, ${P.umber} 0%, ${P.umberLight} 50%, ${P.siennaDeep} 100%)`,
                                    borderBottom: `2px solid ${P.goldDark}`,
                                    position: 'relative',
                                    boxShadow: `0 2px 8px ${P.shadowDeep}`,
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                        <div style={{
                                            width: '28px', height: '28px', borderRadius: '50%',
                                            background: `linear-gradient(135deg, ${P.gold} 0%, ${P.goldDark} 100%)`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            boxShadow: `0 2px 6px rgba(0,0,0,0.3)`, border: `1px solid ${P.goldDark}`,
                                        }}>
                                            <svg style={{ width: '14px', height: '14px', color: P.umber }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fef0d8', fontFamily: 'Georgia, serif', letterSpacing: '0.04em', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
                                                Import RAB
                                            </h3>
                                            <p style={{ fontSize: '0.7rem', color: P.parchmentDD, marginTop: '1px', fontStyle: 'italic' }}>
                                                Upload file Excel (.xlsx, .xls) atau CSV (.csv) berisi rencana anggaran biaya
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ padding: '1.25rem 1.5rem', position: 'relative' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                            <label style={sectionTitle}>Proyek</label>
                                            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                                <select value={projectId} onChange={(e) => setProjectId(Number(e.target.value))} style={{ ...inputBase, minWidth: '180px', cursor: 'pointer' }}>
                                                    {projects.map(p => <option key={p.id} value={p.id}>{p.project_name || `Project #${p.id}`}</option>)}
                                                    {projects.length === 0 && <option value={1}>Project #1</option>}
                                                </select>
                                                <button type="button" onClick={() => setShowAddProjectModal(true)} style={{ ...btnSecondary, padding: '0.45rem 0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '34px' }} title="Tambah Proyek Baru">
                                                    ➕
                                                </button>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1, minWidth: '200px' }}>
                                            <label style={sectionTitle}>File Excel / CSV</label>
                                            <input type="file" accept=".xlsx,.xls,.csv,.txt" onChange={handleFileChange} style={{ ...inputBase, cursor: 'pointer' }} />
                                        </div>
                                    </div>

                                    {message && (
                                        <div style={{
                                            marginTop: '1rem', padding: '0.65rem 0.85rem', borderRadius: '3px', fontSize: '0.82rem', fontWeight: 500,
                                            border: `1.5px solid ${message.includes('berhasil') || message.includes('success') ? '#6b8a5a' : message.includes('Gagal') || message.includes('Error') ? '#a04030' : P.gold}`,
                                            background: message.includes('berhasil') || message.includes('success') ? 'linear-gradient(135deg, #f0f4ec, #e8eede)' : message.includes('Gagal') || message.includes('Error') ? 'linear-gradient(135deg, #f8ede8, #f0ddd4)' : `linear-gradient(135deg, ${P.goldBg}, ${P.parchment})`,
                                            color: message.includes('berhasil') || message.includes('success') ? '#3a5a2a' : message.includes('Gagal') || message.includes('Error') ? '#7a2018' : P.sienna,
                                        }}>{message}</div>
                                    )}

                                    {step === 2 && (
                                        <div style={{ marginTop: '1.25rem', border: `1.5px solid ${P.border}`, borderRadius: '4px', background: P.cream, padding: '1.25rem', position: 'relative' }}>
                                            <CartoucheFrame />
                                            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: P.umber, fontFamily: 'Georgia, serif', marginBottom: '0.75rem' }}>
                                                Status Validasi File: <span style={{ color: importStatus === 'FAILED' ? P.burgundy : importStatus === 'VALIDATED' ? P.olive : P.gold }}>{importStatus}</span>
                                            </h4>

                                            {(importStatus === 'PENDING' || importStatus === 'PROCESSING') && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.82rem', color: P.textMuted }}>
                                                    <svg style={{ animation: 'spin 1s linear infinite', width: '18px', height: '18px', color: P.gold }} viewBox="0 0 24 24">
                                                        <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                        <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                    </svg>
                                                    <span>Sistem sedang membaca dan memvalidasi baris data file...</span>
                                                </div>
                                            )}

                                            {importStatus === 'FAILED' && (
                                                <div style={{ color: '#7a2018', fontSize: '0.82rem' }}>
                                                    <p style={{ fontWeight: 700, marginBottom: '0.5rem' }}>⚠️ Validasi Gagal. Silakan perbaiki kesalahan berikut pada file Anda:</p>
                                                    <div style={{ maxHeight: '12rem', overflowY: 'auto', background: '#f8ede8', padding: '0.75rem', borderRadius: '3px', border: '1px solid #d0baa8', fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: '1.4' }}>
                                                        {importErrors.map((err, i) => <div key={i} style={{ marginBottom: '0.25rem' }}>• {err}</div>)}
                                                    </div>
                                                    <button onClick={() => { setStep(1); setFile(null); setImportJob(null); }} style={{ ...btnSecondary, marginTop: '1rem' }}>Upload Ulang</button>
                                                </div>
                                            )}

                                            {importStatus === 'VALIDATED' && importDiff && (
                                                <div>
                                                    <div style={{ padding: '0.75rem 1rem', background: '#f2f7f0', border: '1.5px solid #d4e3cf', borderRadius: '3px', color: '#2e4e20', fontSize: '0.82rem', marginBottom: '1rem' }}>
                                                        <p style={{ fontWeight: 700, marginBottom: '0.4rem' }}>✅ Validasi Berhasil! Seluruh data format sesuai.</p>
                                                        <p>Total Baris Valid: <strong>{importJob.total_rows}</strong></p>

                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.65rem', padding: '0.5rem', background: 'white', borderRadius: '3px', border: '1px solid #d0e0cc', textAlign: 'center' }}>
                                                            <div>
                                                                <span style={{ display: 'block', fontSize: '0.65rem', ...sectionTitle }}>Item Baru</span>
                                                                <strong style={{ fontSize: '1.1rem', color: P.olive }}>+{importDiff.added_count}</strong>
                                                            </div>
                                                            <div>
                                                                <span style={{ display: 'block', fontSize: '0.65rem', ...sectionTitle }}>Item Berubah</span>
                                                                <strong style={{ fontSize: '1.1rem', color: P.gold }}>{importDiff.updated_count}</strong>
                                                            </div>
                                                            <div>
                                                                <span style={{ display: 'block', fontSize: '0.65rem', ...sectionTitle }}>Item Dihapus</span>
                                                                <strong style={{ fontSize: '1.1rem', color: P.burgundy }}>-{importDiff.deleted_count}</strong>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                                        <button onClick={() => { setStep(1); setFile(null); setImportJob(null); }} style={btnSecondary}>Batal</button>
                                                        <button onClick={handleConfirmImport} style={btnPrimary}>Konfirmasi & Import Sekarang</button>
                                                    </div>
                                                </div>
                                            )}

                                            {importStatus === 'IMPORTING' && (
                                                <div style={{ fontSize: '0.82rem', color: P.text }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                                        <svg style={{ animation: 'spin 1s linear infinite', width: '18px', height: '18px', color: P.gold }} viewBox="0 0 24 24">
                                                            <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                            <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                        </svg>
                                                        <span>Memasukkan data ke database...</span>
                                                    </div>
                                                    <div style={{ height: '8px', background: P.parchmentD, borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                                                        <div style={{ height: '100%', background: P.burgundy, width: `${importJob ? Math.min(100, Math.round((importJob.processed_rows / importJob.total_rows) * 100)) : 0}%`, transition: 'width 0.3s ease' }} />
                                                    </div>
                                                    <span style={{ fontSize: '0.68rem', color: P.textMuted, marginTop: '4px', display: 'block' }}>
                                                        Memproses {importJob.processed_rows} dari {importJob.total_rows} baris...
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ════════ TAB: DATA RAB ════════ */}
                        {activeTab === 'rab' && (
                            <div id="print-section" style={{ ...cardStyle, overflow: 'hidden' }}>
                                <CartoucheFrame />
                                <ParchmentTexture />
                                <Vignette />
                                <div style={{
                                    padding: '0.85rem 1.5rem',
                                    background: `linear-gradient(135deg, ${P.umber} 0%, ${P.umberLight} 40%, ${P.siennaDeep} 100%)`,
                                    borderBottom: `2px solid ${P.goldDark}`,
                                    display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
                                    position: 'relative', boxShadow: `0 2px 8px ${P.shadowDeep}`,
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                        <div style={{
                                            width: '28px', height: '28px', borderRadius: '50%',
                                            background: `linear-gradient(135deg, ${P.gold} 0%, ${P.goldDark} 100%)`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            boxShadow: `0 2px 6px rgba(0,0,0,0.3)`, border: `1px solid ${P.goldDark}`,
                                        }}>
                                            <svg style={{ width: '14px', height: '14px', color: P.umber }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fef0d8', fontFamily: 'Georgia, serif', letterSpacing: '0.04em', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>Data RAB</h3>
                                            <p style={{ fontSize: '0.7rem', color: P.parchmentDD, marginTop: '1px', fontStyle: 'italic' }}>{filteredData.length} item terdaftar</p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <button onClick={() => window.print()} style={{ ...btnSecondary, padding: '0.45rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem', background: `linear-gradient(180deg, rgba(254,249,240,0.15) 0%, rgba(254,249,240,0.08) 100%)`, borderColor: 'rgba(196,168,120,0.4)', color: '#fef0d8', cursor: 'pointer' }} title="Cetak RAB">
                                            🖨️ Cetak
                                        </button>
                                        <div style={{ position: 'relative' }}>
                                            <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: P.parchmentDD }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                            <input type="text" placeholder="Cari item..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ ...inputBase, paddingLeft: '2.25rem', width: '170px', background: `linear-gradient(180deg, rgba(254,249,240,0.15) 0%, rgba(254,249,240,0.08) 100%)`, borderColor: 'rgba(196,168,120,0.4)', color: '#fef0d8' }} />
                                        </div>
                                        {categories.length > 0 && (
                                            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ ...inputBase, cursor: 'pointer', background: `linear-gradient(180deg, rgba(254,249,240,0.15) 0%, rgba(254,249,240,0.08) 100%)`, borderColor: 'rgba(196,168,120,0.4)', color: '#fef0d8' }}>
                                                <option value="" style={{ color: P.text }}>Semua Kategori</option>
                                                {categories.map(c => <option key={c} value={c} style={{ color: P.text }}>{c}</option>)}
                                            </select>
                                        )}
                                    </div>
                                </div>
                                <div style={{ overflowX: 'auto', position: 'relative' }}>
                                    {loadingRab ? (
                                        <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
                                            <svg style={{ animation: 'spin 1s linear infinite', width: '28px', height: '28px', color: P.gold, margin: '0 auto 0.75rem' }} viewBox="0 0 24 24"><circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                            <p style={{ fontSize: '0.85rem', color: P.textMuted, fontStyle: 'italic' }}>Memuat data RAB...</p>
                                        </div>
                                    ) : rabData.length === 0 ? (
                                        <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
                                            <p style={{ fontSize: '0.9rem', color: P.textMuted, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>Belum ada data RAB.</p>
                                            <p style={{ fontSize: '0.75rem', color: P.border, marginTop: '0.25rem', fontStyle: 'italic' }}>Upload file Excel di tab Import untuk memulai.</p>
                                        </div>
                                    ) : (
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                            <thead>
                                                <tr style={{ background: `linear-gradient(180deg, ${P.parchmentD}, ${P.parchmentDD})` }}>
                                                    {[
                                                        { label: '#', align: 'left', w: '42px' },
                                                        { label: 'Kode', align: 'left' },
                                                        { label: 'Uraian Pekerjaan', align: 'left' },
                                                        { label: 'Volume', align: 'center' },
                                                        { label: 'Satuan', align: 'center' },
                                                        { label: 'Harga Satuan', align: 'right' },
                                                        { label: 'Total', align: 'right' },
                                                        { label: 'Kategori', align: 'center' },
                                                    ].map(col => (
                                                        <th key={col.label} style={{ padding: '0.6rem 0.75rem', textAlign: col.align, width: col.w, ...sectionTitle, borderBottom: `2.5px solid ${P.borderDark}`, textShadow: `0 1px 0 ${P.cream}` }}>{col.label}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredData.map((item, i) => (
                                                    <tr key={item.id} style={{ background: i % 2 === 0 ? P.cream : P.parchment, transition: 'background 0.15s', borderBottom: `1px solid ${P.borderLight}` }}
                                                        onMouseEnter={(e) => e.currentTarget.style.background = P.goldBg}
                                                        onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? P.cream : P.parchment}
                                                    >
                                                        <td style={{ padding: '0.5rem 0.75rem', color: P.textMuted, fontSize: '0.72rem' }}>{i + 1}</td>
                                                        <td style={{ padding: '0.5rem 0.75rem', color: P.textMuted, fontFamily: '"Courier New", monospace', fontSize: '0.72rem' }}>{item.code_item || '—'}</td>
                                                        <td style={{ padding: '0.5rem 0.75rem', color: P.text, fontWeight: 600 }}>{item.description}</td>
                                                        <td style={{ padding: '0.5rem 0.75rem', color: P.text, textAlign: 'center' }}>{item.volume || '—'}</td>
                                                        <td style={{ padding: '0.5rem 0.75rem', color: P.text, textAlign: 'center' }}>{item.unit || '—'}</td>
                                                        <td style={{ padding: '0.5rem 0.75rem', color: P.text, textAlign: 'right', fontFamily: '"Courier New", monospace' }}>{fmt(item.unit_price)}</td>
                                                        <td style={{ padding: '0.5rem 0.75rem', color: P.umber, textAlign: 'right', fontWeight: 700, fontFamily: '"Courier New", monospace' }}>{fmt(item.total_price)}</td>
                                                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                                            {item.category ? (
                                                                <span style={{ display: 'inline-block', padding: '0.12rem 0.55rem', borderRadius: '2px', fontSize: '0.65rem', fontWeight: 600, background: `linear-gradient(135deg, ${P.goldBg}, ${P.parchment})`, color: P.siennaDeep, border: `1px solid ${P.gold}40` }}>{item.category}</span>
                                                            ) : <span style={{ color: P.border }}>—</span>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ════════ TAB: SUMMARY ════════ */}
                        {activeTab === 'summary' && summary && summary.total_items > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1.25rem' }}>
                                {[
                                    {
                                        label: 'Total Anggaran', value: fmt(summary.total_budget), accent: P.gold, accentDark: P.goldDark, bgGradient: `linear-gradient(135deg, ${P.goldBg} 0%, #f8edd0 100%)`,
                                        icon: <svg style={{ width: '24px', height: '24px', color: P.goldDark }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    },
                                    {
                                        label: 'Jumlah Item', value: summary.total_items, accent: P.sienna, accentDark: P.siennaDeep, bgGradient: `linear-gradient(135deg, #fdf2ea 0%, #f5e0cc 100%)`,
                                        icon: <svg style={{ width: '24px', height: '24px', color: P.siennaDeep }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                    },
                                    {
                                        label: 'Kategori', value: categories.length, accent: P.burgundy, accentDark: P.burgundyDeep, bgGradient: `linear-gradient(135deg, #f8ece8 0%, #eedcd4 100%)`,
                                        icon: <svg style={{ width: '24px', height: '24px', color: P.burgundyDeep }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                    },
                                ].map((card, idx) => (
                                    <div key={idx} style={{ ...cardStyle, padding: '1.25rem 1.5rem', background: card.bgGradient, overflow: 'hidden' }}>
                                        <CartoucheFrame />
                                        <div style={{ position: 'absolute', top: 0, left: 0, width: '5px', height: '100%', background: `linear-gradient(180deg, ${card.accent} 0%, ${card.accentDark} 50%, ${card.accent} 100%)`, boxShadow: `1px 0 4px ${P.shadow}` }} />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative' }}>
                                            <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: `linear-gradient(145deg, ${P.cream} 0%, ${P.parchment} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${card.accent}40`, boxShadow: `0 3px 10px ${P.shadow}` }}>{card.icon}</div>
                                            <div>
                                                <p style={sectionTitle}>{card.label}</p>
                                                <p style={{ fontSize: '1.3rem', fontWeight: 800, color: P.umber, fontFamily: 'Georgia, "Palatino Linotype", serif', lineHeight: 1.3 }}>{card.value}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {/* category breakdown */}
                                {summary.by_category && Object.keys(summary.by_category).length > 0 && (
                                    <div style={{ ...cardStyle, padding: '1.25rem 1.5rem', gridColumn: '1 / -1' }}>
                                        <CartoucheFrame />
                                        <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: P.umber, fontFamily: 'Georgia, serif', marginBottom: '0.75rem' }}>Rincian per Kategori</h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.65rem' }}>
                                            {Object.entries(summary.by_category).map(([cat, data]) => (
                                                <div key={cat} style={{ padding: '0.6rem 0.85rem', background: `linear-gradient(135deg, ${P.goldBg}, ${P.parchment})`, border: `1px solid ${P.gold}30`, borderRadius: '3px' }}>
                                                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: P.siennaDeep }}>{cat}</p>
                                                    <p style={{ fontSize: '0.68rem', color: P.textMuted }}>{data.count ?? data.total_items ?? 0} item — {fmt(data.total ?? data.total_budget ?? 0)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {activeTab === 'summary' && (!summary || summary.total_items === 0) && (
                            <div style={{ ...cardStyle, padding: '3rem', textAlign: 'center' }}>
                                <p style={{ fontSize: '0.9rem', color: P.textMuted, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>Belum ada data ringkasan.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ════════ EXCEL-STYLE BOTTOM SHEET TABS ════════ */}
                <div style={{
                    position: 'fixed', bottom: 0, left: '256px', right: 0, zIndex: 9999,
                    height: '44px',
                    background: `linear-gradient(180deg, #e8e0d4 0%, #d8ceb8 40%, #c8bca4 100%)`,
                    borderTop: `1.5px solid ${P.borderDark}`,
                    boxShadow: `0 -2px 8px rgba(74,32,8,0.12)`,
                    display: 'flex', alignItems: 'flex-end', padding: '0 0.5rem',
                }}>
                    {/* navigation arrows */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginRight: '4px', paddingBottom: '2px' }}>
                        <button style={{ width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: P.textMuted, cursor: 'pointer', fontSize: '10px' }}>◀</button>
                        <button style={{ width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: P.textMuted, cursor: 'pointer', fontSize: '10px' }}>▶</button>
                    </div>

                    {/* sheet tabs */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0', flex: 1, overflow: 'auto' }}>
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    style={{
                                        padding: '0.35rem 1rem',
                                        fontSize: '0.78rem',
                                        fontWeight: isActive ? 700 : 500,
                                        fontFamily: 'Segoe UI, system-ui, sans-serif',
                                        color: isActive ? P.umber : P.textMuted,
                                        background: isActive
                                            ? '#fef9f0'
                                            : 'linear-gradient(180deg, #ddd4c4 0%, #d0c4b0 100%)',
                                        border: `1px solid ${P.borderDark}`,
                                        borderBottom: isActive ? '1px solid #fef9f0' : `1px solid ${P.borderDark}`,
                                        borderRadius: '4px 4px 0 0',
                                        cursor: 'pointer',
                                        position: 'relative',
                                        top: isActive ? '1px' : '3px',
                                        transition: 'all 0.15s',
                                        whiteSpace: 'nowrap',
                                        marginRight: '-1px',
                                        boxShadow: isActive ? `0 -2px 4px rgba(74,32,8,0.08)` : 'none',
                                        zIndex: isActive ? 2 : 1,
                                    }}
                                >
                                    <span style={{ marginRight: '0.35rem' }}>{tab.icon}</span>
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* add sheet button */}
                    <button style={{
                        width: '28px', height: '28px', marginBottom: '2px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'none', border: `1px solid ${P.border}`,
                        borderRadius: '3px', color: P.textMuted, cursor: 'pointer', fontSize: '14px',
                    }}>+</button>
                </div>

            {showAddProjectModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        ...cardStyle, width: '400px', padding: '1.5rem',
                        position: 'relative', background: P.cream, border: `2px solid ${P.goldDark}`,
                        boxShadow: `0 10px 25px rgba(0,0,0,0.3)`
                    }}>
                        <CartoucheFrame />
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: P.umber, fontFamily: 'Georgia, serif', marginBottom: '1rem', borderBottom: `1.5px solid ${P.border}`, paddingBottom: '0.5rem' }}>
                            Tambah Proyek Baru
                        </h3>
                        <form onSubmit={handleAddProject} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <label style={sectionTitle}>Nama Proyek</label>
                                <input type="text" placeholder="Masukkan nama proyek..." value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} style={inputBase} required />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <label style={sectionTitle}>Lokasi</label>
                                <input type="text" placeholder="Masukkan lokasi proyek..." value={newProjectLocation} onChange={(e) => setNewProjectLocation(e.target.value)} style={inputBase} required />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <label style={sectionTitle}>Tanggal Mulai</label>
                                <input type="date" value={newProjectStartDate} onChange={(e) => setNewProjectStartDate(e.target.value)} style={inputBase} required />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
                                <button type="button" onClick={() => setShowAddProjectModal(false)} style={btnSecondary}>Batal</button>
                                <button type="submit" disabled={addingProject} style={btnPrimary}>
                                    {addingProject ? 'Menyimpan...' : 'Simpan Proyek'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

                <style>{`
                    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                    input:focus, select:focus { border-color: ${P.gold} !important; box-shadow: 0 0 0 2px ${P.gold}25, inset 0 1px 3px rgba(74,32,8,0.08) !important; }
                    select option { background: ${P.cream}; color: ${P.text}; }
                    @media print {
                        body * { visibility: hidden; }
                        #print-section, #print-section * { visibility: visible; }
                        #print-section {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100%;
                            background: white !important;
                            color: black !important;
                            border: none !important;
                            box-shadow: none !important;
                        }
                        #print-section button, #print-section select, #print-section input {
                            display: none !important;
                        }
                        table {
                            border-collapse: collapse !important;
                            width: 100% !important;
                        }
                        th, td {
                            border: 1px solid #c4a878 !important;
                            padding: 6px 10px !important;
                            color: black !important;
                            background: none !important;
                        }
                    }
                `}</style>
            </AuthenticatedLayout>
        </ErrorBoundary>
    );
}
