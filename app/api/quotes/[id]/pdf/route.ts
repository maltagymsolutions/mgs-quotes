import React from "react";
import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import QuotePdf from "@/src/pdf/QuotePdf";
import { createClient } from "@/src/lib/supabase-server";

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

  const stream = await renderToStream(
    React.createElement(QuotePdf, {
      quote,
      client,
      items: items || [],
    })
  );

  return new NextResponse(stream as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="quote-${quote.quote_number}.pdf"`,
    },
  });
}