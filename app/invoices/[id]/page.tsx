"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { isPartialDeposit } from "@/src/lib/deposits";
import { formatDisplayDate } from "@/src/lib/format-date";
import {
  buildDefaultInvoicePaymentTerms,
  DEFAULT_INVOICE_NOTES,
  resolveCustomText,
  resolveInvoiceBankDetails,
} from "@/src/lib/invoice-text";
import { CARD_PAYMENT_BRANDS, normalizeExternalUrl } from "@/src/lib/card-payment";
import { calculateItemLineTotals, calculateItemsTotals } from "@/src/lib/item-discounts";
import { normalizePackageContents } from "@/src/lib/package-contents";
import { createClient } from "@/src/lib/supabase-browser";

type PageProps = {
  params: Promise<{ id: string }>;
};

type CompanySettings = {
  vat_number: string | null;
};

type Client = {
  is_business_client?: boolean | null;
  company_name?: string | null;
  private_name?: string | null;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  vat_number?: string | null;
  address?: string | null;
};

type Invoice = {
  id: string;
  client_id: string;
  date_issued: string;
  invoice_number: string;
  vat_rate: number | string;
  discount_amount_incl_vat?: number | string | null;
  deposit_percent: number | string;
  payment_terms?: string | null;
  bank_details?: string | null;
  card_payment_link?: string | null;
  notes?: string | null;
};

