import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';
import { useProjects } from '@/hooks/useProjects';

export default function CreatePO() {
    const { projects } = useProjects();
    const [rabBudgets, setRabBudgets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [selectedProject, setSelectedProject] = useState('');
    const [sourcePos, setSourcePos] = useState([]);
    const api = useApi();

    const { data, setData, post, processing, errors, reset } = useForm({
        project_id: '',
        parent_po_id: '',
        po_number: 'PO-' + Math.floor(Math.random() * 100000),
        po_level: 'PROJECT',
        date: new Date().toISOString().split('T')[0],
        supplier_name: '',
        supplier_address: '',
        supplier_phone: '',
        supplier_contact_person: '',
        payment_terms: '',
        jadwal_kirim: '',
        discount: 0,
        include_ppn: true,
        catatan: '',
        items: []
    });

    const isProjectLevel = data.po_level === 'PROJECT';

    useEffect(() => {
        if (selectedProject) {
            Promise.all([
                api.get(`/api/projects/${selectedProject}`, {}, { silent: true }),
                api.get('/api/pos', { project_id: selectedProject, per_page: 100 }, { silent: true }),
            ]).then(([projectRes, poRes]) => {
                setRabBudgets(projectRes.data?.rab_budgets || projectRes.rab_budgets || []);
                const pos = poRes.data || poRes || [];
                setSourcePos(pos.filter((po) => po.po_level === 'PROJECT' && po.status === 'ROUTED' && po.routed_to === 'PURCHASE_ORDER' && !(po.child_purchase_orders || []).length));
            }).catch(() => { setSourcePos([]); });
        }
    }, [selectedProject]);

    const handleProjectChange = (e) => {
        setSelectedProject(e.target.value);
        setData('project_id', e.target.value);
        setData('parent_po_id', '');
        setData('items', []);
    };

    const selectSourcePo = (poId) => {
        setData('parent_po_id', poId);
        const source = sourcePos.find((po) => String(po.id) === String(poId));
        setData('items', (source?.items || []).map((item) => ({
            rab_budget_id: item.rab_budget_id,
            item_name: item.item_name,
            qty: Number(item.qty),
            unit_price: 0,
            total_price: 0,
        })));
    };

    const addItem = () => {
        setData('items', [...data.items, { rab_budget_id: '', item_name: '', qty: 1, unit_price: 0, total_price: 0 }]);
    };

    const updateItem = (index, field, value) => {
        const newItems = [...data.items];

        if (field === 'rab_budget_id') {
            const selectedRab = rabBudgets.find(r => r.id === parseInt(value));
            if (selectedRab) {
                newItems[index] = {
                    ...newItems[index],
                    rab_budget_id: value,
                    item_name: selectedRab.description,
                    unit_price: isProjectLevel ? 0 : selectedRab.unit_price,
                    total_price: isProjectLevel ? 0 : (newItems[index].qty * selectedRab.unit_price)
                };
            } else {
                newItems[index] = { ...newItems[index], [field]: value };
            }
        } else if (field === 'qty') {
            newItems[index] = {
                ...newItems[index],
                qty: parseInt(value) || 0,
                total_price: isProjectLevel ? 0 : ((parseInt(value) || 0) * newItems[index].unit_price)
            };
        } else if (field === 'unit_price') {
            const price = parseFloat(value) || 0;
            newItems[index] = {
                ...newItems[index],
                unit_price: price,
                total_price: newItems[index].qty * price
            };
        } else {
            newItems[index] = { ...newItems[index], [field]: value };
        }

        setData('items', newItems);
    };

    const removeItem = (index) => {
        setData('items', data.items.filter((_, i) => i !== index));
    };

    const subtotal = data.items.reduce((sum, item) => sum + (isProjectLevel ? 0 : (item.total_price || 0)), 0);
    const discountAmount = parseFloat(data.discount) || 0;
    const afterDiscount = subtotal - discountAmount;
    const tax = data.include_ppn ? afterDiscount * 0.11 : 0;
    const grandTotal = afterDiscount + tax;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            const payload = { ...data };
            if (isProjectLevel) {
                // Strip pricing for project-level PO
                delete payload.supplier_name;
                delete payload.supplier_address;
                delete payload.supplier_phone;
                delete payload.supplier_contact_person;
                delete payload.payment_terms;
                delete payload.discount;
                delete payload.include_ppn;
                delete payload.catatan;
                payload.items = payload.items.map(item => ({
                    rab_budget_id: item.rab_budget_id,
                    item_name: item.item_name,
                    qty: item.qty,
                }));
            }

            await api.post('/api/pos', payload);
            setMessage('PO berhasil dibuat!');
            reset();
            setData('items', []);
        } catch (err) {
            setMessage('Gagal membuat PO. Periksa kembali data Anda.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800">
                    Buat Purchase Order Baru
                </h2>
            }
        >
            <Head title="Buat PO" />

            <div className="py-12">
                <div className="mx-auto max-w-4xl sm:px-6 lg:px-8">
                    <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg">
                        <div className="p-6 text-gray-900">
                            {message && (
                                <div className={`p-4 mb-4 rounded ${message.includes('berhasil') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {message}
                                </div>
                            )}

                            <form onSubmit={handleSubmit}>
                                {/* PO Level Selector */}
                                <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                                    <label className="block text-sm font-medium text-gray-700 mb-3">Tipe PO</label>
                                    <div className="flex gap-4">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setData('po_level', 'PROJECT');
                                                setData('parent_po_id', '');
                                                setData('items', []);
                                            }}
                                            className={`flex-1 p-4 rounded-lg border-2 text-center transition-colors ${
                                                isProjectLevel
                                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                            }`}
                                        >
                                            <div className="text-lg font-bold">PO Proyek</div>
                                            <div className="text-sm mt-1">Input lapangan — item + qty saja, tanpa harga</div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setData('po_level', 'SUPPLIER');
                                                setData('parent_po_id', '');
                                                setData('items', []);
                                            }}
                                            className={`flex-1 p-4 rounded-lg border-2 text-center transition-colors ${
                                                !isProjectLevel
                                                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                                                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                            }`}
                                        >
                                            <div className="text-lg font-bold">PO Supplier</div>
                                            <div className="text-sm mt-1">Input purchasing — lengkap dengan harga + supplier</div>
                                        </button>
                                    </div>
                                </div>

                                {/* Common Fields */}
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Proyek</label>
                                        <select 
                                            required
                                            value={selectedProject}
                                            onChange={handleProjectChange}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                        >
                                            <option value="">-- Pilih Proyek --</option>
                                            {projects.map(p => (
                                                <option key={p.id} value={p.id}>{p.project_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Nomor PO</label>
                                        <input type="text" value={data.po_number} onChange={e => setData('po_number', e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Tanggal</label>
                                        <input type="date" value={data.date} onChange={e => setData('date', e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                                    </div>
                                </div>

                                {/* Supplier Fields — only for SUPPLIER level */}
                                {!isProjectLevel && (
                                    <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                                        <h4 className="text-sm font-bold text-purple-700 mb-3">Informasi Supplier</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2">
                                                <label className="block text-sm font-medium text-gray-700">PO Proyek sumber *</label>
                                                <select value={data.parent_po_id} onChange={(e) => selectSourcePo(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm">
                                                    <option value="">-- Pilih PO yang sudah diarahkan Engineer --</option>
                                                    {sourcePos.map((po) => <option key={po.id} value={po.id}>{po.po_number}</option>)}
                                                </select>
                                                {!sourcePos.length && <p className="mt-1 text-xs text-amber-700">Belum ada PO Proyek yang diarahkan Engineer ke PO Supplier.</p>}
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Nama Supplier *</label>
                                                <input type="text" value={data.supplier_name} onChange={e => setData('supplier_name', e.target.value)} required={!isProjectLevel} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Kontak Person</label>
                                                <input type="text" value={data.supplier_contact_person} onChange={e => setData('supplier_contact_person', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Alamat Supplier</label>
                                                <input type="text" value={data.supplier_address} onChange={e => setData('supplier_address', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Telepon Supplier</label>
                                                <input type="text" value={data.supplier_phone} onChange={e => setData('supplier_phone', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Termin Pembayaran</label>
                                                <input type="text" value={data.payment_terms} onChange={e => setData('payment_terms', e.target.value)} placeholder="Contoh: 30 hari" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Jadwal Pengiriman *</label>
                                                <input type="date" value={data.jadwal_kirim} onChange={e => setData('jadwal_kirim', e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Items */}
                                <div className="mb-6">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="text-md font-bold">Item PO</h4>
                                        <button type="button" onClick={addItem} className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">
                                            + Tambah Item
                                        </button>
                                    </div>

                                    {data.items.length === 0 ? (
                                        <p className="text-gray-500 text-sm">Belum ada item. Klik "Tambah Item" untuk menambah.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {data.items.map((item, index) => (
                                                <div key={index} className="p-4 bg-gray-50 rounded-lg border">
                                                    <div className={`grid gap-3 ${isProjectLevel ? 'grid-cols-3' : 'grid-cols-5'}`}>
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-500">Item RAB</label>
                                                            <select
                                                                value={item.rab_budget_id}
                                                                onChange={e => updateItem(index, 'rab_budget_id', e.target.value)}
                                                                required
                                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                            >
                                                                <option value="">-- Pilih --</option>
                                                                {rabBudgets.map(rab => (
                                                                    <option key={rab.id} value={rab.id}>{rab.code_item} - {rab.description}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-500">Qty</label>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={item.qty}
                                                                onChange={e => updateItem(index, 'qty', e.target.value)}
                                                                required
                                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                            />
                                                        </div>
                                                        {!isProjectLevel && (
                                                            <>
                                                                <div>
                                                                    <label className="block text-xs font-medium text-gray-500">Harga Satuan</label>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        value={item.unit_price}
                                                                        onChange={e => updateItem(index, 'unit_price', e.target.value)}
                                                                        required
                                                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-medium text-gray-500">Total</label>
                                                                    <div className="mt-2 text-sm font-medium">Rp {(item.total_price || 0).toLocaleString('id-ID')}</div>
                                                                </div>
                                                            </>
                                                        )}
                                                        <div className="flex items-end">
                                                            <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700 text-sm">
                                                                Hapus
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Pricing Summary — only for SUPPLIER level */}
                                {!isProjectLevel && data.items.length > 0 && (
                                    <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                                        <h4 className="text-sm font-bold text-indigo-700 mb-3">Ringkasan Harga</h4>
                                        <div className="grid grid-cols-2 gap-4 mb-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500">Diskon (Rp)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={data.discount}
                                                    onChange={e => setData('discount', e.target.value)}
                                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                />
                                            </div>
                                            <div className="flex items-center pt-5">
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={data.include_ppn}
                                                        onChange={e => setData('include_ppn', e.target.checked)}
                                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-sm text-gray-700">Termasuk PPN (11%)</span>
                                                </label>
                                            </div>
                                        </div>
                                        <div className="flex justify-between py-1 text-sm">
                                            <span>Subtotal:</span>
                                            <span>Rp {subtotal.toLocaleString('id-ID')}</span>
                                        </div>
                                        <div className="flex justify-between py-1 text-sm">
                                            <span>Diskon:</span>
                                            <span>- Rp {discountAmount.toLocaleString('id-ID')}</span>
                                        </div>
                                        <div className="flex justify-between py-1 text-sm">
                                            <span>PPN:</span>
                                            <span>Rp {tax.toLocaleString('id-ID')}</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-t mt-2">
                                            <span className="text-base font-bold">Grand Total:</span>
                                            <span className="text-base font-bold text-indigo-700">Rp {grandTotal.toLocaleString('id-ID')}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Project Level Summary */}
                                {isProjectLevel && data.items.length > 0 && (
                                    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                        <h4 className="text-sm font-bold text-blue-700">Ringkasan PO Proyek</h4>
                                        <p className="text-sm text-gray-600 mt-1">Total {data.items.length} item — PO ini akan diteruskan ke purchasing untuk pengisian harga supplier.</p>
                                    </div>
                                )}

                                <div className="flex justify-between">
                                    <a href={route("po")} className="bg-gray-500 text-white px-6 py-2 rounded shadow hover:bg-gray-600">
                                        Kembali
                                    </a>
                                    <button 
                                        type="submit" 
                                        disabled={loading || data.items.length === 0}
                                        className="bg-green-600 text-white px-6 py-2 rounded shadow hover:bg-green-700 disabled:opacity-50"
                                    >
                                        {loading ? 'Menyimpan...' : 'Simpan Draft PO'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
