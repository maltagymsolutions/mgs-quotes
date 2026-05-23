import React from "react";
import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import InvoicePdf from "@/src/pdf/InvoicePdf";
import { buildDocumentPdfFilename, contentDispositionInline } from "@/src/lib/pdf-filename";
import { createClient } from "@/src/lib/supabase-server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .single();

  if (invoiceError || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", invoice.client_id)
    .single();

  const { data: items } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", invoice.id);

  const { data: companySettings } = await supabase
    .from("company_settings")
    .select("vat_number")
    .limit(1)
    .single();

 const pdfElement = React.createElement(InvoicePdf, {
    invoice,
    client,
    items: items || [],
    companySettings,
  }) as React.ReactElement<never>;
  
  const stream = await renderToStream(pdfElement);
  const filename = buildDocumentPdfFilename({
    dateIssued: invoice.date_issued,
    client,
    documentNumber: invoice.invoice_number,
  });

  return new NextResponse(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDispositionInline(filename),
    },
  });
}
