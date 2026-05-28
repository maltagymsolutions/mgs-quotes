import React from "react";
import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { createClient } from "@/src/lib/supabase-server";
import {
  buildReceiptPdfFilename,
  contentDispositionInline,
} from "@/src/lib/pdf-filename";
import {
  PAYMENT_RECEIPT_TYPE_LABELS,
  PaymentReceiptType,
} from "@/src/lib/payment-receipts";
import PaymentReceiptPdf from "@/src/pdf/PaymentReceiptPdf";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: receipt, error: receiptError } = await supabase
    .from("payment_receipts")
    .select("*")
    .eq("id", id)
    .single();

  if (receiptError || !receipt) {
    return NextResponse.json({ error: "Payment receipt not found" }, { status: 404 });
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", receipt.invoice_id)
    .single();

  if (invoiceError || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const [{ data: client }, { data: items }, { data: allReceipts }, { data: companySettings }] =
    await Promise.all([
      supabase.from("clients").select("*").eq("id", invoice.client_id).single(),
      supabase.from("invoice_items").select("*").eq("invoice_id", invoice.id),
      supabase.from("payment_receipts").select("*").eq("invoice_id", invoice.id),
      supabase.from("company_settings").select("vat_number").limit(1).single(),
    ]);

  const pdfElement = React.createElement(PaymentReceiptPdf, {
    receipt,
    allReceipts: allReceipts || [],
    invoice,
    client,
    items: items || [],
    companySettings,
  }) as React.ReactElement<never>;

  const stream = await renderToStream(pdfElement);
  const receiptType = receipt.receipt_type as PaymentReceiptType;
  const filename = buildReceiptPdfFilename({
    receiptDate: receipt.receipt_date,
    client,
    receiptLabel: PAYMENT_RECEIPT_TYPE_LABELS[receiptType] || "Payment",
  });

  return new NextResponse(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDispositionInline(filename),
    },
  });
}
