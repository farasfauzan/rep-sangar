import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    DataTable,
    StatusBadge,
    Button,
    Modal,
    FormField,
    ConfirmModal,
    PageHeader,
} from '@/Components/ui';
import { useToast } from '@/Components/ui/Toast';

// Role color map for badges
const roleColorMap = {
    admin:              'bg-red-100 text-red-800',
    engineer:           'bg-blue-100 text-blue-800',
    lapangan:           'bg-green-100 text-green-800',
    purchasing_legal:   'bg-purple-100 text-purple-800',
    verifikator_keu:    'bg-yellow-100 text-yellow-800',
    mgr_komersial:      'bg-indigo-100 text-indigo-800',
    keu_kantor:         'bg-pink-100 text-pink-800',
    pajak:              'bg-orange-100 text-orange-800',
    accounting:         'bg-teal-100 text-teal-800',
};

const emptyForm = { name: '', email: '', password: '', password_confirmation: '', role_id: '' };

export default function UserManagement({ auth }) {
    const toast         = useToast();
    const currentUserId = auth.user.id;

    // ── data state ───────────────────────────────────────────
    const [users, setUsers]   = useState([]);
    const [roles, setRoles]   = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch]   = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [page, setPage]       = useState(1);
    const [meta, setMeta]       = useState({});

    // ── modal state ──────────────────────────────────────────
    const [showForm, setShowForm]       = useState(false);
    const [editing, setEditing]         = useState(null);   // null = create, object = edit
    const [form, setForm]               = useState({ ...emptyForm });
    const [errors, setErrors]           = useState({});
    const [submitting, setSubmitting]   = useState(false);

    // confirm delete
    const [deleting, setDeleting]       = useState(null);
    const [deletingLoading, setDeletingLoading] = useState(false);

    // ── fetch helpers ────────────────────────────────────────
    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, per_page: 15 };
            if (search)     params.search  = search;
            if (filterRole) params.role_id = filterRole;

            const res = await axios.get('/api/users', { params });
            const payload = res.data.data;
            // paginated response has .data array inside
            setUsers(Array.isArray(payload) ? payload : payload.data || []);
            setMeta(payload.current_page ? payload : {});
        } catch {
            toast.error('Gagal memuat data user.');
        } finally {
            setLoading(false);
        }
    }, [page, search, filterRole]);

    const fetchRoles = useCallback(async () => {
        try {
            const res = await axios.get('/api/roles');
            setRoles(res.data.data || []);
        } catch {
            // fallback: roles might come from props later
        }
    }, []);

    useEffect(() => { fetchRoles(); }, []);
    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    // debounce search
    const [searchInput, setSearchInput] = useState('');
    useEffect(() => {
        const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
        return () => clearTimeout(t);
    }, [searchInput]);

    // ── form handlers ────────────────────────────────────────
    const openCreate = () => {
        setEditing(null);
        setForm({ ...emptyForm });
        setErrors({});
        setShowForm(true);
    };

    const openEdit = (user) => {
        setEditing(user);
        setForm({
            name:                  user.name,
            email:                 user.email,
            password:              '',
            password_confirmation: '',
            role_id:               user.role_id || '',
        });
        setErrors({});
        setShowForm(true);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setErrors({});

        try {
            const payload = { ...form };
            // Don't send empty password on edit
            if (editing && !payload.password) {
                delete payload.password;
                delete payload.password_confirmation;
            }
            // Send password_confirmation only when password is set
            if (!payload.password) {
                delete payload.password_confirmation;
            }

            if (editing) {
                await axios.put(`/api/users/${editing.id}`, payload);
                toast.success('User berhasil diperbarui.');
            } else {
                await axios.post('/api/users', payload);
                toast.success('User berhasil ditambahkan.');
            }
            setShowForm(false);
            fetchUsers();
        } catch (err) {
            if (err.response?.status === 422) {
                setErrors(err.response.data.errors || {});
                toast.error('Validasi gagal. Periksa kembali input Anda.');
            } else {
                toast.error(err.response?.data?.message || 'Terjadi kesalahan.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    // ── inline role assign ───────────────────────────────────
    const handleAssignRole = async (userId, roleId) => {
        try {
            await axios.put(`/api/users/${userId}/role`, { role_id: roleId });
            toast.success('Role berhasil diubah.');
            fetchUsers();
        } catch {
            toast.error('Gagal mengubah role.');
        }
    };

    // ── delete ───────────────────────────────────────────────
    const handleDelete = async () => {
        if (!deleting) return;
        if (deleting.id === currentUserId) {
            toast.error('Anda tidak dapat menghapus akun sendiri.');
            setDeleting(null);
            return;
        }
        setDeletingLoading(true);
        try {
            await axios.delete(`/api/users/${deleting.id}`);
            toast.success('User berhasil dihapus.');
            setDeleting(null);
            fetchUsers();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Gagal menghapus user.');
        } finally {
            setDeletingLoading(false);
        }
    };

    // ── columns ──────────────────────────────────────────────
    const columns = [
        {
            key: 'name',
            label: 'Nama',
            sortable: true,
            render: (val, row) => (
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">
                        {row.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-900">{row.name}</span>
                </div>
            ),
        },
        {
            key: 'email',
            label: 'Email',
            sortable: true,
        },
        {
            key: 'role',
            label: 'Role',
            render: (_, row) => {
                const roleName = row.role?.role_name || '—';
                return (
                    <StatusBadge
                        status={roleName.replace(/_/g, ' ')}
                        colorMap={roleColorMap}
                    />
                );
            },
        },
        {
            key: 'role_id',
            label: 'Ubah Role',
            render: (_, row) => (
                <select
                    value={row.role_id || ''}
                    onChange={(e) => handleAssignRole(row.id, e.target.value)}
                    className="block w-full rounded-lg border-gray-300 shadow-sm text-xs focus:border-indigo-500 focus:ring-indigo-500"
                    disabled={row.id === currentUserId}
                >
                    <option value="">— Pilih Role —</option>
                    {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                            {r.role_name.replace(/_/g, ' ')}
                        </option>
                    ))}
                </select>
            ),
        },
        {
            key: 'created_at',
            label: 'Terdaftar',
            sortable: true,
            render: (val) =>
                val ? new Date(val).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
        },
        {
            key: 'actions',
            label: 'Aksi',
            headerClassName: 'text-right',
            className: 'text-right',
            render: (_, row) => (
                <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                        Edit
                    </Button>
                    {row.id !== currentUserId && (
                        <Button variant="danger" size="sm" onClick={() => setDeleting(row)}>
                            Hapus
                        </Button>
                    )}
                </div>
            ),
        },
    ];

    // ── render ───────────────────────────────────────────────
    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold text-gray-800">Kelola User</h2>}
        >
            <Head title="Kelola User" />

            <div className="py-6 max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
                <PageHeader
                    title="Kelola User"
                    subtitle="Manajemen akun pengguna sistem ERP"
                    actions={
                        <Button onClick={openCreate}>
                            + Tambah User
                        </Button>
                    }
                />

                {/* Filters */}
                <div className="bg-white shadow rounded-lg p-4 flex flex-col sm:flex-row gap-3">
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Cari nama atau email..."
                        className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                    <select
                        value={filterRole}
                        onChange={(e) => { setFilterRole(e.target.value); setPage(1); }}
                        className="rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                        <option value="">Semua Role</option>
                        {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.role_name.replace(/_/g, ' ')}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Table */}
                <div className="bg-white shadow rounded-lg overflow-hidden">
                    <DataTable
                        columns={columns}
                        data={users}
                        loading={loading}
                        emptyMessage="Tidak ada user ditemukan."
                    />

                    {/* Pagination */}
                    {meta.last_page > 1 && (
                        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
                            <span className="text-sm text-gray-600">
                                Halaman {meta.current_page} dari {meta.last_page}
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={meta.current_page <= 1}
                                    onClick={() => setPage((p) => p - 1)}
                                >
                                    ← Prev
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={meta.current_page >= meta.last_page}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    Next →
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Create / Edit Modal ─────────────────────── */}
            <Modal
                open={showForm}
                onClose={() => setShowForm(false)}
                title={editing ? 'Edit User' : 'Tambah User'}
                size="md"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <FormField label="Nama" required error={errors.name?.[0]}>
                        <input
                            type="text"
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            required
                        />
                    </FormField>

                    <FormField label="Email" required error={errors.email?.[0]}>
                        <input
                            type="email"
                            name="email"
                            value={form.email}
                            onChange={handleChange}
                            className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            required
                        />
                    </FormField>

                    <FormField
                        label="Password"
                        required={!editing}
                        error={errors.password?.[0]}
                    >
                        <input
                            type="password"
                            name="password"
                            value={form.password}
                            onChange={handleChange}
                            className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            placeholder={editing ? 'Kosongkan jika tidak diubah' : ''}
                            {...(editing ? {} : { required: true })}
                        />
                    </FormField>

                    {form.password && (
                        <FormField label="Konfirmasi Password" required error={errors.password_confirmation?.[0]}>
                            <input
                                type="password"
                                name="password_confirmation"
                                value={form.password_confirmation}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                required
                            />
                        </FormField>
                    )}

                    <FormField label="Role" required error={errors.role_id?.[0]}>
                        <select
                            name="role_id"
                            value={form.role_id}
                            onChange={handleChange}
                            className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            required
                        >
                            <option value="">— Pilih Role —</option>
                            {roles.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.role_name.replace(/_/g, ' ')}
                                </option>
                            ))}
                        </select>
                    </FormField>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <Button variant="outline" type="button" onClick={() => setShowForm(false)}>
                            Batal
                        </Button>
                        <Button type="submit" loading={submitting}>
                            {editing ? 'Simpan Perubahan' : 'Tambah User'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* ── Delete Confirm Modal ────────────────────── */}
            <ConfirmModal
                open={!!deleting}
                onClose={() => setDeleting(null)}
                onConfirm={handleDelete}
                title="Hapus User"
                message={
                    deleting
                        ? `Apakah Anda yakin ingin menghapus user "${deleting.name}"? Tindakan ini tidak dapat dibatalkan.`
                        : ''
                }
                confirmText="Hapus"
                confirmVariant="danger"
                loading={deletingLoading}
            />
        </AuthenticatedLayout>
    );
}
