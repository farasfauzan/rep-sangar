import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '@/Components/ui/Toast';
import Card from '@/Components/ui/Card';
import Button from '@/Components/ui/Button';
import FormField from '@/Components/ui/FormField';
import PageHeader from '@/Components/ui/PageHeader';
import LoadingSpinner from '@/Components/ui/LoadingSpinner';

export default function PurchaseOrderEdit() {
    const [po, setPo] = useState(null);
    const [projects, setProjects] = useState([]);
    const [rabBudgets, setRabBudgets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedProject, setSelectedProject] = useState('');

    const [form, setForm] = useState({
        supplier_name: '',
        project_id: '',
        payment_terms: '',
        notes: '',
        items: [],
    });

    const [errors, setErrors] = useState({});

    const toast = useToast();
    const poId = window.location.pathname.split('/')[2]; // /purchase-orders/{id}/edit

    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        if (selectedProject) {
            axios.get(`/api/projects/${selectedProject}`).then(res => {
                setRabBudgets(res.data.rab_budgets || []);
            });
        }
    }, [selectedProject]);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const [poRes, projectsRes] = await Promise.all([
                axios.get(`/api/purchase-orders/${poId}`),
                axios.get('/api/projects'),
            ]);

            const poData = poRes.data;
            if (poData.status !== 'DRAFT') {
                toast.error('Hanya PO berstatus DRAFT yang bisa diedit.');
                window.location.href = `/purchase-orders/${poId}`;
                return;
            }

            setPo(poData);
            setProjects(projectsRes.data || []);

            setSelectedProject(poData.project_id);

            setForm({
                supplier_name: poData.supplier_name || '',
                project_id: poData.project_id || '',
                payment_terms: poData.payment_terms || '',
                notes: poData.notes || '',
                items: (poData.items || []).map(item => ({
                    rab_budget_id: item.rab_budget_id || '',
                    item_name: item.item_name || item.rab_budget?.description || '',
                    qty: Number(item.qty) || 1,
                    unit_price: Number(item.unit_price) || 0,
                    total_price: Number(item.total_price) || (Number(item.qty) * Number(item.unit_price)),
                })),
            });
        } catch (err) {
            toast.error('Gagal memuat data PO.');
            window.location.href = '/po';
        } finally {
            setLoading(false);
        }
    };

    const handleProjectChange = (e) => {
        const value = e.target.value;
        setSelectedProject(value);
        setForm(prev => ({ ...prev, project_id: value }));
    };

    const updateField = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
        setErrors(prev => ({ ...prev, [field]: null }));
    };

    const addItem = () => {
        setForm(prev => ({
            ...prev,
            items: [...prev.items, { rab_budget_id: '', item_name: '', qty: 1, unit_price: 0, total_price: 0 }],
        }));
    };

    const updateItem = (index, field, value) => {
        setForm(prev => {
            const newItems = [...prev.items];

            if (field === 'rab_budget_id') {
                const selectedRab = rabBudgets.find(r => r.id === parseInt(value));
                if (selectedRab) {
                    newItems[index] = {
                        ...newItems[index],
                        rab_budget_id: selectedRab.id,
                        item_name: selectedRab.description,
                        unit_price: Number(selectedRab.unit_price) || 0,
                        total_price: Number(newItems[index].qty) * (Number(selectedRab.unit_price) || 0),
                    };
                } else {
                    newItems[index] = { ...newItems[index], rab_budget_id: value };
                }
            } else {
                const numValue = field === 'qty' || field === 'unit_price' ? Number(value) || 0 : value;
                newItems[index] = {
                    ...newItems[index],
                    [field]: numValue,
                    ...(field === 'qty' || field === 'unit_price'
                        ? { total_price: (field === 'qty' ? numValue : Number(newItems[index].qty)) * (field === 'unit_price' ? numValue : Number(newItems[index].unit_price)) }
                        : {}),
                };
            }

            return { ...prev, items: newItems };
        });
    };

    const removeItem = (index) => {
        setForm(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index),
        }));
    };

    const subtotal = form.items.reduce((sum, item) => sum + (item.total_price || 0), 0);
    const ppn = subtotal * 0.11;
    const grandTotal = subtotal + ppn;

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (form.items.length === 0) {
            toast.error('Tambahkan minimal satu item.');
            return;
        }

        setSaving(true);
        setErrors({});

        try {
            await axios.put(`/api/purchase-orders/${poId}`, form);
            toast.success('PO berhasil diperbarui.');
            window.location.href = `/purchase-orders/${poId}`;
        } catch (err) {
            if (err.response?.status === 422) {
                setErrors(err.response.data.errors || {});
                toast.error('Terdapat kesalahan pada form. Silakan periksa kembali.');
            } else {
                toast.error(err.response?.data?.message || 'Gagal menyimpan perubahan.');
            }
        } finally {
            setSaving(false);
        }
    };

    const formatCurrency = (amount) => `Rp ${Number(amount || 0).toLocaleString('id-ID')}`;

    if (loading) {
        return (
            <AuthenticatedLayout header={<h2 className="text-xl font-semibold leading-tight text-gray-800">Edit Purchase Order</h2>}>
                <Head title="Edit PO" />
                <div className="py-12 flex justify-center">
                    <LoadingSpinner message="Memuat data PO..." />
                </div>
            </AuthenticatedLayout>
        );
    }

    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold leading-tight text-gray-800">Edit Purchase Order</h2>}
        >
            <Head title={`Edit PO - ${po?.po_number}`} />

            <div className="py-12">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8 space-y-6">

                    <PageHeader
                        title={`Edit PO: ${po?.po_number}`}
                        subtitle="Ubah informasi Purchase Order yang masih berstatus Draft"
                        breadcrumbs={[
                            { label: 'Purchase Orders', href: '/po' },
                            { label: po?.po_number, href: `/purchase-orders/${poId}` },
                            { label: 'Edit' },
                        ]}
                    />

                    <form onSubmit={handleSubmit}>
                        {/* PO Header */}
                        <Card title="Informasi PO" className="mb-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField label="Nomor PO">
                                    <input
                                        type="text"
                                        value={po?.po_number || ''}
                                        disabled
                                        className="block w-full rounded-lg border-gray-200 bg-gray-50 shadow-sm sm:text-sm cursor-not-allowed"
                                    />
                                </FormField>

                                <FormField label="Tanggal">
                                    <input
                                        type="text"
                                        value={po?.date ? new Date(po.date).toLocaleDateString('id-ID') : ''}
                                        disabled
                                        className="block w-full rounded-lg border-gray-200 bg-gray-50 shadow-sm sm:text-sm cursor-not-allowed"
                                    />
                                </FormField>

                                <FormField label="Proyek" required error={errors.project_id}>
                                    <select
                                        required
                                        value={form.project_id}
                                        onChange={handleProjectChange}
                                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                    >
                                        <option value="">-- Pilih Proyek --</option>
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id}>{p.project_name}</option>
                                        ))}
                                    </select>
                                </FormField>

                                <FormField label="Supplier" required error={errors.supplier_name}>
                                    <input
                                        type="text"
                                        required
                                        value={form.supplier_name}
                                        onChange={e => updateField('supplier_name', e.target.value)}
                                        placeholder="Nama supplier"
                                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                    />
                                </FormField>

                                <FormField label="Syarat Pembayaran" error={errors.payment_terms}>
                                    <input
                                        type="text"
                                        value={form.payment_terms}
                                        onChange={e => updateField('payment_terms', e.target.value)}
                                        placeholder="Contoh: Net 30"
                                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                    />
                                </FormField>

                                <FormField label="Catatan" className="md:col-span-2" error={errors.notes}>
                                    <textarea
                                        rows={3}
                                        value={form.notes}
                                        onChange={e => updateField('notes', e.target.value)}
                                        placeholder="Catatan tambahan..."
                                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                    />
                                </FormField>
                            </div>
                        </Card>

                        {/* Items */}
                        <Card
                            title="Item Barang"
                            actions={
                                <Button variant="primary" size="sm" onClick={addItem} type="button">
                                    + Tambah Baris
                                </Button>
                            }
                            className="mb-6"
                        >
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item RAB</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">Qty</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-40">Harga Satuan</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-40">Subtotal</th>
                                            <th className="px-4 py-3 w-12"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {form.items.map((item, index) => (
                                            <tr key={index} className="hover:bg-gray-50">
                                                <td className="p-2">
                                                    <select
                                                        required
                                                        value={item.rab_budget_id}
                                                        onChange={e => updateItem(index, 'rab_budget_id', e.target.value)}
                                                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                    >
                                                        <option value="">Pilih Item...</option>
                                                        {rabBudgets.map(rab => (
                                                            <option key={rab.id} value={rab.id}>
                                                                {rab.code_item} - {rab.description} (Vol: {rab.volume} {rab.unit})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="p-2">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0.01"
                                                        required
                                                        value={item.qty}
                                                        onChange={e => updateItem(index, 'qty', e.target.value)}
                                                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        required
                                                        value={item.unit_price}
                                                        onChange={e => updateItem(index, 'unit_price', e.target.value)}
                                                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                    />
                                                </td>
                                                <td className="p-2 text-sm font-medium text-gray-900">
                                                    {formatCurrency(item.total_price)}
                                                </td>
                                                <td className="p-2 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(index)}
                                                        className="text-red-500 hover:text-red-700 font-bold text-lg"
                                                        title="Hapus item"
                                                    >
                                                        ×
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {form.items.length === 0 && (
                                            <tr>
                                                <td colSpan="5" className="px-4 py-8 text-center text-sm text-gray-500">
                                                    Belum ada item. Klik "Tambah Baris" untuk menambahkan.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Totals */}
                            <div className="flex justify-end mt-6 pt-4 border-t border-gray-100">
                                <div className="w-72 space-y-1">
                                    <div className="flex justify-between py-1">
                                        <span className="text-sm text-gray-600">Subtotal:</span>
                                        <span className="text-sm font-semibold">{formatCurrency(subtotal)}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-gray-200">
                                        <span className="text-sm text-gray-600">PPN 11%:</span>
                                        <span className="text-sm font-semibold">{formatCurrency(ppn)}</span>
                                    </div>
                                    <div className="flex justify-between py-2">
                                        <span className="text-base font-bold text-gray-900">Grand Total:</span>
                                        <span className="text-base font-bold text-indigo-700">{formatCurrency(grandTotal)}</span>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Submit */}
                        <div className="flex items-center justify-end gap-3">
                            <Button
                                variant="outline"
                                type="button"
                                onClick={() => window.location.href = `/purchase-orders/${poId}`}
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                loading={saving}
                                disabled={form.items.length === 0}
                            >
                                Simpan Perubahan
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
