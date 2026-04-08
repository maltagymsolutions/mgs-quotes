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

export default function QuoteDetailPage({ params }: PageProps) {
  const supabase = createClient();

  const [quoteId, setQuoteId] = useState("");
  const [quote, setQuote] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [quoteItems, setQuoteItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function resolveParamsAndLoad() {
      const resolved = await params;
      setQuoteId(resolved.id);
    }
    resolveParamsAndLoad();
  }, [params]);

  useEffect(() => {
    if (!quoteId) return;

    async function loadData() {
      setLoading(true);

      const { data: quoteData, error: quoteError } = await supabase
        .from("quotes")
        .select("*")
        .eq("id", quoteId)
        .single();

      if (quoteError || !quoteData) {
        setQuote(null);
        setLoading(false);
        return;
      }

      setQuote(quoteData);

      const { data: clientData } = await supabase
        .from("clients")
        .select("*")
        .eq("id", quoteData.client_id)
        .single();

      const { data: itemsData } = await supabase
        .from("quote_items")
        .select("*")
        .eq("quote_id", quoteData.id);

      setClient(clientData || null);
      setQuoteItems(itemsData || []);
      setLoading(false);
    }

    loadData();
  }, [quoteId, supabase]);

  if (loading) {
    return (
      <main style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
        <Link href="/quotes">← Back to quotes</Link>
        <h1 style={{ marginTop: 20 }}>Loading quote...</h1>
      </main>
    );
  }

  if (!quote) {
    return (
      <main style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
        <Link href="/quotes">← Back to quotes</Link>
        <h1 style={{ marginTop: 20 }}>Quote not found</h1>
      </main>
    );
  }

  const isBusinessClient = !!client?.is_business_client;

  const grossTotal = round2(
    quoteItems.reduce(
      (sum, item) => sum + Number(item.sale_price_incl_vat) * Number(item.qty),
      0
    )
  );

function money(value: number) {
  return new Intl.NumberFormat("en-MT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

  const subtotal = isBusinessClient
    ? round2(grossTotal / (1 + Number(quote.vat_rate) / 100))
    : grossTotal;

  const vatAmount = isBusinessClient
    ? round2(grossTotal - subtotal)
    : round2(grossTotal - grossTotal / (1 + Number(quote.vat_rate) / 100));

  const depositAmount = round2(grossTotal * (Number(quote.deposit_percent) / 100));

  return (
	<main className="document-shell" style={{ padding: 24, fontFamily: "Arial, sans-serif", 	maxWidth: 1100 }}>
<div className="no-print" style={{ marginBottom: 20, display: "flex", gap: 16, alignItems: "center" }}>
        <Link href="/quotes">← Back to quotes</Link>
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
          gap: 16,
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
<div style={{ fontSize: 46, fontWeight: 300, letterSpacing: "0.02em" }}>QUOTE</div>
            <div>Date: {quote.date_issued}</div>
            <div>Quote No: {quote.quote_number}</div>
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
                {quoteItems.map((item) => {
                  const unitDisplay = isBusinessClient
                    ? round2(Number(item.sale_price_incl_vat) / (1 + Number(quote.vat_rate) / 100))
                    : Number(item.sale_price_incl_vat);

                  const lineDisplay = round2(unitDisplay * Number(item.qty));

                  return (
                    <tr key={item.id}>
                      <td style={{ padding: 12, borderTop: "1px solid #ddd" }}>{item.name}</td>
                      <td style={{ padding: 12, borderTop: "1px solid #ddd", textAlign: "center" }}>{item.qty}</td>
                      <td style={{ padding: 12, borderTop: "1px solid #ddd", textAlign: "center" }}>
                        {quote.vat_rate}%
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
                    VAT {Number(quote.vat_rate).toFixed(2)}%
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
              Payment Terms: {quote.deposit_percent}% deposit upon order ({money(depositAmount)}),
              remaining balance upon delivery.
            </div>
            <div>Quote Validity: 10 days from date of issue</div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 700 }}>Notes:</div>
            <div>{quote.notes || "No notes."}</div>
          </div>
        </div>
      </div>
    </main>
  );
}