type InvoiceItem = {
  id: string;
  name: string;
  sale_price_incl_vat: number | string;
  qty: number | string;
  item_discount_percent?: number | string | null;
  package_contents?: string[] | null;
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
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
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

      const { data: companySettingsData } = await supabase
        .from("company_settings")
        .select("vat_number")
        .limit(1)
        .single();

      setClient(clientData || null);
      setInvoiceItems(itemsData || []);
      setCompanySettings(companySettingsData || null);
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
  
  const itemTotals = calculateItemsTotals(invoiceItems);
  const grossBeforeDiscount = itemTotals.totalAfterItemDiscounts;
  
  const discountAmount = round2(
    Math.min(Number(invoice.discount_amount_incl_vat || 0), grossBeforeDiscount)
  );
  
  const grossAfterDiscount = round2(grossBeforeDiscount - discountAmount);
  
  const subtotal = isBusinessClient
    ? round2(grossBeforeDiscount / (1 + Number(invoice.vat_rate) / 100))
    : grossBeforeDiscount;
  
  const vatAmount = round2(
    grossAfterDiscount - grossAfterDiscount / (1 + Number(invoice.vat_rate) / 100)
  );
  
  const depositAmount = round2(
    grossAfterDiscount * (Number(invoice.deposit_percent) / 100)
  );
  
  const balanceDue = round2(grossAfterDiscount - depositAmount);
  const showDepositDetails = isPartialDeposit(invoice.deposit_percent);
  const companyVatNumber = companySettings?.vat_number || "MT32755725";
  const paymentTerms = resolveCustomText(
    invoice.payment_terms,
    buildDefaultInvoicePaymentTerms({
      depositAmount,
      balanceDue,
      depositPercent: invoice.deposit_percent,
      discountAmount: round2(itemTotals.itemDiscountTotal + discountAmount),
      invoiceNumber: invoice.invoice_number,
      formatMoney: money,
    })
  );
  const bankDetails = resolveInvoiceBankDetails(invoice.bank_details);
  const notesText = resolveCustomText(invoice.notes, DEFAULT_INVOICE_NOTES);
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
        <Link href={`/receipts?invoiceId=${invoiceId}`}>Payment Receipts</Link>
        <Link href={`/invoices/${invoiceId}/delivery`}>Delivery Receipt</Link>
        <a
          href={`/api/invoices/${invoiceId}/pdf?v=${encodeURIComponent(
            `${invoice.deposit_percent}-${invoice.vat_rate}-${grossAfterDiscount}-${invoiceItems.length}`
          )}`}
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
            <div>{companyVatNumber}</div>
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
            <div>Date: {formatDisplayDate(invoice.date_issued)}</div>
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
                  const lineTotals = calculateItemLineTotals(item);
                  const lineDisplay = round2(unitDisplay * Number(item.qty));
                  const discountDisplay = isBusinessClient
                    ? round2(
                        lineTotals.discountAmount /
                          (1 + Number(invoice.vat_rate) / 100)
                      )
                    : lineTotals.discountAmount;

                  return (
                    <Fragment key={item.id}>
                      <tr>
                        <td style={{ padding: 6, borderTop: "1px solid #ddd", fontSize: 12, lineHeight: 1.15, maxWidth: 260, verticalAlign: "top" }}>
                          <strong>{item.name}</strong>
                          {normalizePackageContents(item.package_contents).length > 0 ? (
                            <div style={{ marginTop: 5, color: "#4b5563", fontSize: 10.5, lineHeight: 1.4 }}>
                              <span style={{ display: "block", fontWeight: 700 }}>Package includes:</span>
                              {normalizePackageContents(item.package_contents).map((content, index) => (
                                <span key={`${content}-${index}`} style={{ display: "block" }}>- {content}</span>
                              ))}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ padding: 6, borderTop: "1px solid #ddd", textAlign: "center", fontSize: 12, lineHeight: 1.15, verticalAlign: "top" }}>
                          {item.qty}
                        </td>
                        <td style={{ padding: 6, borderTop: "1px solid #ddd", textAlign: "center", fontSize: 12, lineHeight: 1.15, verticalAlign: "top" }}>
                          {invoice.vat_rate}%
                        </td>
                        <td style={{ padding: 6, borderTop: "1px solid #ddd", textAlign: "right", fontSize: 12, lineHeight: 1.15, verticalAlign: "top" }}>
                          {money(unitDisplay)}
                        </td>
                        <td style={{ padding: 6, borderTop: "1px solid #ddd", textAlign: "right", fontSize: 12, lineHeight: 1.15, verticalAlign: "top" }}>
                          {money(lineDisplay)}
                        </td>
                      </tr>
                      {lineTotals.discountPercent > 0 ? (
                        <tr style={{ fontStyle: "italic", color: "#4b5563" }}>
                          <td style={{ padding: "0 6px 6px 6px", fontSize: 11 }}>
                            Discount: {lineTotals.discountPercent}% item discount
                          </td>
                          <td />
                          <td />
                          <td />
                          <td style={{ padding: "0 6px 6px 6px", textAlign: "right", fontSize: 11 }}>
                            -{money(discountDisplay)}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ padding: 6, borderTop: "2px solid #111", fontWeight: 600 }}>
                    {isBusinessClient ? "Subtotal excl. VAT" : "Subtotal incl. VAT"}
                  </td>
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
                {discountAmount > 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 6, borderTop: "1px dotted #ccc", fontWeight: 600 }}>
                      {itemTotals.itemDiscountTotal > 0
                        ? "Additional discount incl. VAT"
                        : "Discount incl. VAT"}
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
                {showDepositDetails ? (
                  <>
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
                  </>
                ) : null}
              </tfoot>
            </table>
          </div>

        <div style={{ display: "grid", gap: 4, fontSize: 13, lineHeight: 1.3 }}>
            <div style={{ fontWeight: 700 }}>PAYMENT TERMS</div>
            <div style={{ whiteSpace: "pre-line" }}>{paymentTerms}</div>
          </div>

          <div style={{ display: "grid", gap: 4, fontSize: 13, lineHeight: 1.3 }}>
            <div style={{ fontWeight: 700 }}>BANK DETAILS:</div>
            <div style={{ whiteSpace: "pre-line" }}>{bankDetails}</div>
          </div>

          {invoice.card_payment_link ? (
            <div style={{ display: "grid", gap: 4, fontSize: 13, lineHeight: 1.3 }}>
              <div style={{ fontWeight: 700 }}>CARD PAYMENT:</div>
              <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                {CARD_PAYMENT_BRANDS.map((brand) => (
                  // eslint-disable-next-line @next/next/no-img-element -- These source files are provided payment logos used in printable invoice output.
                  <img
                    key={brand.label}
                    src={brand.src}
                    alt={brand.label}
                    width={brand.width}
                    height={brand.height}
                    style={{
                      display: "block",
                      height: brand.height,
                      objectFit: "contain",
                      width: brand.width,
                    }}
                  />
                ))}
              </div>
              <a
                href={normalizeExternalUrl(invoice.card_payment_link)}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: "#008fb3",
                  fontSize: 18,
                  textDecoration: "underline",
                  width: "fit-content",
                }}
              >
                View and pay online now
              </a>
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 4, fontSize: 13, lineHeight: 1.3 }}>
            <div style={{ fontWeight: 700 }}>Notes:</div>
            <div style={{ whiteSpace: "pre-line" }}>{notesText}</div>
            <div>Thank you for choosing Malta Gym Solutions!</div>
          </div>
        </div>
      </div>
    </main>
  );
}
