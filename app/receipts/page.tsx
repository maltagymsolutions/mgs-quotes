"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_OWNER, Owner, OWNERS, resolveOwner } from "@/src/lib/owners";
import { formatDisplayDate } from "@/src/lib/format-date";
import {
  calculateInvoiceReceiptTotals,
  calculateStillOwingAfterReceipt,
  getDefaultReceiptAmount,
  PAYMENT_RECEIPT_TYPE_LABELS,
  PaymentReceiptType,
} from "@/src/lib/payment-receipts";
import { createClient } from "@/src/lib/supabase-browser";

type Client = {
  id: string;
  private_name: string | null;
  company_name: string | null;
};

type SavedInvoice = {
  id: string;
  invoice_number: string;
  client_id: string | null;
  date_issued: string;
  status: string;
  deposit_percent: number;
  discount_amount_incl_vat: number | null;
};

type InvoiceItemRow = {
  invoice_id: string;
  qty: number;
  sale_price_incl_vat: number;
  item_discount_percent: number | null;
};

type PaymentReceipt = {
  id: string;
  invoice_id: string;
  receipt_type: PaymentReceiptType;
  receipt_date: string;
  amount_paid: number;
  bank_account?: Owner | null;
  received_by_owner: Owner | null;
  created_at: string;
};

