"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/src/lib/supabase-browser";

type PageProps = {
  params: Promise<{ id: string }>;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function money(value: number) {
  return new Intl.NumberFormat("en-MT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function InvoiceDetailPage({ params }: PageProps) {
  const supabase = createClient();

  const [invoiceId, setInvoiceId] = useState("");
  const [invoice, setInvoice] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function resolveParamsAndLoad() {
      const resolved = await params;
      setInvoiceId(resolved.id);
    }
    resolveParamsAndLoad();
  }, [params]);

  useEffect(() => {
    if (!invoiceId) return;

    async function loadData() {
      setLoading(true);

      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .single();

      if (invoiceError || !invoiceData) {
        setInvoice(null);
        setLoading(false);
        return;
      }

      setInvoice(invoiceData);

      const { data: clientData } = await supabase
        .from("clients")
        .select("*")
        .eq("id", invoiceData.client_id)
        .single();

      const { data: itemsData } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceData.id);

      setClient(clientData || null);
      setInvoiceItems(itemsData || []);
      setLoading(false);
    }

    loadData();
  }, [invoiceId, supabase]);

  if (loading) {
    return (
      <main style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
        <Link href="/invoices">← Back to invoices</Link>
        <h1 style={{ marginTop: 20 }}>Loading invoice...</h1>
      </main>
    );
  }

  if (!invoice) {
    return (
      <main style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
        <Link href="/invoices">← Back to invoices</Link>
        <h1 style={{ marginTop: 20 }}>Invoice not found</h1>
      </main>
    );
  }

  const isBusinessClient = !!client?.is_business_client;

  const grossTotal = round2(
    invoiceItems.reduce(
      (sum, item) => sum + Number(item.sale_price_incl_vat) * Number(item.qty),
      0
    )
  );

  const subtotal = isBusinessClient
    ? round2(grossTotal / (1 + Number(invoice.vat_rate) / 100))
    : grossTotal;

  const vatAmount = isBusinessClient
    ? round2(grossTotal - subtotal)
    : round2(grossTotal - grossTotal / (1 + Number(invoice.vat_rate) / 100));

  const depositAmount = round2(grossTotal * (Number(invoice.deposit_percent) / 100));

  return (
<main className="document-shell" style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 1100 }}>
<div className="no-print" style={{ marginBottom: 20, display: "flex", gap: 16, alignItems: "center" }}>
        <Link href="/invoices">← Back to invoices</Link>
        <Link href="/">Dashboard</Link>
        <button
          onClick={() => window.print()}
          style={{ padding: "10px 14px", cursor: "pointer" }}
        >
          Print / Save PDF
        </button>
      </div>

      <div
  className="document-page"
        style={{
          background: "#ffffff",
          padding: 24,
          color: "#000",
          display: "grid",
          gridTemplateColumns: "240px 1fr",
          gap: 20,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
<img
  src="/mgs-logo.svg"
  alt="Malta Gym Solutions logo"
  style={{ width: 180, height: "auto", objectFit: "contain" }}
/>            <div>MT32531436</div>
            <div>Phone: +356 7954 9541</div>
            <div>@maltagymsolutions</div>
            <div>maltagymsolutions.com</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
<div style={{ fontSize: 46, fontWeight: 300, letterSpacing: "0.02em" }}>INVOICE</div>
            <div>Date: {invoice.date_issued}</div>
            <div>Invoice No: {invoice.invoice_number}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "grid", gap: 8, fontSize: 18 }}>
            <div style={{ fontWeight: 700 }}>
              {client?.company_name || client?.private_name || "Client"}
            </div>
            {client?.company_name && client?.contact_person ? (
              <div>Attn: {client.contact_person}</div>
            ) : null}
            {client?.email ? <div>{client.email}</div> : null}
            {client?.phone ? <div>{client.phone}</div> : null}
            {client?.vat_number ? <div>VAT No: {client.vat_number}</div> : null}
            {client?.address ? <div style={{ whiteSpace: "pre-line" }}>{client.address}</div> : null}
          </div>

          <div style={{ overflow: "hidden", border: "1px solid #ccc", background: "#fff" }}>
<table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
              <thead>
                <tr>
                  <th style={{ padding: 10, textAlign: "left", background: "#e10600", color: "#ffffff" }}>
                    Description
                  </th>
                  <th style={{ padding: 10, textAlign: "center", background: "#e10600", color: "#ffffff" }}>
                    Qty
                  </th>
                  <th style={{ padding: 10, textAlign: "center", background: "#e10600", color: "#ffffff" }}>
                    VAT
                  </th>
                  <th style={{ padding: 10, textAlign: "right", background: "#e10600", color: "#ffffff" }}>
                    {isBusinessClient ? "Unit Price excl. VAT" : "Unit Price incl. VAT"}
                  </th>
                  <th style={{ padding: 12, textAlign: "right", background: "#e10600", color: "#ffffff" }}>
                    {isBusinessClient ? "Price excl. VAT" : "Price incl. VAT"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoiceItems.map((item) => {
                  const unitDisplay = isBusinessClient
                    ? round2(Number(item.sale_price_incl_vat) / (1 + Number(invoice.vat_rate) / 100))
                    : Number(item.sale_price_incl_vat);

                  const lineDisplay = round2(unitDisplay * Number(item.qty));

                  return (
                    <tr key={item.id}>
                      <td style={{ padding: 12, borderTop: "1px solid #ddd" }}>{item.name}</td>
                      <td style={{ padding: 12, borderTop: "1px solid #ddd", textAlign: "center" }}>{item.qty}</td>
                      <td style={{ padding: 12, borderTop: "1px solid #ddd", textAlign: "center" }}>
                        {invoice.vat_rate}%
                      </td>
                      <td style={{ padding: 12, borderTop: "1px solid #ddd", textAlign: "right" }}>
{money(unitDisplay)}
                      </td>
                      <td style={{ padding: 12, borderTop: "1px solid #ddd", textAlign: "right" }}>
{money(lineDisplay)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ padding: 12, borderTop: "2px solid #111", fontWeight: 600 }}>
                    Subtotal
                  </td>
                  <td style={{ padding: 12, borderTop: "2px solid #111", textAlign: "right", fontWeight: 600 }}>
{money(subtotal)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} style={{ padding: 12, borderTop: "1px dotted #ccc" }}>
                    VAT {Number(invoice.vat_rate).toFixed(2)}%
                  </td>
                  <td style={{ padding: 12, borderTop: "1px dotted #ccc", textAlign: "right" }}>
{money(vatAmount)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} style={{ padding: 12, borderTop: "2px solid #111", fontWeight: 700, fontSize: 18 }}>
                    Total incl. VAT
                  </td>
                  <td style={{ padding: 12, borderTop: "2px solid #111", textAlign: "right", fontWeight: 700, fontSize: 18 }}>
{money(grossTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div>
              Payment Terms: {invoice.deposit_percent}% deposit upon order ({money(depositAmount)}),
              remaining balance upon delivery.
            </div>
            <div>Invoice Terms: payment due as agreed.</div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 700 }}>Notes:</div>
            <div>{invoice.notes || "No notes."}</div>
          </div>
        </div>
      </div>
    </main>
  );
}