<?php

namespace App\Http\Controllers;

use App\Models\Bast;
use App\Models\Invoice;
use App\Models\PurchaseOrder;
use App\Models\Spk;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;

class PrintController extends Controller
{
    public function purchaseOrder(int $id)
    {
        $po = PurchaseOrder::with(['items.rabBudget', 'project', 'attachments'])->findOrFail($id);
        return view('print.purchase-order', ['po' => $po]);
    }

    public function spk(int $id)
    {
        $spk = Spk::with(['project', 'progress'])->findOrFail($id);
        return view('print.spk', ['spk' => $spk]);
    }

    public function bast(int $id)
    {
        $bast = Bast::with('opname.spk.project')->findOrFail($id);
        return view('print.bast', ['bast' => $bast]);
    }

    public function invoice(int $id)
    {
        $invoice = Invoice::with(['invoiceable', 'transactions'])->findOrFail($id);
        return view('print.invoice', ['invoice' => $invoice]);
    }

    public function purchaseOrderPdf(int $id): Response
    {
        $po = PurchaseOrder::with(['items.rabBudget', 'project', 'attachments'])->findOrFail($id);
        $pdf = Pdf::loadView('print.purchase-order', ['po' => $po, 'isPdf' => true])
            ->setPaper('a4', 'portrait');

        $pdf->render();
        $pdf->getDomPDF()->getCanvas()->page_text(
            260,
            830,
            'Halaman {PAGE_NUM} dari {PAGE_COUNT}',
            'Helvetica',
            8,
            [0.4, 0.4, 0.4]
        );

        return $pdf->download("PO-{$po->po_number}.pdf");
    }

    public function spkPdf(int $id): Response
    {
        $spk = Spk::with(['project', 'progress'])->findOrFail($id);
        $pdf = Pdf::loadView('print.spk', ['spk' => $spk])
            ->setPaper('a4', 'portrait');

        return $pdf->download("SPK-{$spk->spk_number}.pdf");
    }

    public function bastPdf(int $id): Response
    {
        $bast = Bast::with('opname.spk.project')->findOrFail($id);
        $pdf = Pdf::loadView('print.bast', ['bast' => $bast])
            ->setPaper('a4', 'portrait');

        return $pdf->download("BAST-{$bast->bast_number}.pdf");
    }

    public function invoicePdf(int $id): Response
    {
        $invoice = Invoice::with(['invoiceable', 'transactions'])->findOrFail($id);
        $pdf = Pdf::loadView('print.invoice', ['invoice' => $invoice])
            ->setPaper('a4', 'portrait');

        return $pdf->download("Invoice-{$invoice->invoice_number}.pdf");
    }
}
