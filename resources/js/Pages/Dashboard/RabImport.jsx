import { Fragment, useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { Card, Button, LoadingSpinner } from '@/Components/ui';

const fmt = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n ?? 0);

const MANUAL_CATEGORIES = [
    { value: 'Subkon', label: 'Subkon (jasa/borongan)' },
    { value: 'Material', label: 'Material' },
    { value: 'Pekerja', label: 'Pekerja / Upah' },
    { value: 'Alat', label: 'Alat' },
];

const CATEGORY_CELL_STYLES = {
    Subkon: 'border-red-200 bg-red-100 text-red-800',
    Material: 'border-blue-200 bg-blue-100 text-blue-800',
    Pekerja: 'border-sky-200 bg-sky-100 text-sky-800',
    Alat: 'border-violet-200 bg-violet-100 text-violet-800',
};

// This is a starting recommendation, not a final accounting decision. Every
// result remains editable in the spreadsheet-like preview before it is saved.
const classifyRabItem = (description = '', unit = '') => {
    const text = `${description} ${unit}`.toLowerCase();
    if (/\b(upah|tenaga kerja|tukang|mandor|pekerja|operator|mekanik|pengawas|ahli|petugas|konsultan|pelatihan|safety induction|safety briefing)\b/.test(text)) {
        return { category: 'Pekerja', group: 'Tenaga kerja' };
    }
    if (/\b(excavator|bulldozer|crane|forklift|genset|scaffolding|concrete pump|vibrator|welding machine|alat berat|perancah|tower crane|truck mixer|sewa alat|sewa peralatan)\b/.test(text)) {
        return { category: 'Alat', group: 'Alat & sewa peralatan' };
    }
    if (/\b(semen|beton|pasir|batu|kerikil|besi|baja|wiremesh|kawat|baut|mur|paku|plat|kabel|pipa|cat|kaca|aluminium|keramik|gypsum|triplek|kayu|bata|panel|lampu|saklar|mccb|trafo|cctv|helm|sepatu|sarung tangan|masker|rompi|apd|bahan|material)\b/.test(text)) {
        return { category: 'Material', group: 'Material proyek' };
    }
    return { category: 'Subkon', group: 'Paket pekerjaan' };
};

const excelColumnName = (number) => {
    let name = '';
    let current = number;
    while (current > 0) {
        const modulo = (current - 1) % 26;
        name = String.fromCharCode(65 + modulo) + name;
        current = Math.floor((current - 1) / 26);
    }
    return name;
};

