<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Cetak BAST - {{ $bast->bast_number }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; color: #1a1a1a; line-height: 1.6; }
        .container { max-width: 210mm; margin: 0 auto; padding: 20mm; }
        .header { text-align: center; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; margin-bottom: 24px; }
        .header h1 { font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; }
        .header h2 { font-size: 14px; font-weight: 600; color: #4f46e5; margin-top: 4px; }
        .info-table { width: 100%; margin-bottom: 20px; }
        .info-table td { padding: 4px 0; vertical-align: top; }
        .info-table .label { color: #666; width: 160px; }
        .info-table .value { font-weight: 600; }
        .section { margin-bottom: 20px; }
        .section h3 { font-size: 13px; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
        .notes { padding: 12px; background: #f5f5f5; border-radius: 4px; min-height: 60px; }
        .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 48px; padding-top: 16px; border-top: 1px solid #ccc; }
        .sig-box { text-align: center; }
        .sig-box .name { margin-top: 60px; font-weight: 600; border-top: 1px solid #1a1a1a; padding-top: 4px; display: inline-block; min-width: 180px; }
        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .container { padding: 10mm; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px;">
                <img
                    src="/images/logo-scs.png"
                    alt="PT. Sinar Cerah Sempurna"
                    style="width: 280px; height: auto; max-width: 100%;"
                />
                <div style="text-align: left;">
                    <p style="font-size: 10px; color: #4a90d9; margin: 2px 0;">Karangrejo Barat No. 9 RT 002 RW 002</p>
                    <p style="font-size: 10px; color: #4a90d9;">Tinjomoyo, Banyumanik, Semarang</p>
                    <p style="font-size: 10px; color: #4a90d9;">NPWP: 002.652.984.2-331.000</p>
                </div>
            </div>
            <h2 style="font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #1e3a5f; border-top: 1px solid #e87d2f; padding-top: 8px;">Berita Acara Serah Terima</h2>
            <h3 style="font-size: 14px; font-weight: 600; color: #e87d2f; margin-top: 4px;">BAST</h3>
        </div>

        <table class="info-table">
            <tr><td class="label">Nomor BAST</td><td class="value">: {{ $bast->bast_number }}</td></tr>
            <tr><td class="label">Tanggal BAST</td><td class="value">: {{ \Carbon\Carbon::parse($bast->bast_date)->format('d F Y') }}</td></tr>
            <tr><td class="label">Nomor Opname</td><td class="value">: {{ $bast->opname->opname_number }}</td></tr>
            <tr><td class="label">SPK</td><td class="value">: {{ $bast->opname->spk->spk_number ?? '-' }}</td></tr>
            <tr><td class="label">Proyek</td><td class="value">: {{ $bast->opname->spk->project->name ?? '-' }}</td></tr>
        </table>

        <div class="section">
            <h3>Catatan</h3>
            <div class="notes">{{ $bast->notes ?: '-' }}</div>
        </div>

        <div class="signatures">
            <div class="sig-box">
                <p>Penyerah</p>
                <div class="name">&nbsp;</div>
            </div>
            <div class="sig-box">
                <p>Penerima</p>
                <div class="name">&nbsp;</div>
            </div>
        </div>
    </div>
</body>
</html>
