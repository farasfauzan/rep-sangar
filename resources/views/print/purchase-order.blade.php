<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Cetak PO - {{ $po->po_number }}</title>
    <style>
        @page { size: A4 portrait; margin: 12mm 13mm 16mm; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #fff; color: #111; }
        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11px;
            line-height: 1.3;
        }
        .toolbar {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            margin: 0 0 14px;
        }
        .toolbar button {
            border: 0;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            padding: 7px 16px;
        }
        .toolbar .print { background: #1d4ed8; color: #fff; }
        .toolbar .back { background: #e5e7eb; color: #111; }
        .sheet { width: 100%; }
        .letterhead {
            margin-bottom: 6px;
            text-align: center;
        }
        .letterhead img {
            display: block;
            height: auto;
            margin: 0 auto 2px;
            max-width: 185px;
        }
        .letterhead p {
            color: #2875b8;
            font-size: 9px;
            line-height: 1.1;
            margin: 1px 0;
        }
        .recipient {
            line-height: 1.35;
            margin-top: 7px;
        }
        .recipient p { margin: 0; }
        .recipient .name { font-weight: 700; }
        .document-title {
            border: 1px solid #222;
            font-size: 20px;
            font-weight: 700;
            letter-spacing: .2px;
            margin: 11px 0 9px;
            padding: 4px 0;
            text-align: center;
        }
        .meta {
            border-collapse: collapse;
            margin-bottom: 10px;
            width: 100%;
        }
        .meta td {
            padding: 1px 3px;
            vertical-align: top;
        }
        .meta .label { white-space: nowrap; width: 78px; }
        .meta .colon { text-align: center; width: 14px; }
        .intro {
            line-height: 1.35;
            margin: 8px 0 9px;
        }
        .items {
            border-collapse: collapse;
            table-layout: fixed;
            width: 100%;
        }
        .items thead { display: table-header-group; }
        .items tr { page-break-inside: avoid; }
        .items .total-row { page-break-inside: avoid; }
        .items th {
            background: #d9d9d9;
            border: 1px solid #222;
            font-weight: 700;
            padding: 4px 3px;
            text-align: center;
        }
        .items td {
            border: 1px solid #444;
            padding: 3px 4px;
            vertical-align: top;
        }
        .items .no { text-align: center; width: 5%; }
        .items .description { text-align: left; width: 39%; }
        .items .quantity { text-align: center; width: 10%; }
        .items .unit { text-align: center; width: 10%; }
        .items .duration { text-align: center; width: 10%; }
        .items .money {
            text-align: right;
            white-space: nowrap;
            width: 13%;
        }
        .items .group-row td { font-weight: 700; }
        .items .note-row td { font-style: italic; }
        .items .note-row .description { padding-left: 12px; }
        .total-row td {
            border-bottom: 2px solid #222;
            border-top: 2px solid #222;
            font-weight: 700;
            padding-bottom: 5px;
            padding-top: 5px;
        }
        .total-row .total-label { text-align: center; }
        .total-row .money { text-align: right; }
        .post-table { page-break-inside: avoid; }
        .notes {
            margin-top: 8px;
        }
        .notes-title { font-weight: 700; }
        .notes p {
            margin: 2px 0;
            padding-left: 12px;
        }
        .notes .emphasis {
            color: #d00000;
            font-weight: 700;
        }
        .tax {
            margin-top: 9px;
        }
        .tax-title { font-weight: 700; }
        .tax table {
            border-collapse: collapse;
            margin-top: 2px;
        }
        .tax td { padding: 1px 4px 1px 0; vertical-align: top; }
        .tax .label { font-weight: 700; width: 56px; }
        .closing { margin-top: 14px; }
        .signature {
            margin: 27px 22px 0 auto;
            text-align: center;
            width: 220px;
        }
        .signature .space { height: 54px; }
        .signature .company,
        .signature .name { font-weight: 700; }
        .signature p { margin: 2px 0; }
        .page-footer {
            color: #666;
            display: none;
            font-size: 8px;
            text-align: center;
        }
        @media print {
            .toolbar { display: none !important; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page-footer {
                display: block;
                position: fixed;
                bottom: -10mm;
                left: 0;
                right: 0;
            }
            .page-footer::after {
                content: "Halaman " counter(page) " dari " counter(pages);
            }
        }
    </style>
</head>
<body>
    @php
        $formatQty = static function ($value): string {
            $formatted = number_format((float) $value, 2, ',', '.');
            return rtrim(rtrim($formatted, '0'), ',');
        };
        $formatMoney = static fn ($value): string => 'Rp ' . number_format((float) $value, 2, ',', '.');
        $logoPath = public_path('images/logo-scs.png');
        $logoSrc = file_exists($logoPath)
            ? 'data:image/png;base64,' . base64_encode((string) file_get_contents($logoPath))
            : asset('images/logo-scs.png');
        $hasDuration = $po->items->contains(fn ($item) => (bool) (data_get($item, 'durasi') ?: data_get($item, 'duration')));
        $noteLines = $po->catatan
            ? preg_split('/\r\n|\r|\n/', (string) $po->catatan, -1, PREG_SPLIT_NO_EMPTY)
            : [];
    @endphp

        @unless($isPdf ?? false)
            <div class="toolbar">
            <button class="print" type="button" onclick="window.print()">Cetak</button>
            <button class="back" type="button" onclick="window.history.back()">Kembali</button>
        </div>
        @endunless

        <div class="page-footer" aria-hidden="true"></div>

    <main class="sheet">
        <div class="letterhead">
            <img src="{{ $logoSrc }}" alt="PT. Sinar Cerah Sempurna">
            <p>Karangrejo Barat No. 9 RT 002 RW 002</p>
            <p>Tinjomoyo, Banyumanik, Semarang</p>
            <p>NPWP: 002.652.984.2-331.000</p>
        </div>

        <div class="recipient">
            <p>Kepada Yth.</p>
            <p class="name">{{ $po->supplier_name ?: '-' }}</p>
            @if($po->supplier_address)<p>{{ $po->supplier_address }}</p>@endif
            @if($po->supplier_phone || $po->supplier_contact_person)
                <p>
                    @if($po->supplier_phone)Telp. {{ $po->supplier_phone }}@endif
                    @if($po->supplier_phone && $po->supplier_contact_person) &nbsp; @endif
                    @if($po->supplier_contact_person)Up. {{ $po->supplier_contact_person }}@endif
                </p>
            @endif
        </div>

        <div class="document-title">
            {{ $po->po_type === 'REVISI' ? 'PURCHASE ORDER REVISI' : ($po->po_type === 'ADDENDUM' ? 'PURCHASE ORDER (ADDENDUM ' . ($po->addendum_number ?: 'I') . ')' : 'PURCHASE ORDER') }}
        </div>

        <table class="meta">
            <tr><td class="label">Nomor</td><td class="colon">:</td><td>{{ $po->po_number }}</td></tr>
            <tr><td class="label">Tanggal</td><td class="colon">:</td><td>{{ \Carbon\Carbon::parse($po->date)->locale('id')->translatedFormat('d F Y') }}</td></tr>
            <tr><td class="label">Proyek</td><td class="colon">:</td><td>{{ $po->project?->project_name ?: '-' }}</td></tr>
            <tr><td class="label">Lokasi</td><td class="colon">:</td><td>{{ $po->project_location ?: ($po->project?->location ?: '-') }}</td></tr>
            <tr><td class="label">Contact Person</td><td class="colon">:</td><td>{{ $po->supplier_contact_person ?: '-' }}</td></tr>
        </table>

        <div class="intro">
            <p>Dengan hormat,</p>
            <p>Bersama ini kami mohon diadakan material pada proyek tersebut diatas dengan data sebagai berikut :</p>
        </div>

        <table class="items">
            <colgroup>
                <col class="no">
                <col class="description">
                <col class="quantity">
                <col class="unit">
                @if($hasDuration)<col class="duration">@endif
                <col class="money">
                <col class="money">
            </colgroup>
            <thead>
                <tr>
                    <th>No</th>
                    <th>Uraian</th>
                    <th>Volume</th>
                    <th>Satuan</th>
                    @if($hasDuration)<th>Durasi</th>@endif
                    <th>Harga Satuan</th>
                    <th>Jumlah</th>
                </tr>
            </thead>
            <tbody>
                @forelse($po->items as $i => $item)
                    @php
                        $itemName = trim((string) ($item->item_name ?: ($item->rabBudget?->description ?: '-')));
                        $isNote = preg_match('/^(note\s*:|[-*]\s)/i', $itemName) === 1;
                        $duration = data_get($item, 'durasi') ?: data_get($item, 'duration');
                        $unit = $item->rabBudget?->unit ?: data_get($item, 'unit');
                    @endphp
                    <tr class="{{ $isNote ? 'note-row' : '' }}">
                        <td class="no">{{ $isNote ? '' : $i + 1 }}</td>
                        <td class="description">{{ $itemName }}</td>
                        <td class="quantity">{{ $isNote ? '' : $formatQty($item->qty) }}</td>
                        <td class="unit">{{ $isNote ? '' : ($unit ?: '-') }}</td>
                        @if($hasDuration)<td class="duration">{{ $isNote ? '' : ($duration ?: '') }}</td>@endif
                        <td class="money">{{ $isNote ? '' : $formatMoney($item->unit_price) }}</td>
                        <td class="money">{{ $isNote ? '' : $formatMoney($item->total_price) }}</td>
                    </tr>
                @empty
                    <tr><td class="description" colspan="{{ $hasDuration ? 7 : 6 }}">Tidak ada item.</td></tr>
                @endforelse
                <tr class="total-row">
                    <td colspan="{{ $hasDuration ? 6 : 5 }}" class="total-label">TOTAL</td>
                    <td class="money">{{ $formatMoney($po->total_amount ?: $po->subtotal) }}</td>
                </tr>
            </tbody>
        </table>

        <div class="post-table">
            @if(count($noteLines) || $po->payment_terms)
                <div class="notes">
                    <span class="notes-title">Catatan :</span>
                    @foreach($noteLines as $line)
                        <p class="{{ preg_match('/invoice|pph|pajak|materai/i', $line) ? 'emphasis' : '' }}">{{ $line }}</p>
                    @endforeach
                    @if($po->payment_terms)
                        <p>Sistem Pembayaran: {{ $po->payment_terms }}</p>
                    @endif
                </div>
            @endif

            @if($po->faktur_pajak_nama || $po->faktur_pajak_npwp || $po->faktur_pajak_alamat)
                <div class="tax">
                    <div class="tax-title">** Untuk Faktur Pajak</div>
                    <table>
                        @if($po->faktur_pajak_nama)<tr><td class="label">Nama</td><td>:</td><td>{{ $po->faktur_pajak_nama }}</td></tr>@endif
                        @if($po->faktur_pajak_npwp)<tr><td class="label">NPWP</td><td>:</td><td>{{ $po->faktur_pajak_npwp }}</td></tr>@endif
                        @if($po->faktur_pajak_alamat)<tr><td class="label">Alamat</td><td>:</td><td>{{ $po->faktur_pajak_alamat }}</td></tr>@endif
                    </table>
                </div>
            @endif

            <p class="closing">Demikian surat dari kami, atas perhatian dan kerjasamanya kami ucapkan terima kasih.</p>

            <div class="signature">
                <p>Hormat kami,</p>
                <p class="company">PT. SINAR CERAH SEMPURNA</p>
                <div class="space"></div>
                <p class="name">NARWAN PRATANTA, ST</p>
                <p>Manager Komersial</p>
            </div>
        </div>
    </main>
</body>
</html>
