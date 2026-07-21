import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head } from "@inertiajs/react";
import { useState, useEffect } from "react";
import { useApi } from "@/hooks/useApi";

export default function GoodsReceipt() {
    const [receipts, setReceipts] = useState([]);
    const [pos, setPos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [message, setMessage] = useState("");
    const api = useApi();

    const [form, setForm] = useState({
        purchase_order_id: "",
        receipt_number: "GR-" + Math.floor(Math.random() * 100000),
        receipt_date: new Date().toISOString().split("T")[0],
        delivery_note_number: "",
        receiver_name: "",
        notes: "",
        items: [],
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [grData, poData] = await Promise.all([
                api.get("/api/goods-receipts", {}, { silent: true }),
                api.get("/api/pos", {}, { silent: true }),
            ]);
            setReceipts(grData.data || grData);
            setPos(poData.data || poData);
        } catch (err) {
            // errors logged silently
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const items = form.items.filter(
            (item) => Number(item.quantity_received) > 0,
        );

        if (!items.length) {
            setMessage(
                "Masukkan jumlah untuk setidaknya satu item yang diterima.",
            );
            return;
        }

        try {
            const res = await api.post("/api/goods-receipts", {
                ...form,
                items,
            });
            setMessage(res.message || "Penerimaan barang berhasil dicatat.");
            setShowForm(false);
            await loadData();
            setForm({
                ...form,
                receipt_number: "GR-" + Math.floor(Math.random() * 100000),
                delivery_note_number: "",
                receiver_name: "",
                notes: "",
                purchase_order_id: "",
                items: [],
            });
        } catch (err) {
            setMessage(
                err.response?.data?.message || "Gagal mencatat penerimaan.",
            );
        }
    };

    const receivablePos = pos.filter((po) => po.status === "APPROVED");
    const partiallyReceivablePos = pos.filter(
        (po) => po.status === "PARTIALLY_RECEIVED",
    );
    const availablePos = [...receivablePos, ...partiallyReceivablePos];
    const selectedPo = availablePos.find(
        (p) => p.id === parseInt(form.purchase_order_id),
    );
    const receivedQuantity = (poItemId) =>
        receipts.reduce(
            (total, receipt) =>
                total +
                (receipt.items || [])
                    .filter((item) => item.po_item_id === poItemId)
                    .reduce(
                        (subtotal, item) =>
                            subtotal + Number(item.quantity_received || 0),
                        0,
                    ),
            0,
        );

    const selectPo = (poId) => {
        const po = availablePos.find((item) => item.id === Number(poId));
        setForm({
            ...form,
            purchase_order_id: poId,
            items: (po?.items || []).map((item) => ({
                po_item_id: item.id,
                // Default kuantitas menjadi 0 untuk memaksa user input manual
                quantity_received: 0,
            })),
        });
    };

    const setReceivedQuantity = (poItemId, value) => {
        // Handle hapus angka agar field bisa dikosongkan secara visual sebelum diketik
        const val = value === "" ? "" : Number(value);
        setForm({
            ...form,
            items: form.items.map((item) =>
                item.po_item_id === poItemId
                    ? { ...item, quantity_received: val }
                    : item,
            ),
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800">
                    Penerimaan Barang
                </h2>
            }
        >
            <Head title="Penerimaan Barang" />

            <div className="py-12">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8 space-y-6">
                    {message && (
                        <div className="p-4 bg-green-100 text-green-700 rounded shadow">
                            {message}
                        </div>
                    )}

                    {/* Form Penerimaan */}
                    <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold">
                                    Catat Penerimaan Barang Baru
                                </h3>
                                <button
                                    onClick={() => setShowForm(!showForm)}
                                    className="bg-emerald-600 text-white px-4 py-2 rounded shadow hover:bg-emerald-700"
                                >
                                    {showForm
                                        ? "Tutup Form"
                                        : "+ Terima Barang"}
                                </button>
                            </div>

                            {showForm && (
                                <form
                                    onSubmit={handleSubmit}
                                    className="space-y-4 mt-4 border-t pt-4"
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">
                                                Pilih PO (Purchase Order)
                                            </label>
                                            <select
                                                required
                                                value={form.purchase_order_id}
                                                onChange={(e) =>
                                                    selectPo(e.target.value)
                                                }
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                            >
                                                <option value="">
                                                    -- Pilih PO --
                                                </option>
                                                {availablePos.map((po) => (
                                                    <option
                                                        key={po.id}
                                                        value={po.id}
                                                    >
                                                        {po.po_number} —{" "}
                                                        {po.supplier_name} (
                                                        {po.status})
                                                    </option>
                                                ))}
                                            </select>
                                            {!availablePos.length && (
                                                <p className="mt-1 text-xs text-amber-700">
                                                    Belum ada PO yang sudah
                                                    disetujui dan siap diterima.
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">
                                                No. Penerimaan
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={form.receipt_number}
                                                onChange={(e) =>
                                                    setForm({
                                                        ...form,
                                                        receipt_number:
                                                            e.target.value,
                                                    })
                                                }
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">
                                                Tanggal Terima
                                            </label>
                                            <input
                                                type="date"
                                                required
                                                value={form.receipt_date}
                                                onChange={(e) =>
                                                    setForm({
                                                        ...form,
                                                        receipt_date:
                                                            e.target.value,
                                                    })
                                                }
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">
                                                No. Surat Jalan
                                            </label>
                                            <input
                                                type="text"
                                                value={
                                                    form.delivery_note_number
                                                }
                                                onChange={(e) =>
                                                    setForm({
                                                        ...form,
                                                        delivery_note_number:
                                                            e.target.value,
                                                    })
                                                }
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
                                                placeholder="SJ-xxx"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">
                                                Nama Penerima (di Lapangan)
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={form.receiver_name}
                                                onChange={(e) =>
                                                    setForm({
                                                        ...form,
                                                        receiver_name:
                                                            e.target.value,
                                                    })
                                                }
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
                                            />
                                        </div>
                                    </div>

                                    {selectedPo && (
                                        <div className="bg-blue-50 p-3 rounded text-sm">
                                            <strong>Detail PO:</strong>{" "}
                                            {selectedPo.po_number} | Supplier:{" "}
                                            {selectedPo.supplier_name} | Items:{" "}
                                            {selectedPo.items?.length || 0}{" "}
                                            barang | Total: Rp{" "}
                                            {Number(
                                                selectedPo.total_amount,
                                            ).toLocaleString("id-ID")}
                                        </div>
                                    )}

                                    {selectedPo && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">
                                                Jumlah Barang Diterima
                                            </label>
                                            <div className="mt-1 overflow-hidden rounded border border-gray-200">
                                                {(selectedPo.items || []).map(
                                                    (item) => {
                                                        const received =
                                                            receivedQuantity(
                                                                item.id,
                                                            );
                                                        const remaining =
                                                            Math.max(
                                                                0,
                                                                Number(
                                                                    item.qty,
                                                                ) - received,
                                                            );
                                                        const formItem =
                                                            form.items.find(
                                                                (entry) =>
                                                                    entry.po_item_id ===
                                                                    item.id,
                                                            );
                                                        return (
                                                            <div
                                                                key={item.id}
                                                                className="grid grid-cols-[1fr_130px] gap-4 border-b border-gray-100 p-3 last:border-b-0"
                                                            >
                                                                <div>
                                                                    <p className="font-medium text-gray-900">
                                                                        {
                                                                            item.item_name
                                                                        }
                                                                    </p>
                                                                    <p className="text-xs text-gray-500">
                                                                        PO:{" "}
                                                                        {
                                                                            item.qty
                                                                        }{" "}
                                                                        · Sudah
                                                                        diterima:{" "}
                                                                        {
                                                                            received
                                                                        }{" "}
                                                                        · Sisa:{" "}
                                                                        {
                                                                            remaining
                                                                        }
                                                                    </p>
                                                                </div>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max={
                                                                        remaining
                                                                    }
                                                                    step="0.01"
                                                                    value={
                                                                        formItem?.quantity_received ===
                                                                        0
                                                                            ? ""
                                                                            : formItem?.quantity_received
                                                                    }
                                                                    onChange={(
                                                                        event,
                                                                    ) =>
                                                                        setReceivedQuantity(
                                                                            item.id,
                                                                            event
                                                                                .target
                                                                                .value,
                                                                        )
                                                                    }
                                                                    className="w-full rounded border-gray-300"
                                                                    aria-label={`Jumlah diterima ${item.item_name}`}
                                                                    placeholder="0"
                                                                />
                                                            </div>
                                                        );
                                                    },
                                                )}
                                            </div>
                                            <p className="mt-1 text-xs text-gray-500">
                                                Ketikkan jumlah aktual yang Anda
                                                terima secara fisik di lapangan.
                                            </p>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            Catatan
                                        </label>
                                        <textarea
                                            value={form.notes}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    notes: e.target.value,
                                                })
                                            }
                                            rows="2"
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
                                            placeholder="Kondisi barang, catatan khusus..."
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        className="bg-indigo-600 text-white px-6 py-2 rounded shadow hover:bg-indigo-700"
                                    >
                                        Simpan Penerimaan
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>

                    {/* Tabel Riwayat Penerimaan */}
                    <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg">
                        <div className="p-6">
                            <h3 className="text-lg font-bold mb-4">
                                Riwayat Penerimaan Barang
                            </h3>
                            {loading ? (
                                <p>Memuat data...</p>
                            ) : (
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                No. Penerimaan
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                No. PO
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                Proyek
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                Barang Diterima
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                No. Surat Jalan
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                Penerima
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                Tanggal
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {receipts.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan="7"
                                                    className="px-6 py-4 text-center text-sm text-gray-500"
                                                >
                                                    Belum ada data penerimaan.
                                                </td>
                                            </tr>
                                        ) : (
                                            receipts.map((gr, idx) => (
                                                <tr key={idx}>
                                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                                        {gr.receipt_number}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500">
                                                        {gr.purchase_order
                                                            ?.po_number ?? "-"}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500">
                                                        {gr.purchase_order
                                                            ?.project
                                                            ?.project_name ??
                                                            "-"}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500">
                                                        <ul className="list-disc list-inside space-y-0.5">
                                                            {(
                                                                gr.items || []
                                                            ).map(
                                                                (
                                                                    item,
                                                                    idx2,
                                                                ) => (
                                                                    <li
                                                                        key={
                                                                            idx2
                                                                        }
                                                                        className="text-xs text-gray-700"
                                                                    >
                                                                        {item
                                                                            .po_item
                                                                            ?.item_name ||
                                                                            "Barang"}
                                                                        :{" "}
                                                                        <strong className="text-emerald-700">
                                                                            {Number(
                                                                                item.quantity_received,
                                                                            ).toLocaleString(
                                                                                "id-ID",
                                                                            )}
                                                                        </strong>
                                                                    </li>
                                                                ),
                                                            )}
                                                        </ul>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500">
                                                        {gr.delivery_note_number ||
                                                            "-"}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500">
                                                        {gr.receiver_name}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500">
                                                        {gr.receipt_date}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
