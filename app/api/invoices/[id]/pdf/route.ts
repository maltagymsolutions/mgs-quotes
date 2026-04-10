import React from "react";
import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import InvoicePdf from "@/src/pdf/InvoicePdf";
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

 const pdfElement = React.createElement(InvoicePdf, {
    invoice,
    client,
    items: items || [],
  }) as React.ReactElement<any>;
  
  const stream = await renderToStream(pdfElement);

  return new NextResponse(stream as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${invoice.invoice_number}.pdf"`,
    },
  });
}