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
  }).format(Number(value || 0));
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
  
  const grossBeforeDiscount = round2(
    invoiceItems.reduce(
      (sum, item) => sum + Number(item.sale_price_incl_vat) * Number(item.qty),
      0
    )
  );
  
  const discountAmount = round2(
    Math.min(Number(invoice.discount_amount_incl_vat || 0), grossBeforeDiscount)
  );
  
  const grossAfterDiscount = round2(grossBeforeDiscount - discountAmount);
  
  const subtotal = grossBeforeDiscount;
  
  const vatAmount = round2(
    grossBeforeDiscount - grossBeforeDiscount / (1 + Number(invoice.vat_rate) / 100)
  );
  
  const depositAmount = round2(
    grossAfterDiscount * (Number(invoice.deposit_percent) / 100)
  );
  
  const balanceDue = round2(grossAfterDiscount - depositAmount);  
  return (
    <main
      className="document-shell"
      style={{ padding: 12, fontFamily: "Arial, sans-serif", maxWidth: 1020 }}
    >
     <div
        className="no-print"
        style={{ marginBottom: 20, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}
      >
        <Link href="/invoices">← Back to invoices</Link>
        <Link href="/">Dashboard</Link>
        <a
          href={`/api/invoices/${invoiceId}/pdf`}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-block",
            padding: "10px 14px",
            background: "#111827",
            color: "#ffffff",
            textDecoration: "none",
            borderRadius: 8,
          }}
        >
          Generate PDF
        </a>
    
      </div>

      <div
        className="document-page"
        style={{
          background: "#ffffff",
          padding: 16,
          color: "#000",
          display: "grid",
          gridTemplateColumns: "185px 1fr",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: 14,
              lineHeight: 1.35,
            }}
          >
            <img
              src="/mgs-logo.svg"
              alt="Malta Gym Solutions logo"
              style={{ width: 150, height: "auto", objectFit: "contain" }}
            />
            <div>MT32531436</div>
            <div>Phone: +356 7954 9541</div>
            <div>@maltagymsolutions</div>
            <div>maltagymsolutions.com</div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              fontSize: 14,
              lineHeight: 1.35,
            }}
          >
            <div
              style={{
                fontSize: 34,
                fontWeight: 300,
                letterSpacing: "0.01em",
                lineHeight: 1,
              }}
            >
              INVOICE
            </div>
            <div>Date: {invoice.date_issued}</div>
            <div>Invoice No: {invoice.invoice_number}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gap: 4, fontSize: 14, lineHeight: 1.3 }}>
            <div style={{ fontWeight: 700 }}>
              {client?.company_name || client?.private_name || "Client"}
            </div>
            {client?.company_name && client?.contact_person ? (
              <div>Attn: {client.contact_person}</div>
            ) : null}
            {client?.email ? <div>{client.email}</div> : null}
            {client?.phone ? <div>{client.phone}</div> : null}
            {client?.vat_number ? <div>VAT No: {client.vat_number}</div> : null}
            {client?.address ? (
              <div style={{ whiteSpace: "pre-line" }}>{client.address}</div>
            ) : null}
          </div>

          <div
            style={{
              overflow: "hidden",
              border: "1px solid #ccc",
              background: "#fff",
              marginTop: 2,
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th
                    style={{
                      padding: 6,
                      textAlign: "left",
                      background: "#e10600",
                      color: "#ffffff",
                      fontSize: 12,
                      lineHeight: 1.1,
                    }}
                  >
                    Description
                  </th>
                  <th
                    style={{
                      padding: 6,
                      textAlign: "center",
                      background: "#e10600",
                      color: "#ffffff",
                      fontSize: 12,
                      lineHeight: 1.1,
                    }}
                  >
                    Qty
                  </th>
                  <th
                    style={{
                      padding: 6,
                      textAlign: "center",
                      background: "#e10600",
                      color: "#ffffff",
                      fontSize: 12,
                      lineHeight: 1.1,
                    }}
                  >
                    VAT
                  </th>
                  <th
                    style={{
                      padding: 6,
                      textAlign: "right",
                      background: "#e10600",
                      color: "#ffffff",
                      fontSize: 12,
                      lineHeight: 1.1,
                    }}
                  >
                    {isBusinessClient ? "Unit Price excl. VAT" : "Unit Price incl. VAT"}
                  </th>
                  <th
                    style={{
                      padding: 6,
                      textAlign: "right",
                      background: "#e10600",
                      color: "#ffffff",
                      fontSize: 12,
                      lineHeight: 1.1,
                    }}
                  >
                    {isBusinessClient ? "Price excl. VAT" : "Price incl. VAT"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoiceItems.map((item) => {
                  const unitDisplay = isBusinessClient
                    ? round2(
                        Number(item.sale_price_incl_vat) /
                          (1 + Number(invoice.vat_rate) / 100)
                      )
                    : Number(item.sale_price_incl_vat);

                  const lineDisplay = round2(unitDisplay * Number(item.qty));

                  return (
                    <tr key={item.id}>
                      <td
                        style={{
                          padding: 6,
                          borderTop: "1px solid #ddd",
                          fontSize: 12,
                          lineHeight: 1.15,
                          maxWidth: 260,
                          verticalAlign: "top",
                        }}
                      >
                        {item.name}
                      </td>
                      <td
                        style={{
                          padding: 6,
                          borderTop: "1px solid #ddd",
                          textAlign: "center",
                          fontSize: 12,
                          lineHeight: 1.15,
                          verticalAlign: "top",
                        }}
                      >
                        {item.qty}
                      </td>
                      <td
                        style={{
                          padding: 6,
                          borderTop: "1px solid #ddd",
                          textAlign: "center",
                          fontSize: 12,
                          lineHeight: 1.15,
                          verticalAlign: "top",
                        }}
                      >
                        {invoice.vat_rate}%
                      </td>
                      <td
                        style={{
                          padding: 6,
                          borderTop: "1px solid #ddd",
                          textAlign: "right",
                          fontSize: 12,
                          lineHeight: 1.15,
                          verticalAlign: "top",
                        }}
                      >
                        {money(unitDisplay)}
                      </td>
                      <td
                        style={{
                          padding: 6,
                          borderTop: "1px solid #ddd",
                          textAlign: "right",
                          fontSize: 12,
                          lineHeight: 1.15,
                          verticalAlign: "top",
                        }}
                      >
                        {money(lineDisplay)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ padding: 6, borderTop: "2px solid #111", fontWeight: 600 }}>
                    {isBusinessClient ? "Subtotal excl. VAT" : "Subtotal incl. VAT"}					</td>
                  <td
                    style={{
                      padding: 6,
                      borderTop: "2px solid #111",
                      textAlign: "right",
                      fontWeight: 600,
                    }}
                  >
                    {money(subtotal)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} style={{ padding: 6, borderTop: "1px dotted #ccc" }}>
                    VAT {Number(invoice.vat_rate).toFixed(2)}%
                  </td>
                  <td
                    style={{
                      padding: 6,
                      borderTop: "1px dotted #ccc",
                      textAlign: "right",
                    }}
                  >
                    {money(vatAmount)}
                  </td>
                </tr>
                {discountAmount > 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 6, borderTop: "1px dotted #ccc", fontWeight: 600 }}>
                      Discount incl. VAT
                    </td>
                    <td
                      style={{
                        padding: 6,
                        borderTop: "1px dotted #ccc",
                        textAlign: "right",
                        fontWeight: 600,
                      }}
                    >
                      -{money(discountAmount)}
                    </td>
                  </tr>
                ) : null}
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      padding: 6,
                      borderTop: "2px solid #111",
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    Total incl. VAT
                  </td>
                  <td
                    style={{
                      padding: 6,
                      borderTop: "2px solid #111",
                      textAlign: "right",
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    {money(grossAfterDiscount)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} style={{ padding: 6, borderTop: "1px dotted #ccc", fontWeight: 600 }}>
                    Deposit Required ({invoice.deposit_percent}%)
                  </td>
                  <td
                    style={{
                      padding: 6,
                      borderTop: "1px dotted #ccc",
                      textAlign: "right",
                      fontWeight: 600,
                    }}
                  >
                    {money(depositAmount)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} style={{ padding: 6, borderTop: "1px dotted #ccc", fontWeight: 600 }}>
                    Balance Due on Delivery
                  </td>
                  <td
                    style={{
                      padding: 6,
                      borderTop: "1px dotted #ccc",
                      textAlign: "right",
                      fontWeight: 600,
                    }}
                  >
                    {money(balanceDue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={{ display: "grid", gap: 4, fontSize: 13, lineHeight: 1.3 }}>
            <div>
              Payment Terms: A deposit of {money(depositAmount)} ({invoice.deposit_percent}% of the
              total invoice value after discount) is payable upon order confirmation.
            </div>
           {discountAmount > 0 ? (
              <div>
                Discount applied: {money(discountAmount)}.
              </div>
            ) : null}
            <div>
              The remaining balance of {money(balanceDue)} is payable upon delivery.
            </div>
            <div>
              Kindly transfer the deposit amount of {money(depositAmount)} to the bank account listed
              below, quoting invoice number {invoice.invoice_number} as reference.
            </div>
          </div>

          <div style={{ display: "grid", gap: 4, fontSize: 13, lineHeight: 1.3 }}>
            <div style={{ fontWeight: 700 }}>BANK DETAILS:</div>
            <div>Beneficiary: Luke Galea</div>
            <div>IBAN: LT59 3250 0534 4337 4796</div>
            <div>SWIFT/BIC: REVOLT21</div>
            <div>
              Beneficiary address: Zircon Crt, Blk A, Flt 7, Triq il-Ħmistax ta' Awissu,
              Qrendi, Malta
            </div>
            <div>
              Bank Name and Address: Revolut Bank UAB, Konstitucijos ave. 21B, 08130,
              Vilnius, Lithuania.
            </div>
          </div>

          <div style={{ display: "grid", gap: 4, fontSize: 13, lineHeight: 1.3 }}>
            <div style={{ fontWeight: 700 }}>Notes:</div>
            <div>
              {invoice.notes ||
                "All prices include delivery and installation at ground-floor level within Malta. If access conditions require the use of a lifting platform, crane, or similar equipment, any associated costs shall be borne in full by the purchaser."}
            </div>
            <div>Thank you for choosing Malta Gym Solutions!</div>
          </div>
        </div>
      </div>
    </main>
  );
}