function ExcelSheetGrid({ rows, rawData, sheet, savingRows, updateRow, saveRow, toggleAll }) {
    const viewportRef = useRef(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [selectedCell, setSelectedCell] = useState({ address: 'A1', value: '' });
    const [displayDensity, setDisplayDensity] = useState('comfortable');
    const comfortableView = displayDensity === 'comfortable';
    const rowHeight = comfortableView ? 46 : 34;
    const overscan = 12;

    useEffect(() => {
        setScrollTop(0);
        setSelectedCell({ address: 'A1', value: '' });
        const resetViewport = () => {
            if (!viewportRef.current) return;
            viewportRef.current.scrollTop = 0;
            viewportRef.current.scrollLeft = 0;
        };
        resetViewport();
        const frame = window.requestAnimationFrame(resetViewport);
        return () => window.cancelAnimationFrame(frame);
    }, [sheet, rawData]);

    const columns = rawData?.columns?.length ? rawData.columns : ['A', 'B', 'C', 'D', 'E', 'F'];
    const previewRows = useMemo(() => {
        if (!rawData?.rows) {
            return rows.map((row) => ({
                row_number: row.row_number,
                values: [row.code_item, row.description, row.unit, row.volume, row.unit_price, row.total_price],
            }));
        }
        const rawArray = Array.isArray(rawData.rows) ? rawData.rows : Object.values(rawData.rows);
        return rawArray.length ? rawArray : rows.map((row) => ({
            row_number: row.row_number,
            values: [row.code_item, row.description, row.unit, row.volume, row.unit_price, row.total_price],
        }));
    }, [rawData?.rows, rows]);
    const visibleColumns = useMemo(() => {
        const mappedColumns = rawData?.mappedColumns || [];
        if (mappedColumns.length) {
            const mappedIndexes = mappedColumns
                .map((column) => columns.indexOf(column))
                .filter((index) => index >= 0);
            if (mappedIndexes.length) {
                // Keep the original Excel columns up to the final business
                // field, but drop helper/formatting columns after it. This
                // puts Kategori directly after Total instead of after H-O.
                return columns.slice(0, Math.max(...mappedIndexes) + 1);
            }
        }
        let lastUsedIndex = columns.length - 1;
        while (lastUsedIndex > 0) {
            const isEmpty = previewRows.every((row) => {
                const value = Array.isArray(row.values)
                    ? row.values[lastUsedIndex]
                    : row.values?.[columns[lastUsedIndex]];
                return value === null || value === undefined || String(value).trim() === '';
            });
            if (!isEmpty) break;
            lastUsedIndex -= 1;
        }
        return columns.slice(0, lastUsedIndex + 1);
    }, [columns, previewRows, rawData?.mappedColumns]);
    const rowsByNumber = useMemo(
        () => new Map(rows.map((row) => [Number(row.row_number), row])),
        [rows],
    );
    const columnWidths = useMemo(() => visibleColumns.map((column, columnIndex) => {
        const longest = previewRows.slice(0, 120).reduce((length, row) => {
            const value = String(Array.isArray(row.values) ? (row.values[columnIndex] ?? '') : (row.values?.[visibleColumns[columnIndex]] ?? ''));
            return Math.max(length, value.length);
        }, 0);
        const fallbackFields = ['code', 'description', 'unit', 'qty', 'price', 'total'];
        const field = rawData?.columnMap?.[column]
            || (!rawData?.columns?.length ? fallbackFields[columnIndex] : null);
        const widthRange = {
            code: [72, 92],
            description: [260, 360],
            unit: [64, 80],
            qty: [72, 96],
            price: [104, 132],
            total: [112, 140],
        }[field] || [64, 140];

        const width = Math.max(widthRange[0], Math.min(widthRange[1], (longest * 6) + 18));
        return Math.round(width * (comfortableView ? 1.08 : 1));
    }), [visibleColumns, previewRows, rawData?.columnMap, rawData?.columns, comfortableView]);
    const categoryColumn = excelColumnName(visibleColumns.length + 1);
    const groupColumn = excelColumnName(visibleColumns.length + 2);
    const actionColumn = excelColumnName(visibleColumns.length + 3);
    const categoryWidth = comfortableView ? 240 : 220;
    const groupWidth = comfortableView ? 240 : 220;
    const actionWidth = comfortableView ? 132 : 124;
    const gridTemplateColumns = `56px ${columnWidths.map((width) => `${width}px`).join(' ')} ${categoryWidth}px ${groupWidth}px ${actionWidth}px`;
    const totalWidth = 56 + columnWidths.reduce((total, width) => total + width, 0) + categoryWidth + groupWidth + actionWidth;
    const visibleStart = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const visibleEnd = Math.min(previewRows.length, visibleStart + 55);
    const visibleRows = previewRows.slice(visibleStart, visibleEnd);
    const selectedCount = rows.filter((row) => row.selected).length;
    const allRowsSelected = rows.length > 0 && selectedCount === rows.length;
    const descriptionColumn = Object.entries(rawData?.columnMap || {}).find(([, field]) => field === 'description')?.[0];
    const detailColumns = Object.entries(rawData?.columnMap || {})
        .filter(([, field]) => ['unit', 'qty', 'price', 'total'].includes(field))
        .map(([column]) => column);

    const displayValue = (value) => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'number') return value.toLocaleString('id-ID');
        return String(value);
    };

    return (
        <>
            <div className="flex h-9 items-center border-b border-[#c7c7c7] bg-[#f8f9fa] text-xs text-gray-700">
                <div className="flex h-full w-24 shrink-0 items-center justify-center border-r border-[#c7c7c7] bg-white font-mono">{sheet || 'Sheet'}!{selectedCell.address}</div>
                <div className="flex h-full w-12 shrink-0 items-center justify-center border-r border-[#c7c7c7] font-serif text-sm italic">fx</div>
                <div className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap px-3">{selectedCell.value || `${previewRows.length} baris Excel terbaca`}</div>
                <div className="flex h-full shrink-0 items-center gap-1 border-l border-[#c7c7c7] px-2">
                    <span className="mr-1 text-[11px] text-gray-500">Ukuran</span>
                    <button type="button" onClick={() => setDisplayDensity('comfortable')} className={`rounded px-2 py-1 text-[11px] font-medium ${comfortableView ? 'bg-blue-100 text-blue-800' : 'text-gray-500 hover:bg-gray-100'}`}>Nyaman</button>
                    <button type="button" onClick={() => setDisplayDensity('compact')} className={`rounded px-2 py-1 text-[11px] font-medium ${!comfortableView ? 'bg-blue-100 text-blue-800' : 'text-gray-500 hover:bg-gray-100'}`}>Ringkas</button>
                    <button type="button" onClick={() => toggleAll(false)} disabled={selectedCount === 0} className="rounded px-2 py-1 text-[11px] font-medium text-gray-500 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40">Uncheck semua</button>
                </div>
            </div>

            <div ref={viewportRef} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)} className="h-[68vh] overflow-auto bg-white">
                <div style={{ minWidth: `${totalWidth}px` }}>
                    <div className="sticky top-0 z-30 grid h-6 bg-[#f1f3f4] text-center text-[11px] font-medium text-gray-600" style={{ gridTemplateColumns }}>
                        <div className="sticky left-0 z-40 flex items-center justify-center border-b border-r border-[#c7c7c7] bg-[#e8eaed]">
                            <label className="flex items-center gap-1" title={allRowsSelected ? 'Uncheck semua baris' : 'Pilih semua baris'}>
                                <input type="checkbox" checked={allRowsSelected} onChange={(event) => toggleAll(event.target.checked)} aria-label={allRowsSelected ? 'Uncheck semua baris' : 'Pilih semua baris'} />
                                <span>#</span>
                            </label>
                        </div>
                        {visibleColumns.map((column) => <div key={column} className="flex items-center justify-center border-b border-r border-[#c7c7c7] bg-[#f1f3f4]">{column}</div>)}
                        <div className="flex items-center justify-center border-b border-r border-[#a8b9a1] bg-[#d9ead3] font-semibold text-[#1f3b24]">{categoryColumn} · Kategori</div>
                        <div className="flex items-center justify-center border-b border-r border-[#a8b9a1] bg-[#d9ead3] font-semibold text-[#1f3b24]">{groupColumn} · Folder</div>
                        <div className="flex items-center justify-center border-b border-r border-[#a8b9a1] bg-[#d9ead3] font-semibold text-[#1f3b24]">{actionColumn} · Masukkan</div>
                    </div>

                    <div className="relative" style={{ height: `${previewRows.length * rowHeight}px` }}>
                        {visibleRows.map((rawRow, offset) => {
                            const row = rowsByNumber.get(Number(rawRow.row_number));
                            const rowKey = row ? `${row.source_sheet || sheet}:${row.id}` : '';
                            const isSaving = row ? Boolean(savingRows[rowKey]) : false;
                            const isSaved = row?.save_state === 'saved';
                            const isConflict = row?.save_state === 'conflict';
                            const categoryStyle = row ? (CATEGORY_CELL_STYLES[row.category] || (row.selected ? 'border-gray-300 bg-white text-gray-700' : 'border-gray-200 bg-gray-100 text-gray-400')) : '';
                            const rawValueForColumn = (column) => {
                                const columnIndex = visibleColumns.indexOf(column);
                                return Array.isArray(rawRow.values) ? rawRow.values[columnIndex] : rawRow.values?.[column];
                            };
                            const hasAnyValue = visibleColumns.some((column) => displayValue(rawValueForColumn(column)).trim() !== '');
                            const sectionText = descriptionColumn ? displayValue(rawValueForColumn(descriptionColumn)).trim() : '';
                            const hasDetailValue = detailColumns.some((column) => displayValue(rawValueForColumn(column)).trim() !== '');
                            const isSectionRow = !row && sectionText !== '' && !hasDetailValue;
                            const isMajorSection = isSectionRow
                                && /[a-z]/i.test(sectionText)
                                && sectionText === sectionText.toLocaleUpperCase('id-ID');
                            const isBlankDivider = !row && !hasAnyValue;
                            const rowVisualStyle = isMajorSection
                                ? 'border-y-2 border-blue-400 bg-blue-100 text-blue-950'
                                : isSectionRow
                                    ? 'border-y border-amber-300 bg-amber-50 text-amber-950'
                                    : isBlankDivider
                                        ? 'bg-slate-50 text-slate-400'
                                        : isSaved
                                            ? 'bg-[#edf7e8]'
                                            : row && !row.selected
                                                ? 'bg-gray-50 text-gray-400'
                                                : 'bg-white';
                            const separatorCellBackground = isMajorSection
                                ? 'bg-blue-100'
                                : isSectionRow
                                    ? 'bg-amber-50'
                                    : isBlankDivider
                                        ? 'bg-slate-50'
                                        : 'bg-[#fafafa]';
                            return (
                                <div key={rawRow.row_number} className={`absolute left-0 grid ${comfortableView ? 'text-[13px]' : 'text-[11px]'} ${rowVisualStyle} hover:bg-[#e8f0fe]`} style={{ top: `${(visibleStart + offset) * rowHeight}px`, height: `${rowHeight}px`, gridTemplateColumns, width: `${totalWidth}px` }}>
                                    <div className={`sticky left-0 z-20 flex items-center justify-center border-b border-r border-[#d5d5d5] px-1 text-center font-normal text-gray-500 ${isMajorSection ? 'bg-blue-100' : isSectionRow ? 'bg-amber-50' : isBlankDivider ? 'bg-slate-50' : 'bg-[#f8f9fa]'}`}>
                                        {row ? <label className="flex h-full w-full cursor-pointer items-center justify-center gap-1" title={row.selected ? 'Lepas pilihan baris' : 'Pilih baris'}><input type="checkbox" checked={row.selected} onChange={(event) => updateRow(row.id, 'selected', event.target.checked)} /><span>{rawRow.row_number}</span></label> : rawRow.row_number}
                                    </div>
                                    {visibleColumns.map((column, columnIndex) => {
                                        const rawValue = Array.isArray(rawRow.values) ? rawRow.values[columnIndex] : rawRow.values?.[column];
                                        const value = displayValue(rawValue);
                                        const address = `${column}${rawRow.row_number}`;
                                        return <button key={column} type="button" title={row ? `${value || 'Sel'} · klik untuk ${row.selected ? 'uncheck' : 'check'}` : value} onClick={() => { setSelectedCell({ address, value }); if (row) updateRow(row.id, 'selected', !row.selected); }} className={`overflow-hidden text-ellipsis whitespace-nowrap border-b border-r border-[#d5d5d5] px-2 text-left ${row ? 'cursor-pointer' : ''} ${isMajorSection && value ? 'font-bold tracking-wide' : isSectionRow && value ? 'font-semibold' : !row && value ? 'font-medium' : ''}`}>{value}</button>;
                                    })}
                                    {row ? <>
                                        <div className={`flex items-center border-b border-r border-[#d5d5d5] px-1 ${comfortableView ? 'py-1' : 'py-0.5'}`}>
                                            <select title={row.category || 'Pilih kategori'} value={row.category} onChange={(event) => updateRow(row.id, 'category', event.target.value)} disabled={!row.selected || isConflict} className={`${comfortableView ? 'h-9 px-3 text-[13px] leading-5' : 'h-7 px-2 text-[11px] leading-4'} w-full rounded-full border font-medium focus:border-green-600 focus:ring-green-600 ${categoryStyle}`}>
                                                <option value="">Pilih kategori...</option>
                                                {MANUAL_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center border-b border-r border-[#d5d5d5] p-0.5"><input title={row.group} value={row.group} onChange={(event) => updateRow(row.id, 'group', event.target.value)} disabled={!row.selected || isConflict} placeholder="Contoh: Struktur" className={`${comfortableView ? 'h-9 text-[13px]' : 'h-7 text-[11px]'} w-full border-0 bg-transparent px-2 focus:bg-white focus:ring-2 focus:ring-green-600`} /></div>
                                        <div className="flex items-center justify-center border-b border-r border-[#d5d5d5] p-0.5 text-center">
                                            <button type="button" disabled={!row.selected || !row.category || isSaving || isConflict} onClick={() => saveRow(row)} className={`${comfortableView ? 'min-w-[104px] px-2 py-1 text-[11px]' : 'min-w-[96px] px-1.5 py-0.5 text-[9px]'} rounded font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${isSaved ? 'border border-green-300 bg-green-100 text-green-800' : isConflict ? 'border border-gray-300 bg-gray-100 text-gray-600' : 'bg-green-700 text-white hover:bg-green-800'}`}>
                                                {isSaving ? 'Menyimpan...' : isSaved ? '✓ Tersimpan' : isConflict ? 'Sudah diambil' : row.save_state === 'dirty' ? 'Masukkan ulang' : 'Masukkan'}
                                            </button>
                                        </div>
                                    </> : <>
                                        <div className={`border-b border-r border-[#d5d5d5] ${separatorCellBackground}`} />
                                        <div className={`border-b border-r border-[#d5d5d5] ${separatorCellBackground}`} />
                                        <div className={`border-b border-r border-[#d5d5d5] ${separatorCellBackground}`} />
                                    </>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </>
    );
}

function ManualRabImport({ projectId, projects, onProjectChange, onAddProject, onEditProject, onImportComplete }) {
    const [file, setFile] = useState(null);
    const [fileInfo, setFileInfo] = useState(null);
    const [sheet, setSheet] = useState('');
    const [selectedSheetOption, setSelectedSheetOption] = useState('');
    const [rows, setRows] = useState([]);
    const [sheetRows, setSheetRows] = useState({});
    const [rawSheetData, setRawSheetData] = useState({});
    const [sheetErrors, setSheetErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [savingRows, setSavingRows] = useState({});
    const [notice, setNotice] = useState(null);
    const [replaceExisting, setReplaceExisting] = useState(false);
    const [bulkCategory, setBulkCategory] = useState('');
    const [bulkGroup, setBulkGroup] = useState('');
    const [drafts, setDrafts] = useState([]);

    const fetchDrafts = async () => {
        if (!projectId) return;
        try {
            const response = await axios.get('/api/rab/import/drafts', { params: { project_id: projectId } });
            setDrafts(response.data?.data || []);
        } catch {
            setDrafts([]);
        }
    };

    useEffect(() => {
        fetchDrafts();
    }, [projectId]);

    const reset = () => {
        setFile(null); setFileInfo(null); setSheet(''); setSelectedSheetOption(''); setRows([]); setSheetRows({}); setRawSheetData({}); setSheetErrors({}); setNotice(null);
        setBulkCategory(''); setBulkGroup(''); setSavingRows({});
    };

    const syncSavedRows = async (candidateRows, sheetName, fingerprint) => {
        if (!fingerprint || !candidateRows.length) return candidateRows;
        try {
            const response = await axios.post('/api/rab/import/manual-status', {
                project_id: projectId,
                file_fingerprint: fingerprint,
                sheet: sheetName,
            });
            const savedByRow = new Map((response.data?.data || []).map((item) => [Number(item.source_row), item]));
            return candidateRows.map((row) => {
                const saved = savedByRow.get(Number(row.row_number));
                return saved ? {
                    ...row,
                    category: saved.category || row.category,
                    group: saved.group || '',
                    save_state: 'saved',
                    saved_id: saved.id,
                    saved_by: saved.saved_by || 'pengguna lain',
                } : row;
            });
        } catch {
            return candidateRows;
        }
    };

    const persistDraftRows = async (parsedRows, sheetName, info) => {
        if (!info?.file_fingerprint || !parsedRows.length) return;
        await axios.post('/api/rab/import/draft-rows', {
            project_id: projectId,
            file_id: info.file_id,
            file_fingerprint: info.file_fingerprint,
            original_name: info.original_name,
            sheet: sheetName,
            rows: parsedRows.map((row) => ({
                row_number: row.row_number,
                code_item: row.code_item,
                description: row.description,
                unit: row.unit,
                volume: row.volume,
                unit_price: row.unit_price,
                total_price: row.total_price,
                category: row.category || null,
                group: row.group || null,
            })),
        });
        fetchDrafts();
    };

    const persistDraftCategory = (row) => {
        if (!fileInfo?.file_fingerprint || !row?.source_sheet) return;
        axios.patch('/api/rab/import/draft-row', {
            project_id: projectId,
            file_fingerprint: fileInfo.file_fingerprint,
            sheet: row.source_sheet,
            row_number: row.row_number,
            category: row.category || null,
            group: row.group || null,
        }).catch(() => {
            // The initial draft checkpoint may still be in flight.
        });
    };

    const resumeDraft = async (draft) => {
        setLoading(true);
        setNotice(null);
        try {
            const response = await axios.get(`/api/rab/import/drafts/${draft.file_fingerprint}`, { params: { project_id: projectId } });
            const info = response.data?.data;
            const groupedRows = (info?.rows || []).reduce((groups, row) => {
                if (!groups[row.source_sheet]) groups[row.source_sheet] = [];
                groups[row.source_sheet].push(row);
                return groups;
            }, {});
            const sheets = info?.sheets || Object.keys(groupedRows);
            const firstSheet = sheets[0] || '';
            const resumedRaw = {};
            if (info?.file_id && firstSheet) {
                try {
                    const preview = await axios.post('/api/rab/import/preview', {
                        file_id: info.file_id,
                        sheet: firstSheet,
                        limit: 10000,
                    });
                    resumedRaw[firstSheet] = {
                        columns: preview.data?.raw_columns || [],
                        rows: preview.data?.raw_rows || [],
                        mappedColumns: Object.keys(preview.data?.column_map || {}),
                        columnMap: preview.data?.column_map || {},
                    };
                } catch {
                    // Keep the normalized draft usable if the stored Excel
                    // preview is no longer available on the server.
                }
            }
            setFile(null);
            setFileInfo({
                file_id: info?.file_id || null,
                file_fingerprint: info?.file_fingerprint || draft.file_fingerprint,
                original_name: info?.original_name || draft.original_name,
                sheets,
            });
            setSheetRows(groupedRows);
            setRawSheetData(resumedRaw);
            setSelectedSheetOption(firstSheet);
            setSheet(firstSheet);
            setRows(groupedRows[firstSheet] || []);
            setNotice({ type: 'success', text: `Draft “${info?.original_name || draft.original_name}” dilanjutkan. ${info?.rows?.length || 0} baris tersedia.` });
        } catch (error) {
            setNotice({ type: 'error', text: error.response?.data?.message || 'Draft tidak dapat dibuka.' });
        } finally {
            setLoading(false);
        }
    };

    const upload = async (event) => {
        const selected = event.target.files?.[0];
        if (!selected) return;
        setFile(selected); setFileInfo(null); setRows([]); setSheetRows({}); setRawSheetData({}); setSheetErrors({}); setSheet(''); setSelectedSheetOption(''); setNotice(null); setLoading(true);
        const form = new FormData();
        form.append('file', selected);
        try {
            const response = await axios.post('/api/rab/import/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
            const info = response.data;
            setFileInfo(info);
            const sheets = info.sheets || [];
            setSelectedSheetOption(sheets[0] || '');
            if (sheets.length === 1) await loadSheet(sheets[0], info.file_id, info.file_fingerprint, info);
            else setNotice({ type: 'info', text: 'Pilih satu sheet Excel, lalu klik Masukkan untuk meninjau isinya.' });
        } catch (error) {
            setNotice({ type: 'error', text: error.response?.data?.message || 'File gagal dibaca. Pastikan formatnya .xlsx atau .xls.' });
        } finally { setLoading(false); }
    };

    const loadSheet = async (sheetName, fileId = fileInfo?.file_id, fingerprint = fileInfo?.file_fingerprint, metadata = fileInfo) => {
        if (!sheetName) return;
        setSelectedSheetOption(sheetName);
        if (sheetRows[sheetName]) {
            setSheet(sheetName);
            setSheetErrors((current) => {
                if (!current[sheetName]) return current;
                const next = { ...current };
                delete next[sheetName];
                return next;
            });
            const syncedRows = await syncSavedRows(sheetRows[sheetName], sheetName, fingerprint);
            setRows(syncedRows);
            setSheetRows((current) => ({ ...current, [sheetName]: syncedRows }));
            if (!rawSheetData[sheetName] && fileId) {
                try {
                    const preview = await axios.post('/api/rab/import/preview', { file_id: fileId, sheet: sheetName, limit: 10000 });
                    setRawSheetData((current) => ({
                        ...current,
                        [sheetName]: {
                            columns: preview.data?.raw_columns || [],
                            rows: preview.data?.raw_rows || [],
                            mappedColumns: Object.keys(preview.data?.column_map || {}),
                            columnMap: preview.data?.column_map || {},
                        },
                    }));
                } catch {
                    // Fall back to the normalized draft rows below.
                }
            }
            const savedCount = syncedRows.filter((row) => row.save_state === 'saved').length;
            setNotice({ type: 'success', text: `${syncedRows.length} baris dari sheet “${sheetName}” siap. ${savedCount} item sudah dimasukkan.` });
            return;
        }
        if (!fileId) {
            setNotice({ type: 'error', text: 'File draft tidak memiliki preview yang dapat dibaca. Upload ulang file Excel untuk sheet ini.' });
            return;
        }
        setLoading(true); setSheet(sheetName); setNotice(null);
        try {
            const response = await axios.post('/api/rab/import/preview', { file_id: fileId, sheet: sheetName, limit: 10000 });
            setRawSheetData((current) => ({
                ...current,
                [sheetName]: {
                    columns: response.data?.raw_columns || [],
                    rows: response.data?.raw_rows || [],
                    mappedColumns: Object.keys(response.data?.column_map || {}),
                    columnMap: response.data?.column_map || {},
                },
            }));
            let parsed = (response.data?.rows || []).map((row, index) => ({
                id: `${row.row_number || index + 1}-${index}`,
                row_number: row.row_number || index + 1,
                source_sheet: sheetName,
                code_item: row.code || '',
                description: row.description || '',
                unit: row.unit || '',
                volume: Number(row.qty || 0),
                unit_price: Number(row.price || 0),
                total_price: Number(row.total || 0),
                category: '', group: '', selected: true,
                save_state: 'idle', saved_id: null, saved_by: '',
            }));
            parsed = await syncSavedRows(parsed, sheetName, fingerprint);
            try {
                await persistDraftRows(parsed, sheetName, { ...(metadata || {}), file_id: fileId, file_fingerprint: fingerprint });
            } catch {
                // Preview remains usable even if the draft checkpoint cannot
                // be written; the next explicit save still works.
            }
            setRows(parsed);
            setSheetRows((current) => ({ ...current, [sheetName]: parsed }));
            setSheetErrors((current) => {
                if (!current[sheetName]) return current;
                const next = { ...current };
                delete next[sheetName];
                return next;
            });
            setNotice({ type: 'success', text: `${parsed.length} baris dari sheet “${sheetName}” terbaca. Silakan pilih kategori untuk setiap baris.` });
            const rawCount = response.data?.raw_rows?.length || parsed.length;
            setNotice(parsed.length
                ? { type: 'success', text: `${rawCount} baris Excel dari sheet "${sheetName}" terbaca lengkap. ${parsed.length} baris item siap dikategorikan.` }
                : { type: 'info', text: `${rawCount} baris Excel dari sheet "${sheetName}" terbaca. Sheet ini dapat ditinjau, tetapi tidak memiliki item RAB yang bisa dimasukkan.` });
        } catch (error) {
            const message = error.response?.data?.error || error.response?.data?.message || 'Preview Excel gagal dibaca.';
            const unsupported = message.toLowerCase().includes('no strategy');
            setRows([]);
            setSheet((current) => (current === sheetName ? (unsupported ? '' : current) : current));
            setSheetErrors((current) => ({ ...current, [sheetName]: unsupported ? 'Bukan format RAB' : 'Gagal dibaca' }));
            setNotice({
                type: unsupported ? 'info' : 'error',
                text: unsupported
                    ? `Sheet “${sheetName}” bukan sheet RAB yang dikenali. Pilih sheet RAB lain lalu klik Masukkan.`
                    : message,
            });
        } finally { setLoading(false); }
    };

    const updateCurrentRows = (nextRows) => {
        setRows(nextRows);
        if (sheet) setSheetRows((current) => ({ ...current, [sheet]: nextRows }));
    };
    const patchRowState = (sourceSheet, id, patch) => {
        const patchRow = (row) => row.source_sheet === sourceSheet && row.id === id ? { ...row, ...patch } : row;
        setRows((current) => current.map(patchRow));
        setSheetRows((current) => ({
            ...current,
            [sourceSheet]: (current[sourceSheet] || []).map(patchRow),
        }));
    };
    const updateRow = (id, field, value) => {
        const nextRows = rows.map((row) => {
            if (row.id !== id) return row;
            const changedAfterSave = ['category', 'group'].includes(field) && row.saved_id;
            return { ...row, [field]: value, ...(changedAfterSave ? { save_state: 'dirty' } : {}) };
        });
        updateCurrentRows(nextRows);
        if (['category', 'group'].includes(field)) {
            const changedRow = nextRows.find((row) => row.id === id);
            persistDraftCategory(changedRow);
        }
    };
    const applyBulk = () => {
        const nextRows = rows.map((row) => {
            if (!row.selected) return row;
            const category = bulkCategory || row.category;
            const group = bulkGroup || row.group;
            const changedAfterSave = row.saved_id && (category !== row.category || group !== row.group);
            return { ...row, category, group, ...(changedAfterSave ? { save_state: 'dirty' } : {}) };
        });
        updateCurrentRows(nextRows);
        nextRows.filter((row) => row.selected).forEach(persistDraftCategory);
    };
    const applySuggestedCategories = () => {
        const nextRows = rows.map((row) => {
            if (!row.selected || row.save_state === 'saved') return row;
            return { ...row, ...classifyRabItem(row.description, row.unit) };
        });
        updateCurrentRows(nextRows);
        nextRows.filter((row) => row.selected && row.save_state !== 'saved').forEach(persistDraftCategory);
        setNotice({ type: 'info', text: 'Kategori awal diterapkan dengan aturan kata kunci. Tinjau dan ubah per baris bila diperlukan sebelum menyimpan.' });
    };
    const toggleAll = (selected) => updateCurrentRows(rows.map((row) => ({ ...row, selected })));

    const saveRow = async (row) => {
        if (!row.category) {
            setNotice({ type: 'error', text: `Pilih kategori untuk baris ${row.row_number} terlebih dahulu.` });
            return false;
        }
        if (!fileInfo?.file_fingerprint) {
            setNotice({ type: 'error', text: 'Identitas file belum tersedia. Upload ulang file Excel terlebih dahulu.' });
            return false;
        }

        const sourceSheet = row.source_sheet || sheet;
        const rowKey = `${sourceSheet}:${row.id}`;
        setSavingRows((current) => ({ ...current, [rowKey]: true }));
        patchRowState(sourceSheet, row.id, { save_state: 'saving' });

        try {
            const response = await axios.post('/api/rab/import/manual-item', {
                project_id: projectId,
                file_fingerprint: fileInfo.file_fingerprint,
                sheet: sourceSheet,
                row_number: row.row_number,
                code_item: row.code_item,
                description: row.description,
                unit: row.unit,
                volume: row.volume,
                unit_price: row.unit_price,
                total_price: row.total_price,
                category: row.category,
                group: row.group,
            });
            const saved = response.data?.data || {};
            patchRowState(sourceSheet, row.id, {
                save_state: 'saved',
                saved_id: saved.id,
                saved_by: saved.saved_by || 'Anda',
                category: saved.category || row.category,
                group: saved.group ?? row.group,
            });
            setNotice({ type: 'success', text: `Baris ${row.row_number} berhasil dimasukkan oleh ${saved.saved_by || 'Anda'}.` });
            fetchDrafts();
            if (onImportComplete) onImportComplete();
            return true;
        } catch (error) {
            const conflict = error.response?.status === 409;
            const saved = error.response?.data?.data || {};
            patchRowState(sourceSheet, row.id, conflict ? {
                save_state: 'conflict',
                saved_id: saved.id,
                saved_by: saved.saved_by || 'pengguna lain',
                category: saved.category || row.category,
                group: saved.group ?? row.group,
            } : { save_state: 'idle' });
            setNotice({ type: conflict ? 'info' : 'error', text: error.response?.data?.message || 'Item gagal dimasukkan.' });
            return false;
        } finally {
            setSavingRows((current) => {
                const next = { ...current };
                delete next[rowKey];
                return next;
            });
        }
    };

    const submit = async () => {
        const selected = Object.values(sheetRows).flat().filter((row) => row.selected && !['saved', 'conflict'].includes(row.save_state));
        const missing = selected.filter((row) => !row.category);
        if (!selected.length) return setNotice({ type: 'info', text: savedCount ? 'Semua baris yang dipilih sudah dimasukkan.' : 'Pilih minimal satu baris untuk diimport.' });
        if (missing.length) return setNotice({ type: 'error', text: `${missing.length} baris belum memiliki kategori. Pilih Subkon, Material, Pekerja, atau Alat.` });
        setSubmitting(true); setNotice(null);
        try {
            const response = await axios.post('/api/rab/import/manual', {
                project_id: projectId,
                file_id: fileInfo?.file_id,
                replace_existing: replaceExisting,
                rows: selected.map(({ id, selected: _selected, ...row }) => row),
            });
            setNotice({ type: 'success', text: response.data?.message || 'Import manual berhasil.' });
            setRows([]); setSheetRows({}); setRawSheetData({}); setSheetErrors({}); setSavingRows({}); setFileInfo(null); setFile(null); setSheet(''); setSelectedSheetOption('');
            if (onImportComplete) onImportComplete();
        } catch (error) {
            setNotice({ type: 'error', text: error.response?.data?.message || 'Import manual gagal.' });
        } finally { setSubmitting(false); }
    };

    const reviewedRows = Object.values(sheetRows).flat();
    const selectedCount = reviewedRows.filter((row) => row.selected).length;
    const savedCount = reviewedRows.filter((row) => ['saved', 'conflict'].includes(row.save_state)).length;
    const pendingSelectedCount = reviewedRows.filter((row) => row.selected && !['saved', 'conflict'].includes(row.save_state)).length;
    const missingCount = reviewedRows.filter((row) => row.selected && !['saved', 'conflict'].includes(row.save_state) && !row.category).length;
    const currentSelectedCount = rows.filter((row) => row.selected).length;
    const currentSavedCount = rows.filter((row) => ['saved', 'conflict'].includes(row.save_state)).length;
    const currentMissingCount = rows.filter((row) => row.selected && !['saved', 'conflict'].includes(row.save_state) && !row.category).length;
    const grouped = rows.filter((row) => row.selected && row.category).reduce((acc, row) => {
        const key = `${row.category}${row.group ? ` / ${row.group}` : ''}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    return (
        <Card title="Import RAB Manual" subtitle="Pilih kategori lalu masukkan per item. Beberapa pengguna dapat mengerjakan baris berbeda secara bersamaan.">
            <div className="flex items-end gap-3 flex-wrap">
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Proyek</label>
                    <div className="flex gap-1">
                        <select value={projectId} onChange={(e) => onProjectChange(Number(e.target.value))} className="rounded-lg border-gray-300 text-sm min-w-[180px]">
                            {projects.map((p) => <option key={p.id} value={p.id}>{p.project_name || `Project #${p.id}`}</option>)}
                            {!projects.length && <option value={1}>Project #1</option>}
                        </select>
                        <Button variant="outline" size="sm" onClick={onAddProject}>Tambah</Button>
                        <Button variant="outline" size="sm" onClick={onEditProject}>Edit</Button>
                    </div>
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[240px]">
                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Excel RAB</label>
                    <input type="file" accept=".xlsx,.xls" onChange={upload} className="rounded-lg border-gray-300 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-amber-50 file:px-3 file:py-2 file:font-semibold file:text-amber-700" />
                </div>
                {fileInfo && <Button variant="outline" size="sm" onClick={reset}>Mulai ulang</Button>}
            </div>

            {drafts.length > 0 && !fileInfo && (
                <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                            <h3 className="font-semibold text-amber-900">Draft import tersimpan</h3>
                            <p className="text-xs text-amber-800">Lanjutkan pekerjaan tanpa memilih file Excel lagi.</p>
                        </div>
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">{drafts.length} draft</span>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                        {drafts.map((draft) => (
                            <div key={draft.file_fingerprint} className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white p-3">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-gray-900">{draft.original_name || 'Draft Excel'}</p>
                                    <p className="text-xs text-gray-500">{draft.saved_rows} sudah masuk · {draft.pending_rows} belum · {draft.sheets?.length || 0} sheet</p>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => resumeDraft(draft)}>Lanjutkan</Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {notice && <div className={`mt-4 rounded-lg border p-3 text-sm ${notice.type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : notice.type === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>{notice.text}</div>}
            {loading && <div className="mt-5"><LoadingSpinner size="sm" message="Membaca preview Excel..." /></div>}

            {fileInfo && (fileInfo.sheets || []).length > 0 && (
                <>
                    <div className="mt-5 flex flex-wrap items-end gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                        <div className="flex min-w-[260px] flex-1 flex-col gap-1">
                            <label className="text-xs font-semibold uppercase tracking-wider text-blue-800">Sheet Excel</label>
                            <select value={selectedSheetOption} onChange={(e) => setSelectedSheetOption(e.target.value)} className="rounded-lg border-blue-300 bg-white text-sm">
                                <option value="">Pilih sheet...</option>
                                {(fileInfo.sheets || []).map((name) => <option key={name} value={name}>{name}{sheetErrors[name] ? ` — ${sheetErrors[name]}` : ''}</option>)}
                            </select>
                        </div>
                        <Button variant="primary" size="sm" disabled={!selectedSheetOption || loading} onClick={() => loadSheet(selectedSheetOption)}>Masukkan</Button>
                        <p className="w-full text-xs text-blue-700">Pilih sheet yang berisi data RAB. Sheet seperti rekap atau jadwal boleh dilewati. Klik Masukkan lagi untuk menyinkronkan status pekerjaan tim.</p>
                    </div>
                    <div className="hidden">
                    <div className="flex min-w-max items-end gap-1">
                        {(fileInfo.sheets || []).map((name) => {
                            const cached = sheetRows[name];
                            const unassigned = cached?.filter((row) => row.selected && !row.category).length || 0;
                            const unsupported = sheetErrors[name];
                            return <button key={name} onClick={() => setSelectedSheetOption(name)} className={`rounded-t-md border border-b-0 px-4 py-2 text-sm transition ${sheet === name ? 'border-green-600 bg-white font-semibold text-green-800 shadow-sm' : selectedSheetOption === name ? 'border-blue-500 bg-blue-50 font-semibold text-blue-800' : 'border-gray-300 bg-gray-200 text-gray-600 hover:bg-white'}`}>
                                {name}
                                {unsupported && <span className="ml-2 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600">bukan RAB</span>}
                                {!unsupported && cached && <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${unassigned ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{unassigned ? `${unassigned} belum` : 'siap'}</span>}
                            </button>;
                        })}
                        <span className="px-3 pb-2 text-xs text-gray-500">Tab sheet Excel</span>
                    </div>
                    </div>
                </>
            )}

            {(rows.length > 0 || rawSheetData[sheet]?.rows?.length > 0) && <>
                <div className={`${rows.length ? 'flex' : 'hidden'} mt-5 flex-wrap items-end gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3`}>
                    <div className="text-sm text-amber-900"><strong>{currentSelectedCount}</strong> dipilih · <strong>{currentSavedCount}</strong> sudah masuk · <strong>{currentMissingCount}</strong> belum dikategorikan · Sheet: <strong>{sheet}</strong></div>
                    <div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" onClick={applySuggestedCategories}>Klasifikasi awal</Button><select value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)} className="rounded-lg border-gray-300 text-sm"><option value="">Kategori untuk dipilih...</option>{MANUAL_CATEGORIES.map((cat) => <option key={cat.value} value={cat.value}>{cat.label}</option>)}</select><input value={bulkGroup} onChange={(e) => setBulkGroup(e.target.value)} placeholder="Sub-kelompok / folder (opsional)" className="rounded-lg border-gray-300 text-sm" /><Button size="sm" variant="outline" onClick={applyBulk}>Terapkan ke dipilih</Button></div>
                    <label className="flex items-center gap-2 text-sm text-amber-900"><input type="checkbox" checked={replaceExisting} onChange={(e) => setReplaceExisting(e.target.checked)} /> Ganti versi saat Simpan semua</label>
                </div>

                <div className="mt-3 overflow-hidden rounded-md border border-[#b7b7b7] bg-white shadow-sm">
                    <ExcelSheetGrid
                        rows={rows}
                        rawData={rawSheetData[sheet]}
                        sheet={sheet}
                        savingRows={savingRows}
                        updateRow={updateRow}
                        saveRow={saveRow}
                        toggleAll={toggleAll}
                    />
                    {false && <>
                    <div className="flex h-9 items-center border-b border-[#c7c7c7] bg-[#f8f9fa] text-xs text-gray-700">
                        <div className="flex h-full w-24 items-center justify-center border-r border-[#c7c7c7] bg-white font-mono">{sheet || 'Sheet'}!A1</div>
                        <div className="flex h-full w-12 items-center justify-center border-r border-[#c7c7c7] font-serif text-sm italic">fx</div>
                        <div className="min-w-0 flex-1 truncate px-3">{sheet} · {rows.length} baris terbaca lengkap</div>
                    </div>

                    <div className="max-h-[68vh] overflow-auto bg-white">
                        <table className="min-w-[1540px] border-separate border-spacing-0 text-[12px] text-gray-900">
                            <thead className="sticky top-0 z-30">
                                <tr className="h-7 bg-[#f1f3f4] text-center font-medium text-gray-600">
                                    <th className="sticky left-0 z-40 w-16 min-w-16 border-b border-r border-[#c7c7c7] bg-[#e8eaed]">#</th>
                                    {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].map((letter) => <th key={letter} className="border-b border-r border-[#c7c7c7] bg-[#f1f3f4] py-1">{letter}</th>)}
                                </tr>
                                <tr className="h-7 bg-[#d9ead3] font-semibold text-[#1f3b24]">
                                    <th className="sticky left-0 z-40 border-b border-r border-[#a8b9a1] bg-[#cfe3c8] px-1 text-center"><input type="checkbox" checked={currentSelectedCount === rows.length} onChange={(e) => toggleAll(e.target.checked)} aria-label="Pilih semua baris" /></th>
                                    <th className="min-w-[90px] border-b border-r border-[#a8b9a1] px-2 text-left">Nomor / Kode</th>
                                    <th className="min-w-[280px] border-b border-r border-[#a8b9a1] px-2 text-left">Jenis Barang/Jasa</th>
                                    <th className="min-w-[70px] border-b border-r border-[#a8b9a1] px-2 text-center">Satuan</th>
                                    <th className="min-w-[80px] border-b border-r border-[#a8b9a1] px-2 text-right">Volume</th>
                                    <th className="min-w-[110px] border-b border-r border-[#a8b9a1] px-2 text-right">Harga Satuan</th>
                                    <th className="min-w-[125px] border-b border-r border-[#a8b9a1] px-2 text-right">Jumlah Harga</th>
                                    <th className="min-w-[220px] border-b border-r border-[#a8b9a1] px-2 text-left">Kategori</th>
                                    <th className="min-w-[220px] border-b border-r border-[#a8b9a1] px-2 text-left">Folder / Kelompok</th>
                                    <th className="min-w-[124px] border-b border-r border-[#a8b9a1] px-2 text-center">Masukkan</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => {
                                    const rowKey = `${row.source_sheet || sheet}:${row.id}`;
                                    const isSaving = Boolean(savingRows[rowKey]);
                                    const isSaved = row.save_state === 'saved';
                                    const isConflict = row.save_state === 'conflict';
                                    const categoryStyle = CATEGORY_CELL_STYLES[row.category] || (row.selected ? 'border-gray-300 bg-white text-gray-700' : 'border-gray-200 bg-gray-100 text-gray-400');
                                    return (
                                        <tr key={row.id} className={`${isSaved ? 'bg-[#edf7e8]' : row.selected ? 'bg-white' : 'bg-gray-50 opacity-60'} hover:bg-[#e8f0fe]`}>
                                            <th className="sticky left-0 z-20 border-b border-r border-[#d5d5d5] bg-[#f8f9fa] px-1 py-1 text-center font-normal text-gray-500">
                                                <label className="flex items-center justify-center gap-1"><input type="checkbox" checked={row.selected} onChange={(e) => updateRow(row.id, 'selected', e.target.checked)} /><span>{row.row_number}</span></label>
                                            </th>
                                            <td className="border-b border-r border-[#d5d5d5] px-2 py-0.5 font-mono text-gray-600">{row.code_item || '—'}</td>
                                            <td className="whitespace-normal break-words border-b border-r border-[#d5d5d5] px-2 py-0.5 font-medium leading-4" title={row.description}>{row.description}</td>
                                            <td className="border-b border-r border-[#d5d5d5] px-2 py-0.5 text-center">{row.unit || '—'}</td>
                                            <td className="border-b border-r border-[#d5d5d5] px-2 py-0.5 text-right font-mono">{Number(row.volume).toLocaleString('id-ID')}</td>
                                            <td className="border-b border-r border-[#d5d5d5] px-2 py-0.5 text-right font-mono">{Number(row.unit_price).toLocaleString('id-ID')}</td>
                                            <td className="border-b border-r border-[#d5d5d5] px-2 py-0.5 text-right font-mono font-semibold">{Number(row.total_price).toLocaleString('id-ID')}</td>
                                            <td className="border-b border-r border-[#d5d5d5] px-1 py-1">
                                                <select title={row.category || 'Pilih kategori'} value={row.category} onChange={(e) => updateRow(row.id, 'category', e.target.value)} disabled={!row.selected || isConflict} className={`h-8 w-full rounded-full border px-3 text-xs font-medium leading-5 focus:border-green-600 focus:ring-green-600 ${categoryStyle}`}>
                                                    <option value="">Pilih kategori...</option>
                                                    {MANUAL_CATEGORIES.map((cat) => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                                                </select>
                                            </td>
                                            <td className="border-b border-r border-[#d5d5d5] p-0.5"><input title={row.group} value={row.group} onChange={(e) => updateRow(row.id, 'group', e.target.value)} disabled={!row.selected || isConflict} placeholder="Contoh: Struktur" className="h-6 w-full border-0 bg-transparent px-2 text-[10px] focus:bg-white focus:ring-2 focus:ring-green-600" /></td>
                                            <td className="border-b border-r border-[#d5d5d5] p-0.5 text-center">
                                                <button type="button" disabled={!row.selected || !row.category || isSaving || isConflict} onClick={() => saveRow(row)} className={`min-w-[96px] rounded px-1.5 py-0.5 text-[9px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${isSaved ? 'border border-green-300 bg-green-100 text-green-800' : isConflict ? 'border border-gray-300 bg-gray-100 text-gray-600' : 'bg-green-700 text-white hover:bg-green-800'}`}>
                                                    {isSaving ? 'Menyimpan...' : isSaved ? '✓ Tersimpan' : isConflict ? 'Sudah diambil' : row.save_state === 'dirty' ? 'Masukkan ulang' : 'Masukkan'}
                                                </button>
                                                {(isSaved || isConflict) && <p className="mt-0.5 text-[9px] text-gray-500">oleh {row.saved_by || 'pengguna lain'}</p>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    </>}

                    <div className="flex h-10 min-w-0 items-end gap-1 overflow-x-auto border-t border-[#c7c7c7] bg-[#f1f3f4] px-2">
                        <button type="button" className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lg text-gray-600 hover:bg-gray-200" aria-label="Daftar sheet">+</button>
                        {(fileInfo?.sheets || []).map((name) => (
                            <button key={name} type="button" onClick={() => loadSheet(name)} className={`h-9 shrink-0 border-b-2 px-4 text-xs transition ${sheet === name ? 'border-green-700 bg-white font-semibold text-green-800' : sheetErrors[name] ? 'border-red-300 text-red-600' : 'border-transparent text-gray-600 hover:bg-white'}`}>
                                {name}{sheetErrors[name] ? ' · bukan RAB' : ''}
                            </button>
                        ))}
                        <div className="ml-auto flex h-9 shrink-0 items-center px-3 text-[10px] text-gray-500">{currentSavedCount} tersimpan · {currentMissingCount} belum dipilih</div>
                    </div>
                </div>

                <div className={`${rows.length ? 'flex' : 'hidden'} mt-4 flex-wrap items-center justify-between gap-3`}><div className="text-xs text-gray-500">Pengelompokan sheet ini: {Object.entries(grouped).map(([name, count]) => <span key={name} className="mr-2 inline-block rounded-full bg-gray-100 px-2 py-1">{name} ({count})</span>)}</div><Button variant="primary" onClick={submit} disabled={submitting || missingCount > 0 || pendingSelectedCount === 0}>{submitting ? 'Menyimpan...' : `Simpan semua yang belum masuk (${pendingSelectedCount})`}</Button></div>
            </>}
        </Card>
    );
}

export default function RabImport({ projectId, projects, currentProject, onProjectChange, onAddProject, onEditProject, view = 'import', onImportComplete }) {
    const [file, setFile] = useState(null);
    const [step, setStep] = useState(1);
    const [message, setMessage] = useState('');
    const [rabData, setRabData] = useState([]);
    const [loadingRab, setLoadingRab] = useState(false);
    const [summary, setSummary] = useState(null);
    const [categoryFilter, setCategoryFilter] = useState('');
    const [categories, setCategories] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [collapsedFolders, setCollapsedFolders] = useState(() => new Set());

    const [importJob, setImportJob] = useState(null);
    const [importStatus, setImportStatus] = useState('');
    const [importErrors, setImportErrors] = useState([]);
    const [importDiff, setImportDiff] = useState(null);
    const [selectedSheet, setSelectedSheet] = useState(null);
    const [importStartTime, setImportStartTime] = useState(null);

    const intervalRef = useRef(null);

    const fetchRabData = async (pid) => {
        if (!pid) return;
        setLoadingRab(true);
        try {
            const params = { project_id: pid, per_page: -1 };
            const response = await axios.get('/api/rab', { params });
            const payload = response.data;
            const result = payload?.data;
            const rows = Array.isArray(result) ? result : (Array.isArray(result?.data) ? result.data : (Array.isArray(payload) ? payload : []));
            setRabData(rows);
        } catch {
            setRabData([]);
        } finally {
            setLoadingRab(false);
        }
    };

    const fetchSummary = async (pid) => {
        if (!pid) return;
        try {
            const response = await axios.get('/api/rab/summary', { params: { project_id: pid } });
            const data = response.data?.data ?? response.data;
            setSummary(data);
            const byCategory = data?.by_category ?? [];
            setCategories(Array.isArray(byCategory) ? byCategory.map((c) => c.category_name).filter(Boolean) : []);
        } catch {
            setSummary(null);
        }
    };

    useEffect(() => {
        fetchRabData(projectId);
        fetchSummary(projectId);
    }, [projectId]);

    useEffect(() => {
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, []);

    const startPolling = (jobId) => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(async () => {
            try {
                const response = await axios.get(`/rab/import-job/${jobId}`);
                const job = response.data?.data ?? response.data;
                setImportJob(job);
                setImportStatus(job.status);
                setImportErrors(job.errors || []);
                setImportDiff(job.diff);

                if (job.status === 'IMPORTING') {
                    setImportStartTime((prev) => prev || Date.now());
                } else if (job.status !== 'PENDING' && job.status !== 'PROCESSING') {
                    setImportStartTime(null);
                }

                if (job.status === 'VALIDATED' || job.status === 'FAILED' || job.status === 'COMPLETED') {
                    clearInterval(intervalRef.current);
                }

                if (job.status === 'COMPLETED') {
                    setMessage('Import data RAB berhasil diselesaikan. Stok Material akan bertambah saat penerimaan barang dicatat.');
                    setFile(null);
                    setStep(1);
                    fetchRabData(projectId);
                    fetchSummary(projectId);
                    if (onImportComplete) onImportComplete();
                }
            } catch {
                clearInterval(intervalRef.current);
            }
        }, 1500);
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
            setImportStartTime(null);

            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('project_id', projectId);

            try {
                const response = await axios.post('/rab/import-async', formData, {
                    headers: { 'Content-Type': 'multipart/form-data', Accept: 'application/json' },
                });
                const job = response.data?.data ?? response.data;
                setImportJob(job);
                setImportStatus(job.status);
                startPolling(job.id);
            } catch (error) {
                setImportStatus('FAILED');
                const validationErrors = error.response?.data?.errors;
                if (validationErrors && typeof validationErrors === 'object') {
                    setImportErrors(Object.values(validationErrors).flat());
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
            setImportStartTime(Date.now());
            const response = await axios.post(`/rab/import-job/${importJob.id}/confirm`);
            const job = response.data?.data ?? response.data;
            setImportJob(job);
            setImportStatus(job.status);
            startPolling(job.id);
        } catch (error) {
            setImportStatus('FAILED');
            setImportStartTime(null);
            setImportErrors([error.response?.data?.message || 'Gagal memulai eksekusi import.']);
            setMessage('Gagal melakukan konfirmasi import.');
        }
    };

    const handleResetImport = () => {
        setStep(1);
        setFile(null);
        setImportJob(null);
        setImportStatus('');
        setImportErrors([]);
        setImportDiff(null);
        setSelectedSheet(null);
    };

    const handleSheetSelect = async (sheetName) => {
        if (!importJob) return;
        setSelectedSheet(sheetName);
        setImportStatus('PENDING');
        setImportErrors([]);
        setImportDiff(null);
        setMessage(`Re-validasi dengan sheet "${sheetName}"...`);

        try {
            await axios.post(`/rab/import-job/${importJob.id}/revalidate`, { sheet_name: sheetName });
            startPolling(importJob.id);
        } catch (error) {
            setImportStatus('FAILED');
            setImportErrors([error.response?.data?.message || 'Gagal re-validasi.']);
            setMessage('Gagal re-validasi.');
        }
    };

    // Import progress
    const totalRows = importJob?.total_rows || 0;
    const processedRows = importJob?.processed_rows || 0;
    const percent = totalRows > 0 ? Math.min(100, Math.round((processedRows / totalRows) * 100)) : 0;

    let remainingTimeText = '';
    if (importStatus === 'IMPORTING' && importStartTime && processedRows > 0 && totalRows > 0) {
        const elapsedMs = Date.now() - importStartTime;
        if (elapsedMs > 500) {
            const rowsPerMs = processedRows / elapsedMs;
            const remainingRows = totalRows - processedRows;
            if (remainingRows <= 0) {
                remainingTimeText = 'Menyelesaikan proses import...';
            } else {
                const remainingSeconds = Math.ceil(remainingRows / rowsPerMs / 1000);
                if (remainingSeconds < 60) {
                    remainingTimeText = `Estimasi sisa waktu: ~${remainingSeconds} detik`;
                } else {
                    remainingTimeText = `Estimasi sisa waktu: ~${Math.floor(remainingSeconds / 60)} menit ${remainingSeconds % 60} detik`;
                }
            }
        }
    } else if (importStatus === 'IMPORTING') {
        remainingTimeText = 'Menghitung sisa waktu...';
    }

    // Filtered data for RAB table
    const filteredData = rabData.filter((item) => {
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            return (item.description || '').toLowerCase().includes(term) ||
                (item.code_item || '').toLowerCase().includes(term);
        }
        if (categoryFilter && item.category !== categoryFilter) return false;
        return true;
    });

    const groupedData = filteredData.reduce((groups, item, index) => {
        const folder = item.category || 'Tanpa Kategori';
        if (!groups[folder]) groups[folder] = { count: 0, total: 0, items: [] };
        groups[folder].count += 1;
        groups[folder].total += Number(item.total_price || 0);
        groups[folder].items.push({ item, rowNumber: index + 1 });
        return groups;
    }, {});

    const toggleFolder = (folder) => {
        setCollapsedFolders((current) => {
            const next = new Set(current);
            if (next.has(folder)) next.delete(folder);
            else next.add(folder);
            return next;
        });
    };

    // ─── RENDER: IMPORT VIEW ───
    if (view === 'import') {
        return <ManualRabImport {...{ projectId, projects, onProjectChange, onAddProject, onEditProject, onImportComplete }} />;
    }

    if (view === 'legacy-import') {
        return (
            <Card title="Import RAB" subtitle="Upload file Excel (.xlsx, .xls) atau CSV (.csv) berisi rencana anggaran biaya">
                <div className="flex items-end gap-4 flex-wrap">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Proyek</label>
                        <div className="flex gap-1 items-center">
                            <select
                                value={projectId}
                                onChange={(e) => onProjectChange(Number(e.target.value))}
                                className="rounded-lg border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm cursor-pointer min-w-[180px]"
                            >
                                {projects.map((p) => (
                                    <option key={p.id} value={p.id}>{p.project_name || `Project #${p.id}`}</option>
                                ))}
                                {projects.length === 0 && <option value={1}>Project #1</option>}
                            </select>
                            <Button variant="outline" size="sm" onClick={onAddProject} title="Tambah Proyek Baru">Tambah</Button>
                            <Button variant="outline" size="sm" onClick={onEditProject} title="Edit Proyek Terpilih">Edit</Button>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                        <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">File Excel / CSV</label>
                        <input
                            type="file"
                            accept=".xlsx,.xls,.csv,.txt"
                            onChange={handleFileChange}
                            className="rounded-lg border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
                        />
                    </div>
                </div>

                {message && (
                    <div className={`mt-4 p-3 rounded-lg text-sm font-medium border ${
                        message.includes('berhasil') || message.includes('success')
                            ? 'bg-green-50 border-green-200 text-green-800'
                            : message.includes('Gagal') || message.includes('Error')
                                ? 'bg-red-50 border-red-200 text-red-800'
                                : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}>
                        {message}
                    </div>
                )}

                {step === 2 && (
                    <div className="mt-5 p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <h4 className="mb-3 text-sm font-semibold text-slate-900">
                            Status Validasi File:{' '}
                            <span className={importStatus === 'FAILED' ? 'text-red-700' : importStatus === 'VALIDATED' ? 'text-green-700' : 'text-amber-600'}>
                                {importStatus}
                            </span>
                        </h4>

                        {(importStatus === 'PENDING' || importStatus === 'PROCESSING') && (
                            <LoadingSpinner size="sm" message="Sistem sedang membaca dan memvalidasi baris data file..." />
                        )}

                        {importStatus === 'FAILED' && (
                            <div className="text-sm text-red-800">
                                <p className="font-bold mb-2">Validasi gagal. Silakan perbaiki kesalahan berikut pada file Anda:</p>
                                <div className="max-h-48 overflow-y-auto bg-red-50 p-3 rounded-lg border border-red-200 font-mono text-xs leading-relaxed">
                                    {importErrors.map((err, i) => <div key={i} className="mb-1">• {err}</div>)}
                                </div>
                                <Button variant="outline" className="mt-4" onClick={handleResetImport}>Upload Ulang</Button>
                            </div>
                        )}

                        {importStatus === 'VALIDATED' && importDiff && (
                            <div>
                                {/* Sheet Selection */}
                                {importDiff.available_sheets && importDiff.available_sheets.length > 1 && !importDiff.selected_sheet && (
                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 mb-4">
                                        <p className="font-bold mb-2">File memiliki beberapa sheet RAB. Pilih sheet yang ingin di-import:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {importDiff.available_sheets.map((sheet) => (
                                                <button
                                                    key={sheet}
                                                    onClick={() => handleSheetSelect(sheet)}
                                                    className="px-3 py-1.5 bg-white border border-blue-300 rounded-lg hover:bg-blue-100 text-sm font-medium transition"
                                                >
                                                    {sheet}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Validation Result */}
                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 mb-4">
                                    <p className="font-bold mb-1">Validasi berhasil. Seluruh data format sesuai.</p>
                                    {importDiff.selected_sheet && (
                                        <p className="text-xs text-green-600 mb-1">Sheet: <strong>{importDiff.selected_sheet}</strong></p>
                                    )}
                                    <p>Total Baris Valid: <strong>{importJob.total_rows}</strong></p>
                                    <div className="grid grid-cols-3 gap-2 mt-3 p-2 bg-white rounded-lg border border-green-200 text-center">
                                        <div>
                                            <span className="block text-xs font-semibold uppercase tracking-wider text-gray-500">Item Baru</span>
                                            <strong className="text-lg text-green-700">+{importDiff.added_count}</strong>
                                        </div>
                                        <div>
                                            <span className="block text-xs font-semibold uppercase tracking-wider text-gray-500">Item Berubah</span>
                                            <strong className="text-lg text-amber-600">{importDiff.updated_count}</strong>
                                        </div>
                                        <div>
                                            <span className="block text-xs font-semibold uppercase tracking-wider text-gray-500">Item Dihapus</span>
                                            <strong className="text-lg text-red-700">-{importDiff.deleted_count}</strong>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={handleResetImport}>Batal</Button>
                                    <Button variant="primary" onClick={handleConfirmImport}>Konfirmasi & Import Sekarang</Button>
                                </div>
                            </div>
                        )}

                        {importStatus === 'IMPORTING' && (
                            <div className="text-sm text-gray-700">
                                <LoadingSpinner size="sm" message="Memasukkan data ke database..." />
                                <div className="mt-3">
                                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-red-700 transition-all duration-300" style={{ width: `${percent}%` }} />
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                                        <span>Memproses {processedRows} dari {totalRows} baris ({percent}%)</span>
                                        {remainingTimeText && <span className="font-semibold text-orange-700">{remainingTimeText}</span>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Card>
        );
    }

    // ─── RENDER: DATA RAB VIEW ───
    return (
        <div id="print-section">
            <Card
                title="Data RAB"
                subtitle={`${filteredData.length} item terdaftar`}
                actions={
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => window.print()}>Cetak</Button>
                        <div className="relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Cari item..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-3 py-1.5 w-40 rounded-lg border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm"
                            />
                        </div>
                        {categories.length > 0 && (
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="rounded-lg border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm cursor-pointer"
                            >
                                <option value="">Semua Kategori</option>
                                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        )}
                    </div>
                }
            >
                {loadingRab ? (
                    <LoadingSpinner message="Memuat data RAB..." />
                ) : rabData.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-slate-500">Belum ada data RAB.</p>
                        <p className="text-xs text-gray-400 italic mt-1">Upload file Excel di tab Import untuk memulai.</p>
                    </div>
                ) : (
                    <div className="-mx-6">
                        <div className="grid gap-2 border-b border-gray-200 bg-slate-50 px-6 py-4 sm:grid-cols-2 xl:grid-cols-3">
                            {Object.entries(groupedData).map(([folder, data]) => (
                                <button
                                    key={folder}
                                    type="button"
                                    onClick={() => toggleFolder(folder)}
                                    aria-expanded={!collapsedFolders.has(folder)}
                                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50 ${collapsedFolders.has(folder) ? 'border-gray-200 bg-gray-50 text-gray-500' : 'border-blue-100 bg-white'}`}
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-blue-900"><span className="mr-2" aria-hidden="true">📁</span>{folder}</p>
                                        <p className="text-xs text-gray-500">{data.count} item di dalam folder</p>
                                    </div>
                                    <strong className="ml-3 text-xs text-gray-700">{fmt(data.total)}</strong>
                                </button>
                            ))}
                        </div>
                        <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b-2 border-gray-200">
                                    {['#', 'Kode', 'Uraian Pekerjaan', 'Volume', 'Satuan', 'Harga Satuan', 'Total', 'Kategori'].map((label) => (
                                        <th key={label} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 text-left">{label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredData.map((item, i) => (
                                    <tr key={item.id} className={`${collapsedFolders.has(item.category || 'Tanpa Kategori') ? 'hidden' : 'hover:bg-amber-50'} transition-colors`}>
                                        <td className="px-4 py-3 text-gray-500 text-xs">{i + 1}</td>
                                        <td className="px-4 py-3 text-gray-500 text-xs font-mono">{item.code_item || '—'}</td>
                                        <td className="px-4 py-3 text-gray-900 font-semibold">{item.description}</td>
                                        <td className="px-4 py-3 text-gray-700 text-center">{item.volume || '—'}</td>
                                        <td className="px-4 py-3 text-gray-700 text-center">{item.unit || '—'}</td>
                                        <td className="px-4 py-3 text-gray-700 text-right font-mono">{fmt(item.unit_price)}</td>
                                        <td className="px-4 py-3 text-gray-900 text-right font-bold font-mono">{fmt(item.total_price)}</td>
                                        <td className="px-4 py-3 text-center">
                                            {item.category ? (
                                                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                                    {item.category}
                                                </span>
                                            ) : <span className="text-gray-400">—</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    </div>
                )}
            </Card>

            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #print-section, #print-section * { visibility: visible; }
                    #print-section { position: absolute; left: 0; top: 0; width: 100%; background: white !important; color: black !important; border: none !important; box-shadow: none !important; }
                    #print-section button, #print-section select, #print-section input { display: none !important; }
                    table { border-collapse: collapse !important; width: 100% !important; }
                    th, td { border: 1px solid #c4a878 !important; padding: 6px 10px !important; color: black !important; background: none !important; }
                }
            `}</style>
        </div>
    );
}
