import React from "react";
import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import DeliveryReceiptPdf from "@/src/pdf/DeliveryReceiptPdf";
import {
  buildDeliveryReceiptPdfFilename,
  contentDispositionInline,
} from "@/src/lib/pdf-filename";
import { createClient } from "@/src/lib/supabase-server";

export const dynamic = "force-dynamic";

const DEFAULT_CONDITIONS = [
  "Delivered in good condition",
  "Installed and tested",
];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const supabase = await createClient();

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .single();

  if (invoiceError || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const [{ data: client }, { data: allItems }, { data: companySettings }] =
    await Promise.all([
      supabase.from("clients").select("*").eq("id", invoice.client_id).single(),
      supabase
        .from("invoice_items")
        .select("id, name, qty, package_contents")
        .eq("invoice_id", invoice.id),
      supabase.from("company_settings").select("vat_number").limit(1).single(),
    ]);

  const selectedItemIds = url.searchParams.getAll("itemId");
  const items =
    selectedItemIds.length > 0
      ? (allItems || []).filter((item) => selectedItemIds.includes(item.id))
      : allItems || [];

  if (items.length === 0) {
    return NextResponse.json(
      { error: "Select at least one delivered item" },
      { status: 400 }
    );
  }

  const conditions = url.searchParams
    .getAll("condition")
    .map((condition) => condition.trim())
    .filter(Boolean);
  const deliveryDate =
    url.searchParams.get("deliveryDate") || new Date().toISOString().slice(0, 10);
  const customerName =
    url.searchParams.get("customerName") ||
    client?.company_name ||
    client?.private_name ||
    "Customer";
  const deliveryAddress =
    url.searchParams.get("deliveryAddress") || client?.address || "";

  const pdfElement = React.createElement(DeliveryReceiptPdf, {
    invoice,
    client,
    items,
    companySettings,
    delivery: {
      customerName,
      deliveryAddress,
      deliveryDate,
      conditions: conditions.length > 0 ? conditions : DEFAULT_CONDITIONS,
    },
  }) as React.ReactElement<never>;

  const stream = await renderToStream(pdfElement);
  const filename = buildDeliveryReceiptPdfFilename({
    deliveryDate,
    client,
    invoiceNumber: invoice.invoice_number,
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
