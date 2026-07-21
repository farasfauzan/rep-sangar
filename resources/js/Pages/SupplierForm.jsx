    import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
    import { Head, router } from '@inertiajs/react';
    import { useState, useEffect } from 'react';
    import axios from 'axios';
    import Card from '@/Components/ui/Card';
    import FormField from '@/Components/ui/FormField';
    import Button from '@/Components/ui/Button';
    import PageHeader from '@/Components/ui/PageHeader';
    import { useToast } from '@/Components/ui/Toast';

    const emptyForm = {
        name: '',
        code: '',
        npwp: '',
        address: '',
        phone: '',
        email: '',
        bank_name: '',
        bank_account_number: '',
        bank_account_name: '',
        contact_person: '',
        notes: '',
        is_active: true,
    };

    export default function SupplierForm({ id }) {
        const toast = useToast();
        const isEditing = Boolean(id);

        const [form, setForm] = useState(emptyForm);
        const [errors, setErrors] = useState({});
        const [loading, setLoading] = useState(false);
        const [fetching, setFetching] = useState(isEditing);

        // Fetch existing supplier data when editing
        useEffect(() => {
            if (!isEditing) return;
            setFetching(true);
            axios
                .get(`/api/suppliers/${id}`)
                .then((res) => {
                    const data = res.data?.data ?? res.data;
                    setForm({
                        name: data.name || '',
                        code: data.code || '',
                        npwp: data.npwp || '',
                        address: data.address || '',
                        phone: data.phone || '',
                        email: data.email || '',
                        bank_name: data.bank_name || '',
                        bank_account_number: data.bank_account_number || '',
                        bank_account_name: data.bank_account_name || '',
                        contact_person: data.contact_person || '',
                        notes: data.notes || '',
                        is_active: Boolean(data.is_active),
                    });
                })
                .catch(() => {
                    toast.error('Gagal memuat data supplier.');
                    router.get('/suppliers');
                })
                .finally(() => setFetching(false));
        }, [id, isEditing]);

        const update = (field, value) => {
            setForm((prev) => ({ ...prev, [field]: value }));
            // Clear field-level error on change
            if (errors[field]) {
                setErrors((prev) => {
                    const next = { ...prev };
                    delete next[field];
                    return next;
                });
            }
        };

        const validate = () => {
            const errs = {};
            if (!form.name.trim()) errs.name = 'Nama supplier wajib diisi.';
            if (!form.code.trim()) errs.code = 'Kode supplier wajib diisi.';
            if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
                errs.email = 'Format email tidak valid.';
            }
            setErrors(errs);
            return Object.keys(errs).length === 0;
        };

        const handleSubmit = async (e) => {
            e.preventDefault();
            if (!validate()) return;

            setLoading(true);
            setErrors({});

            try {
                if (isEditing) {
                    const res = await axios.put(`/api/suppliers/${id}`, form);
                    toast.success(res.data?.message || 'Supplier berhasil diperbarui.');
                } else {
                    const res = await axios.post('/api/suppliers', form);
                    toast.success(res.data?.message || 'Supplier berhasil dibuat.');
                }
                router.get('/suppliers');
            } catch (err) {
                if (err.response?.status === 422) {
                    setErrors(err.response.data.errors || {});
                    toast.error('Periksa kembali isian formulir.');
                } else {
                    toast.error(err.response?.data?.message || 'Gagal menyimpan supplier.');
                }
            } finally {
                setLoading(false);
            }
        };

        if (fetching) {
            return (
                <AuthenticatedLayout>
                    <Head title="Memuat..." />
                    <div className="flex min-h-[40vh] items-center justify-center">
                        <div className="flex items-center gap-3 text-gray-500">
                            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Memuat data supplier...
                        </div>
                    </div>
                </AuthenticatedLayout>
            );
        }

        return (
            <AuthenticatedLayout>
                <Head title={isEditing ? 'Edit Supplier' : 'Tambah Supplier'} />

                <div className="py-6">
                    <div className="mx-auto max-w-3xl sm:px-6 lg:px-8">
                        <PageHeader
                            title={isEditing ? 'Edit Supplier' : 'Tambah Supplier Baru'}
                            subtitle={isEditing ? `Mengedit supplier: ${form.name}` : 'Isi data untuk menambahkan supplier baru'}
                            breadcrumbs={[
                                { label: 'Supplier', href: '/suppliers' },
                                { label: isEditing ? 'Edit' : 'Tambah' },
                            ]}
                        />

                        <Card>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Basic Info */}
                                <div>
                                    <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
                                        Informasi Dasar
                                    </h4>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <FormField label="Nama Supplier" required error={errors.name}>
                                            <input
                                                type="text"
                                                value={form.name}
                                                onChange={(e) => update('name', e.target.value)}
                                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                placeholder="PT. Contoh Sejahtera"
                                            />
                                        </FormField>

                                        <FormField label="Kode Supplier" required error={errors.code}>
                                            <input
                                                type="text"
                                                value={form.code}
                                                onChange={(e) => update('code', e.target.value)}
                                                className="block w-full rounded-lg border-gray-300 font-mono shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                placeholder="SUP-001"
                                            />
                                        </FormField>

                                        <FormField label="NPWP" error={errors.npwp}>
                                            <input
                                                type="text"
                                                value={form.npwp}
                                                onChange={(e) => update('npwp', e.target.value)}
                                                className="block w-full rounded-lg border-gray-300 font-mono shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                placeholder="00.000.000.0-000.000"
                                            />
                                        </FormField>

                                        <FormField label="Status">
                                            <select
                                                value={form.is_active ? '1' : '0'}
                                                onChange={(e) => update('is_active', e.target.value === '1')}
                                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                            >
                                                <option value="1">Aktif</option>
                                                <option value="0">Nonaktif</option>
                                            </select>
                                        </FormField>
                                    </div>
                                </div>

                                {/* Contact Info */}
                                <div className="border-t border-gray-100 pt-6">
                                    <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
                                        Informasi Kontak
                                    </h4>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <FormField label="Telepon" error={errors.phone}>
                                            <input
                                                type="text"
                                                value={form.phone}
                                                onChange={(e) => update('phone', e.target.value)}
                                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                placeholder="021-xxxx xxxx"
                                            />
                                        </FormField>

                                        <FormField label="Email" error={errors.email}>
                                            <input
                                                type="email"
                                                value={form.email}
                                                onChange={(e) => update('email', e.target.value)}
                                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                placeholder="info@contoh.com"
                                            />
                                        </FormField>

                                        <FormField label="Contact Person" error={errors.contact_person}>
                                            <input
                                                type="text"
                                                value={form.contact_person}
                                                onChange={(e) => update('contact_person', e.target.value)}
                                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                placeholder="Nama PIC"
                                            />
                                        </FormField>

                                        <FormField label="Alamat" className="sm:col-span-2">
                                            <textarea
                                                value={form.address}
                                                onChange={(e) => update('address', e.target.value)}
                                                rows={3}
                                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                placeholder="Alamat lengkap supplier"
                                            />
                                        </FormField>
                                    </div>
                                </div>

                                {/* Bank Info */}
                                <div className="border-t border-gray-100 pt-6">
                                    <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
                                        Informasi Bank
                                    </h4>
                                    <div className="grid gap-4 sm:grid-cols-3">
                                        <FormField label="Nama Bank" error={errors.bank_name}>
                                            <input
                                                type="text"
                                                value={form.bank_name}
                                                onChange={(e) => update('bank_name', e.target.value)}
                                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                placeholder="Bank Mandiri"
                                            />
                                        </FormField>

                                        <FormField label="No. Rekening" error={errors.bank_account_number}>
                                            <input
                                                type="text"
                                                value={form.bank_account_number}
                                                onChange={(e) => update('bank_account_number', e.target.value)}
                                                className="block w-full rounded-lg border-gray-300 font-mono shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                placeholder="1234567890"
                                            />
                                        </FormField>

                                        <FormField label="Atas Nama" error={errors.bank_account_name}>
                                            <input
                                                type="text"
                                                value={form.bank_account_name}
                                                onChange={(e) => update('bank_account_name', e.target.value)}
                                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                placeholder="Nama rekening"
                                            />
                                        </FormField>
                                    </div>
                                </div>

                                {/* Notes */}
                                <div className="border-t border-gray-100 pt-6">
                                    <FormField label="Catatan" error={errors.notes}>
                                        <textarea
                                            value={form.notes}
                                            onChange={(e) => update('notes', e.target.value)}
                                            rows={3}
                                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                            placeholder="Catatan tambahan mengenai supplier..."
                                        />
                                    </FormField>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-6">
                                    <Button
                                        variant="outline"
                                        onClick={() => router.get('/suppliers')}
                                        disabled={loading}
                                    >
                                        Batal
                                    </Button>
                                    <Button
                                        type="submit"
                                        loading={loading}
                                    >
                                        {isEditing ? 'Simpan Perubahan' : 'Simpan Supplier'}
                                    </Button>
                                </div>
                            </form>
                        </Card>
                    </div>
                </div>
            </AuthenticatedLayout>
        );
    }
