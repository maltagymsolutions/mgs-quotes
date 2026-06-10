import React from "react";
import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import QuotePdf from "@/src/pdf/QuotePdf";
import { buildDocumentPdfFilename, contentDispositionInline } from "@/src/lib/pdf-filename";
import { createClient } from "@/src/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .single();

  if (quoteError || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", quote.client_id)
    .single();

  const { data: items } = await supabase
    .from("quote_items")
    .select("*")
    .eq("quote_id", quote.id);

  const { data: companySettings } = await supabase
    .from("company_settings")
    .select("vat_number")
    .limit(1)
    .single();

  const pdfElement = React.createElement(QuotePdf, {
    quote,
    client,
    items: items || [],
    companySettings,
  }) as React.ReactElement<never>;
  
  const stream = await renderToStream(pdfElement);
  const filename = buildDocumentPdfFilename({
    dateIssued: quote.date_issued,
    client,
    documentNumber: quote.quote_number,
  });
  
  return new NextResponse(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDispositionInline(filename),
      "Cache-Control": "no-store, max-age=0",
      "Pragma": "no-cache",
    },
  });
}
