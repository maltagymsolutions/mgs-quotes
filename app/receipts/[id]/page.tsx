"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { formatDisplayDate } from "@/src/lib/format-date";
import {
  calculateInvoiceReceiptTotals,
  calculateStillOwingAfterReceipt,
  PAYMENT_RECEIPT_TYPE_LABELS,
  PaymentReceiptType,
} from "@/src/lib/payment-receipts";
import { createClient } from "@/src/lib/supabase-browser";

type PageProps = {
  params: Promise<{ id: string }>;
};

type CompanySettings = {
  vat_number: string | null;
};

type Client = {
  company_name?: string | null;
  private_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

type Invoice = {
  id: string;
  client_id: string;
  date_issued: string;
  invoice_number: string;
  deposit_percent: number | string;
  discount_amount_incl_vat?: number | string | null;
};

type InvoiceItem = {
  qty: number | string;
  sale_price_incl_vat: number | string;
};

type PaymentReceipt = {
  id: string;
  invoice_id: string;
  receipt_type: PaymentReceiptType;
  receipt_date: string;
  amount_paid: number | string;
  created_at?: string | null;
};

function money(value: number) {
  return new Intl.NumberFormat("en-MT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export default function PaymentReceiptDetailPage({ params }: PageProps) {
  const supabase = createClient();

  const [receiptId, setReceiptId] = useState("");
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [allReceipts, setAllReceipts] = useState<PaymentReceipt[]>([]);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function resolveParams() {
      const resolved = await params;
      setReceiptId(resolved.id);
    }

    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!receiptId) return;

    async function loadReceipt() {
      setLoading(true);

      const { data: receiptData, error: receiptError } = await supabase
        .from("payment_receipts")
        .select("*")
        .eq("id", receiptId)
        .single();

      if (receiptError || !receiptData) {
        setReceipt(null);
        setLoading(false);
        return;
      }

      const typedReceipt = receiptData as PaymentReceipt;
      setReceipt(typedReceipt);

      const { data: invoiceData } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", typedReceipt.invoice_id)
        .single();

      if (!invoiceData) {
        setInvoice(null);
        setLoading(false);
        return;
      }

      const typedInvoice = invoiceData as Invoice;
      setInvoice(typedInvoice);

      const [
        { data: clientData },
        { data: itemsData },
        { data: receiptsData },
        { data: companySettingsData },
      ] = await Promise.all([
        supabase.from("clients").select("*").eq("id", typedInvoice.client_id).single(),
        supabase.from("invoice_items").select("*").eq("invoice_id", typedInvoice.id),
        supabase.from("payment_receipts").select("*").eq("invoice_id", typedInvoice.id),
        supabase.from("company_settings").select("vat_number").limit(1).single(),
      ]);

      setClient((clientData || null) as Client | null);
      setInvoiceItems((itemsData || []) as InvoiceItem[]);
      setAllReceipts((receiptsData || []) as PaymentReceipt[]);
      setCompanySettings((companySettingsData || null) as CompanySettings | null);
      setLoading(false);
    }

    loadReceipt();
  }, [receiptId, supabase]);

  if (loading) {
    return (
      <main style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
        <Link href="/receipts">← Back to receipts</Link>
        <h1 style={{ marginTop: 20 }}>Loading receipt...</h1>
      </main>
    );
  }

  if (!receipt || !invoice) {
    return (
      <main style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
        <Link href="/receipts">← Back to receipts</Link>
        <h1 style={{ marginTop: 20 }}>Payment receipt not found</h1>
      </main>
    );
  }

  const totals = calculateInvoiceReceiptTotals(invoice, invoiceItems);
  const stillOwing = calculateStillOwingAfterReceipt({
    invoiceTotal: totals.invoiceTotal,
    receipts: allReceipts,
    receipt,
  });
  const companyVatNumber = companySettings?.vat_number || "MT32755725";

  return (
    <main
      className="document-shell"
      style={{ padding: 12, fontFamily: "Arial, sans-serif", maxWidth: 1020 }}
    >
      <div
        className="no-print"
        style={{ marginBottom: 20, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}
      >
        <Link href="/receipts">← Back to receipts</Link>
        <Link href="/">Dashboard</Link>
        <a
          href={`/api/receipts/${receipt.id}/pdf`}
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
          padding: 48,
          color: "#000",
          display: "grid",
          gridTemplateColumns: "165px 1fr",
          gap: 24,
          minHeight: 720,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "grid", gap: 10, fontSize: 14, lineHeight: 1.35 }}>
            <Image
              src="/mgs-logo.svg"
              alt="Malta Gym Solutions logo"
              width={150}
              height={80}
              style={{ width: 150, height: "auto", objectFit: "contain" }}
            />
          </div>

          <div style={{ display: "grid", gap: 6, fontSize: 14, lineHeight: 1.35 }}>
            <div style={{ fontSize: 26, fontWeight: 300, color: "#555555" }}>RECEIPT</div>
            <div>Date: {formatDisplayDate(receipt.receipt_date)}</div>
          </div>

          <div style={{ display: "grid", gap: 10, fontSize: 14, lineHeight: 1.35 }}>
            <div style={{ fontWeight: 700 }}>{companyVatNumber}</div>
            <div>Phone: +356 7954 9541</div>
            <div>@maltagymsolutions</div>
            <div>maltagymsolutions.com</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 34, paddingTop: 4 }}>
          <div style={{ display: "grid", gap: 12, fontSize: 14, lineHeight: 1.3 }}>
            <div style={{ fontWeight: 700 }}>
              {client?.company_name || client?.private_name || "Client"}
            </div>
            {client?.email ? <div style={{ fontWeight: 700 }}>{client.email}</div> : null}
            {client?.phone ? <div style={{ fontWeight: 700 }}>{client.phone}</div> : null}
            {client?.address ? (
              <div style={{ whiteSpace: "pre-line", fontWeight: 700 }}>{client.address}</div>
            ) : null}
            <div>{PAYMENT_RECEIPT_TYPE_LABELS[receipt.receipt_type]}</div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ padding: 6, textAlign: "left", background: "#e10600", color: "#fff" }}>
                  Invoice Date
                </th>
                <th style={{ padding: 6, textAlign: "left", background: "#e10600", color: "#fff" }}>
                  Reference
                </th>
                <th style={{ padding: 6, textAlign: "right", background: "#e10600", color: "#fff" }}>
                  Invoice Total
                </th>
                <th style={{ padding: 6, textAlign: "right", background: "#e10600", color: "#fff" }}>
                  Amount Paid
                </th>
                <th
                  style={{
                    padding: 6,
                    textAlign: "right",
                    background: "#e10600",
                    color: "#fff",
                    whiteSpace: "nowrap",
                  }}
                >
                  Still Owing
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: 6, borderBottom: "1px solid #ccc" }}>
                  {formatDisplayDate(invoice.date_issued)}
                </td>
                <td style={{ padding: 6, borderBottom: "1px solid #ccc" }}>
                  {invoice.invoice_number}
                </td>
                <td style={{ padding: 6, borderBottom: "1px solid #ccc", textAlign: "right" }}>
                  {money(totals.invoiceTotal)}
                </td>
                <td style={{ padding: 6, borderBottom: "1px solid #ccc", textAlign: "right" }}>
                  {money(Number(receipt.amount_paid || 0))}
                </td>
                <td style={{ padding: 6, borderBottom: "1px solid #ccc", textAlign: "right" }}>
                  {money(stillOwing)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: 6, borderBottom: "2px solid #111", fontWeight: 700 }}>
                  Total
                </td>
                <td style={{ padding: 6, borderBottom: "2px solid #111" }} />
                <td style={{ padding: 6, borderBottom: "2px solid #111" }} />
                <td style={{ padding: 6, borderBottom: "2px solid #111", textAlign: "right", fontWeight: 700 }}>
                  {money(Number(receipt.amount_paid || 0))}
                </td>
                <td style={{ padding: 6, borderBottom: "2px solid #111", textAlign: "right", fontWeight: 700 }}>
                  {money(stillOwing)}
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: 42, textAlign: "center", color: "#555555", fontSize: 14 }}>
            Thank you for choosing Malta Gym Solutions!
          </div>
        </div>
      </div>
    </main>
  );
}
