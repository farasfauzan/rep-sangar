import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ErrorBoundary from '@/Components/ErrorBoundary';
import { Head } from '@inertiajs/react';
import { useState } from 'react';
import { Modal, Button } from '@/Components/ui';
import ExecutiveSummary from '@/Pages/Dashboard/ExecutiveSummary';
import FinancialChart from '@/Pages/Dashboard/FinancialChart';
import ProjectsList from '@/Pages/Dashboard/ProjectsList';
import RabImport from '@/Pages/Dashboard/RabImport';
import QuickActions from '@/Pages/Dashboard/QuickActions';
import RoleOverview from '@/Pages/Dashboard/RoleOverview';
import { useApi } from '@/hooks/useApi';
import { useProjects } from '@/hooks/useProjects';
import { updateProjectsCache } from '@/hooks/useProjects';

const tabs = [
    { id: 'import', label: 'Import', icon: '📥' },
    { id: 'rab', label: 'Data RAB', icon: '📋' },
    { id: 'summary', label: 'Ringkasan', icon: '📊' },
    { id: 'executive', label: 'Eksekutif', icon: '👑' },
    { id: 'financial', label: 'Keuangan', icon: '💰' },
    { id: 'projects', label: 'Proyek', icon: '🏗️' },
];

const inputCls = 'w-full rounded-lg border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm';
const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1';

export default function Dashboard({ auth }) {
    const toast = useToast();
    const api = useApi();
    const { projects, refresh: refreshProjects } = useProjects();
    const [projectId, setProjectId] = useState(1);
    const [activeTab, setActiveTab] = useState('import');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [form, setForm] = useState({ name: '', location: '', startDate: '', status: 'planning' });
    const [saving, setSaving] = useState(false);

    const currentProject = projects.find((p) => p.id === projectId);
    const projectName = currentProject?.project_name || `Project #${projectId}`;

    const resetForm = () => setForm({ name: '', location: '', startDate: '', status: 'planning' });

    const handleAddProject = async (e) => {
        e.preventDefault();
        if (!form.name || !form.location || !form.startDate) { toast.error('Semua field proyek wajib diisi.'); return; }
        setSaving(true);
        try {
            const res = await api.post('/api/projects', { project_name: form.name, location: form.location, start_date: form.startDate });
            updateProjectsCache([...projects, res]);
            await refreshProjects();
            setProjectId(res.id);
            setShowAddModal(false);
            resetForm();
        } catch (err) { /* toast shown by useApi */ }
        finally { setSaving(false); }
    };

    const openEditModal = () => {
        if (!currentProject) { toast.error('Pilih proyek terlebih dahulu.'); return; }
        setForm({ name: currentProject.project_name || '', location: currentProject.location || '', startDate: currentProject.start_date || '', status: currentProject.status || 'planning' });
        setShowEditModal(true);
    };

    const handleEditProject = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await api.put(`/api/projects/${projectId}`, { project_name: form.name, location: form.location, start_date: form.startDate || null, status: form.status });
            updateProjectsCache(projects.map((p) => (p.id === projectId ? { ...p, ...res } : p)));
            await refreshProjects();
            setShowEditModal(false);
        } catch (err) { /* toast shown by useApi */ }
        finally { setSaving(false); }
    };

    const isRabTab = activeTab === 'import' || activeTab === 'rab';

    return (
        <ErrorBoundary>
            <AuthenticatedLayout header={<h1 className="text-xl font-bold text-gray-900 text-center">Dashboard</h1>}>
                <Head title="Dashboard" />
                <div className="min-h-[calc(100vh-120px)] bg-gray-50 pb-14">
                    <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-6">
                        {/* Project Title */}
                        <div className="text-center">
                            <h2 className="text-lg font-bold text-gray-900 font-serif">{projectName}</h2>
                            {currentProject?.location && <p className="text-xs text-gray-500 italic mt-0.5">📍 {currentProject.location}</p>}
                        </div>

                        {/* Project Selector */}
                        {projects.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {projects.map((p) => (
                                    <button key={p.id} onClick={() => setProjectId(p.id)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border ${p.id === projectId ? 'bg-amber-600 text-white border-amber-700 shadow-md' : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300 hover:bg-amber-50'}`}>
                                        <span className="block">{p.project_name || `Project #${p.id}`}</span>
                                        {p.location && <span className="block text-xs opacity-80 italic">📍 {p.location}</span>}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Active Tab Content */}
                        {isRabTab && (
                            <RabImport projectId={projectId} projects={projects} currentProject={currentProject}
                                onProjectChange={setProjectId} onAddProject={() => setShowAddModal(true)}
                                onEditProject={openEditModal} view={activeTab} onImportComplete={() => setActiveTab('rab')} />
                        )}
                        {activeTab === 'summary' && <RoleOverview projectId={projectId} />}
                        {activeTab === 'executive' && <ExecutiveSummary projectId={projectId} />}
                        {activeTab === 'financial' && <FinancialChart projectId={projectId} />}
                        {activeTab === 'projects' && <ProjectsList projectId={projectId} />}
                    </div>
                </div>

                <QuickActions tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

                {/* Add Project Modal */}
                <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Tambah Proyek Baru" size="sm">
                    <form onSubmit={handleAddProject} className="flex flex-col gap-4">
                        <div><label className={labelCls}>Nama Proyek</label><input type="text" placeholder="Masukkan nama proyek..." value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} required /></div>
                        <div><label className={labelCls}>Lokasi</label><input type="text" placeholder="Masukkan lokasi proyek..." value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputCls} required /></div>
                        <div><label className={labelCls}>Tanggal Mulai</label><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={inputCls} required /></div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setShowAddModal(false)}>Batal</Button>
                            <Button variant="primary" type="submit" loading={saving}>{saving ? 'Menyimpan...' : 'Simpan Proyek'}</Button>
                        </div>
                    </form>
                </Modal>

                {/* Edit Project Modal */}
                <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Proyek" size="sm">
                    <form onSubmit={handleEditProject} className="flex flex-col gap-4">
                        <div><label className={labelCls}>Nama Proyek</label><input type="text" placeholder="Masukkan nama proyek..." value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} required /></div>
                        <div><label className={labelCls}>Lokasi</label><input type="text" placeholder="Masukkan lokasi proyek..." value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputCls} /></div>
                        <div><label className={labelCls}>Tanggal Mulai</label><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={inputCls} /></div>
                        <div><label className={labelCls}>Status</label>
                            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={`${inputCls} cursor-pointer`}>
                                <option value="planning">Planning</option><option value="active">Active</option><option value="completed">Completed</option>
                                <option value="on_hold">On Hold</option><option value="cancelled">Cancelled</option>
                            </select>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setShowEditModal(false)}>Batal</Button>
                            <Button variant="primary" type="submit" loading={saving}>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</Button>
                        </div>
                    </form>
                </Modal>
            </AuthenticatedLayout>
        </ErrorBoundary>
    );
}
