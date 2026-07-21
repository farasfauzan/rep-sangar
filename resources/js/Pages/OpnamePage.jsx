import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head } from "@inertiajs/react";
import { useState, useEffect } from "react";
import { useApi } from "@/hooks/useApi";

export default function OpnamePage() {
    const [opnames, setOpnames] = useState([]);
    const [spks, setSpks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [message, setMessage] = useState("");
    const api = useApi();

    const [form, setForm] = useState({
        spk_id: "",
        opname_number: "OPN-" + Math.floor(Math.random() * 100000),
        date: new Date().toISOString().split("T")[0],
        progress_percentage: "",
        // amount dihapus dari form state karena dihitung otomatis oleh backend
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [opnData, spkData] = await Promise.all([
                api.get("/api/opnames", {}, { silent: true }),
                api.get("/api/spks", {}, { silent: true }),
            ]);
            setOpnames(opnData.data || opnData);
            setSpks(spkData.data || spkData);
        } catch (err) {
            // errors logged silently
        } finally {
            setLoading(false);
        }
    };

    const approvedSpks = spks.filter((spk) => spk.status === "APPROVED");
    const selectedSpk = approvedSpks.find(
        (s) => s.id === parseInt(form.spk_id),
    );

    // Perhitungan estimasi nominal hanya untuk UI/UX
    const pct = parseFloat(form.progress_percentage) || 0;
    const estimatedAmount = selectedSpk
        ? Math.round((pct / 100) * selectedSpk.total_amount)
        : 0;

    const handlePercentageChange = (val) => {
        setForm({ ...form, progress_percentage: val });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post("/api/opnames", form);
            setMessage(res.message || "Opname berhasil dicatat.");
            setShowForm(false);
            await loadData();
            setForm({
                ...form,
                opname_number: "OPN-" + Math.floor(Math.random() * 100000),
                spk_id: "",
                progress_percentage: "",
            });
        } catch (err) {
            setMessage(err.response?.data?.message || "Gagal mencatat opname.");
        }
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800">
                    Opname Pekerjaan (SPK)
                </h2>
            }
        >
            <Head title="Opname" />

            <div className="py-12">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8 space-y-6">
                    {message && (
                        <div className="p-4 bg-green-100 text-green-700 rounded shadow">
                            {message}
                        </div>
                    )}

                    {/* Form Opname */}
                    <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold">
                                    Catat Opname Progres Baru
                                </h3>
                                <button
                                    onClick={() => setShowForm(!showForm)}
                                    className="bg-amber-600 text-white px-4 py-2 rounded shadow hover:bg-amber-700"
                                >
                                    {showForm ? "Tutup Form" : "+ Opname Baru"}
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
                                                Pilih SPK
                                            </label>
                                            <select
                                                required
                                                value={form.spk_id}
                                                onChange={(e) => {
                                                    setForm({
                                                        ...form,
                                                        spk_id: e.target.value,
                                                    });
                                                }}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                            >
                                                <option value="">
                                                    -- Pilih SPK --
                                                </option>
                                                {approvedSpks.map((s) => (
                                                    <option
                                                        key={s.id}
                                                        value={s.id}
                                                    >
                                                        {s.spk_number} —{" "}
                                                        {s.subcon_name} (Rp{" "}
                                                        {Number(
                                                            s.total_amount,
                                                        ).toLocaleString(
                                                            "id-ID",
                                                        )}
                                                        )
                                                    </option>
                                                ))}
                                            </select>
                                            {!approvedSpks.length && (
                                                <p className="mt-1 text-xs text-amber-700">
                                                    Belum ada SPK yang
                                                    disetujui.
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">
                                                No. Opname
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={form.opname_number}
                                                onChange={(e) =>
                                                    setForm({
                                                        ...form,
                                                        opname_number:
                                                            e.target.value,
                                                    })
                                                }
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">
                                                Tanggal Opname
                                            </label>
                                            <input
                                                type="date"
                                                required
                                                value={form.date}
                                                onChange={(e) =>
                                                    setForm({
                                                        ...form,
                                                        date: e.target.value,
                                                    })
                                                }
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">
                                                Progres (%)
                                            </label>
                                            <input
                                                type="number"
                                                required
                                                min="0.01"
                                                max="100"
                                                step="0.01"
                                                value={form.progress_percentage}
                                                onChange={(e) =>
                                                    handlePercentageChange(
                                                        e.target.value,
                                                    )
                                                }
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
                                            />
                                        </div>
                                    </div>

                                    {selectedSpk && (
                                        <div className="bg-amber-50 p-3 rounded text-sm space-y-1">
                                            <div>
                                                <strong>SPK:</strong>{" "}
                                                {selectedSpk.spk_number} |
                                                Subkon:{" "}
                                                {selectedSpk.subcon_name}
                                            </div>
                                            <div>
                                                <strong>
                                                    Nilai Kontrak (termasuk
                                                    PPN):
                                                </strong>{" "}
                                                Rp{" "}
                                                {Number(
                                                    selectedSpk.total_amount,
                                                ).toLocaleString("id-ID")}
                                            </div>
                                            <div>
                                                <strong>
                                                    Estimasi Klaim (
                                                    {form.progress_percentage ||
                                                        0}
                                                    %):
                                                </strong>{" "}
                                                <span className="text-lg font-bold text-amber-700">
                                                    Rp{" "}
                                                    {Number(
                                                        estimatedAmount,
                                                    ).toLocaleString("id-ID")}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        className="bg-indigo-600 text-white px-6 py-2 rounded shadow hover:bg-indigo-700"
                                    >
                                        Simpan Opname
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>

                    {/* Tabel Riwayat Opname */}
                    <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg">
                        <div className="p-6">
                            <h3 className="text-lg font-bold mb-4">
                                Riwayat Opname
                            </h3>
                            {loading ? (
                                <p>Memuat data...</p>
                            ) : (
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                No. Opname
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                SPK
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                Proyek
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                Progres
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                Nilai Klaim
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                Status
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                Tanggal
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {opnames.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan="7"
                                                    className="px-6 py-4 text-center text-sm text-gray-500"
                                                >
                                                    Belum ada data opname.
                                                </td>
                                            </tr>
                                        ) : (
                                            opnames.map((opn, idx) => (
                                                <tr key={idx}>
                                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                                        {opn.opname_number}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500">
                                                        {opn.spk?.spk_number ??
                                                            "-"}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500">
                                                        {opn.spk?.project
                                                            ?.project_name ??
                                                            "-"}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500">
                                                        {
                                                            opn.progress_percentage
                                                        }
                                                        %
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500">
                                                        Rp{" "}
                                                        {Number(
                                                            opn.amount,
                                                        ).toLocaleString(
                                                            "id-ID",
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm">
                                                        <span
                                                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${opn.status === "APPROVED" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}
                                                        >
                                                            {opn.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500">
                                                        {opn.date}
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