const RECEIPTS_SETUP_MESSAGE =
  "Payment receipts table is not set up yet. Run supabase/migrations/003_create_payment_receipts.sql, 004_add_bank_accounts_to_money_records.sql, and 005_adapt_money_records_to_owners.sql in Supabase, then refresh this page.";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function money(value: number) {
  return new Intl.NumberFormat("en-MT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export default function PaymentReceiptsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [message, setMessage] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<SavedInvoice[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItemRow[]>([]);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [receiptType, setReceiptType] = useState<PaymentReceiptType>("deposit");
  const [receiptDateOverride, setReceiptDateOverride] = useState<{
    invoiceId: string;
    receiptType: PaymentReceiptType;
    value: string;
  } | null>(null);
  const [amountPaidOverride, setAmountPaidOverride] = useState<{
    invoiceId: string;
    receiptType: PaymentReceiptType;
    value: number;
  } | null>(null);
  const [receivedByOverride, setReceivedByOverride] = useState<{
    invoiceId: string;
    receiptType: PaymentReceiptType;
    value: Owner;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async function loadData() {
    const [clientsResult, invoicesResult, itemsResult, receiptsResult] = await Promise.all([
      supabase.from("clients").select("id, private_name, company_name"),
      supabase
        .from("invoices")
        .select("id, invoice_number, client_id, date_issued, status, deposit_percent, discount_amount_incl_vat")
        .order("date_issued", { ascending: false }),
      supabase.from("invoice_items").select("*"),
      supabase
        .from("payment_receipts")
        .select("*")
        .order("receipt_date", { ascending: false }),
    ]);

    if (clientsResult.error) {
      setMessage(clientsResult.error.message);
      return;
    }

    if (invoicesResult.error) {
      setMessage(invoicesResult.error.message);
      return;
    }

    if (itemsResult.error) {
      setMessage(itemsResult.error.message);
      return;
    }

    setClients((clientsResult.data || []) as Client[]);
    setInvoices((invoicesResult.data || []) as SavedInvoice[]);
    setInvoiceItems((itemsResult.data || []) as InvoiceItemRow[]);

    if (receiptsResult.error) {
      setReceipts([]);
      setMessage(RECEIPTS_SETUP_MESSAGE);
      return;
    }

    setReceipts((receiptsResult.data || []) as PaymentReceipt[]);
    setMessage("");
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadData]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const invoiceId = new URLSearchParams(window.location.search).get("invoiceId");
      if (invoiceId) {
        setSelectedInvoiceId(invoiceId);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const itemsByInvoice = useMemo(() => {
    const rows = new Map<string, InvoiceItemRow[]>();

    invoiceItems.forEach((item) => {
      const existing = rows.get(item.invoice_id) || [];
      existing.push(item);
      rows.set(item.invoice_id, existing);
    });

    return rows;
  }, [invoiceItems]);

  const receiptsByInvoice = useMemo(() => {
    const rows = new Map<string, PaymentReceipt[]>();

    receipts.forEach((receipt) => {
      const existing = rows.get(receipt.invoice_id) || [];
      existing.push(receipt);
      rows.set(receipt.invoice_id, existing);
    });

    return rows;
  }, [receipts]);

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === selectedInvoiceId) || null,
    [invoices, selectedInvoiceId]
  );

  const selectedInvoiceItems = useMemo(
    () => (selectedInvoice ? itemsByInvoice.get(selectedInvoice.id) || [] : []),
    [itemsByInvoice, selectedInvoice]
  );

  const selectedInvoiceReceipts = useMemo(
    () => (selectedInvoice ? receiptsByInvoice.get(selectedInvoice.id) || [] : []),
    [receiptsByInvoice, selectedInvoice]
  );

  const selectedReceipt = useMemo(
    () =>
      selectedInvoiceReceipts.find((receipt) => receipt.receipt_type === receiptType) || null,
    [receiptType, selectedInvoiceReceipts]
  );

  const selectedTotals = useMemo(
    () =>
      selectedInvoice
        ? calculateInvoiceReceiptTotals(selectedInvoice, selectedInvoiceItems)
        : null,
    [selectedInvoice, selectedInvoiceItems]
  );

  const receiptDate =
    receiptDateOverride?.invoiceId === selectedInvoiceId &&
    receiptDateOverride.receiptType === receiptType
      ? receiptDateOverride.value
      : selectedReceipt?.receipt_date || todayIsoDate();

  const amountPaid =
    amountPaidOverride?.invoiceId === selectedInvoiceId &&
    amountPaidOverride.receiptType === receiptType
      ? amountPaidOverride.value
      : selectedReceipt
        ? Number(selectedReceipt.amount_paid || 0)
        : selectedTotals
          ? getDefaultReceiptAmount({
              receiptType,
              invoiceTotal: selectedTotals.invoiceTotal,
              depositAmount: selectedTotals.depositAmount,
              receipts: selectedInvoiceReceipts,
            })
          : 0;

  const receivedByOwner =
    receivedByOverride?.invoiceId === selectedInvoiceId &&
    receivedByOverride.receiptType === receiptType
      ? receivedByOverride.value
      : selectedReceipt
        ? resolveOwner(selectedReceipt.received_by_owner || selectedReceipt.bank_account)
        : DEFAULT_OWNER;

  function updateReceiptDate(value: string) {
    if (!selectedInvoiceId) return;
    setReceiptDateOverride({ invoiceId: selectedInvoiceId, receiptType, value });
  }

  function updateAmountPaid(value: number) {
    if (!selectedInvoiceId) return;
    setAmountPaidOverride({ invoiceId: selectedInvoiceId, receiptType, value });
  }

  function updateReceivedByOwner(value: Owner) {
    if (!selectedInvoiceId) return;
    setReceivedByOverride({ invoiceId: selectedInvoiceId, receiptType, value });
  }

  function getClientName(clientId: string | null) {
    const client = clients.find((row) => row.id === clientId);
    return client?.company_name || client?.private_name || "Unknown client";
  }

  function clearReceiptEditor() {
    setSelectedInvoiceId("");
    setReceiptType("deposit");
    setReceiptDateOverride(null);
    setAmountPaidOverride(null);
    setReceivedByOverride(null);
  }

  function startEditingReceipt(receipt: PaymentReceipt) {
    const invoice = invoices.find((row) => row.id === receipt.invoice_id);

    if (!invoice) {
      setMessage("This receipt cannot be edited because its invoice could not be loaded.");
      return;
    }

    setSelectedInvoiceId(receipt.invoice_id);
    setReceiptType(receipt.receipt_type);
    setReceiptDateOverride({
      invoiceId: receipt.invoice_id,
      receiptType: receipt.receipt_type,
      value: receipt.receipt_date,
    });
    setAmountPaidOverride({
      invoiceId: receipt.invoice_id,
      receiptType: receipt.receipt_type,
      value: Number(receipt.amount_paid || 0),
    });
    setReceivedByOverride({
      invoiceId: receipt.invoice_id,
      receiptType: receipt.receipt_type,
      value: resolveOwner(receipt.received_by_owner || receipt.bank_account),
    });
    setMessage(`Editing ${PAYMENT_RECEIPT_TYPE_LABELS[receipt.receipt_type]} receipt.`);

    window.requestAnimationFrame(() => {
      document.getElementById("receipt-editor")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  async function saveReceipt() {
    if (!selectedInvoice || !selectedTotals) {
      setMessage("Please select an invoice.");
      return;
    }

    const normalizedAmount = Number(amountPaid || 0);

    if (normalizedAmount <= 0) {
      setMessage("Amount paid must be greater than zero.");
      return;
    }

    setSaving(true);
    setMessage(selectedReceipt ? "Updating receipt..." : "Creating receipt...");

    const payload = {
      invoice_id: selectedInvoice.id,
      receipt_type: receiptType,
      receipt_date: receiptDate,
      amount_paid: normalizedAmount,
      bank_account: receivedByOwner,
      received_by_owner: receivedByOwner,
    };

    const receiptResult = selectedReceipt
      ? await supabase.from("payment_receipts").update(payload).eq("id", selectedReceipt.id)
      : await supabase.from("payment_receipts").insert(payload);

    if (receiptResult.error) {
      setSaving(false);
      setMessage(receiptResult.error.message);
      return;
    }

    const nextStatus = receiptType === "balance" ? "Fully Paid" : "Deposit Paid";
    const { error: statusError } = await supabase
      .from("invoices")
      .update({ status: nextStatus })
      .eq("id", selectedInvoice.id);

    if (statusError) {
      setMessage(statusError.message);
      setSaving(false);
      return;
    }

    await loadData();
    clearReceiptEditor();
    setSaving(false);
    setMessage(`${PAYMENT_RECEIPT_TYPE_LABELS[receiptType]} receipt saved.`);
  }

  const receiptRows = receipts.map((receipt) => {
    const invoice = invoices.find((row) => row.id === receipt.invoice_id);
    const rows = invoice ? itemsByInvoice.get(invoice.id) || [] : [];
    const invoiceReceipts = invoice ? receiptsByInvoice.get(invoice.id) || [] : [];
    const totals = invoice ? calculateInvoiceReceiptTotals(invoice, rows) : null;
    const stillOwing = totals
      ? calculateStillOwingAfterReceipt({
          invoiceTotal: totals.invoiceTotal,
          receipts: invoiceReceipts,
          receipt,
        })
      : 0;

    return { receipt, invoice, totals, stillOwing };
  });

  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 1120 }}>
      <div style={{ marginBottom: 20, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Link href="/">← Back to dashboard</Link>
        <Link href="/invoices">Invoices</Link>
      </div>

      <h1>Payment Receipts</h1>

      {message ? (
        <p style={{ color: message.includes("saved") ? "#166534" : "#991b1b", fontWeight: 700 }}>
          {message}
        </p>
      ) : null}

      <section
        id="receipt-editor"
        style={{ border: "1px solid #ccc", padding: 16, borderRadius: 8, marginTop: 20 }}
      >
        <h2>{selectedReceipt ? "Edit Receipt" : "Create Receipt"}</h2>

        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label>Invoice</label>
            <select
              style={{ width: "100%", padding: 10, marginTop: 4 }}
              value={selectedInvoiceId}
              onChange={(event) => setSelectedInvoiceId(event.target.value)}
            >
              <option value="">Select an invoice</option>
              {invoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoice_number} - {getClientName(invoice.client_id)} -{" "}
                  {formatDisplayDate(invoice.date_issued)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Receipt Type</label>
            <select
              style={{ width: "100%", padding: 10, marginTop: 4 }}
              value={receiptType}
              onChange={(event) => setReceiptType(event.target.value as PaymentReceiptType)}
            >
              <option value="deposit">Deposit Payment</option>
              <option value="balance">Balance Payment</option>
            </select>
          </div>

          <div>
            <label>Receipt Date</label>
            <input
              type="date"
              style={{ width: "100%", padding: 10, marginTop: 4 }}
              value={receiptDate}
              onChange={(event) => updateReceiptDate(event.target.value)}
            />
          </div>

          <div>
            <label>Amount Paid</label>
            <input
              type="number"
              step="0.01"
              style={{ width: "100%", padding: 10, marginTop: 4 }}
              value={amountPaid}
              onChange={(event) => updateAmountPaid(Number(event.target.value || 0))}
            />
          </div>

          <div>
            <label>Received By</label>
            <select
              style={{ width: "100%", padding: 10, marginTop: 4 }}
              value={receivedByOwner}
              onChange={(event) => updateReceivedByOwner(event.target.value as Owner)}
            >
              {OWNERS.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedInvoice && selectedTotals ? (
          <div
            style={{
              marginTop: 18,
              display: "grid",
              gap: 8,
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span>Invoice total</span>
              <strong>{money(selectedTotals.invoiceTotal)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span>Deposit due ({selectedInvoice.deposit_percent}%)</span>
              <strong>{money(selectedTotals.depositAmount)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span>Balance due</span>
              <strong>{money(selectedTotals.balanceAmount)}</strong>
            </div>
            {selectedReceipt ? (
              <div style={{ color: "#92400e", fontWeight: 700 }}>
                This invoice already has a {PAYMENT_RECEIPT_TYPE_LABELS[receiptType].toLowerCase()} receipt.
                Saving will update it.
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={saveReceipt}
            disabled={saving || !selectedInvoiceId}
            style={{
              padding: "10px 14px",
              background: saving || !selectedInvoiceId ? "#9ca3af" : "#111827",
              color: "#ffffff",
              border: "1px solid #111827",
              borderRadius: 8,
            }}
          >
            {selectedReceipt ? "Update Receipt" : "Create Receipt"}
          </button>
          {selectedReceipt ? (
            <button
              onClick={clearReceiptEditor}
              style={{
                padding: "10px 14px",
                background: "#ffffff",
                color: "#111827",
                border: "1px solid #d1d5db",
                borderRadius: 8,
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </section>

      <section style={{ border: "1px solid #ccc", padding: 16, borderRadius: 8, marginTop: 24 }}>
        <h2>Saved Receipts</h2>

        {receiptRows.length === 0 ? (
          <p>No payment receipts saved yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Date</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Type</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Invoice</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Client</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Received By</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ccc", padding: 8 }}>Paid</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ccc", padding: 8 }}>Still Owing</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: 8 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {receiptRows.map(({ receipt, invoice, stillOwing }) => (
                <tr key={receipt.id}>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    {formatDisplayDate(receipt.receipt_date)}
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    {PAYMENT_RECEIPT_TYPE_LABELS[receipt.receipt_type]}
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    {invoice?.invoice_number || "Unknown invoice"}
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    {getClientName(invoice?.client_id || null)}
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    {resolveOwner(receipt.received_by_owner || receipt.bank_account)}
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8, textAlign: "right" }}>
                    {money(Number(receipt.amount_paid || 0))}
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8, textAlign: "right" }}>
                    {money(stillOwing)}
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => startEditingReceipt(receipt)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #d1d5db",
                          background: "#ffffff",
                          color: "#111827",
                          fontWeight: 700,
                        }}
                      >
                        Edit
                      </button>
                      <Link
                        href={`/receipts/${receipt.id}`}
                        style={{
                          display: "inline-block",
                          padding: "8px 12px",
                          borderRadius: 8,
                          background: "#111827",
                          color: "#ffffff",
                          textDecoration: "none",
                          fontWeight: 700,
                        }}
                      >
                        View
                      </Link>
                      <a
                        href={`/api/receipts/${receipt.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "inline-block",
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #d1d5db",
                          color: "#111827",
                          textDecoration: "none",
                          fontWeight: 700,
                        }}
                      >
                        PDF
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
