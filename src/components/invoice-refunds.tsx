"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { formatDisplayDate } from "@/src/lib/format-date";
import { BANK_ACCOUNTS, resolveBankAccount, type BankAccount } from "@/src/lib/owners";
import { PAYMENT_RECEIPT_TYPE_LABELS, type PaymentReceiptType } from "@/src/lib/payment-receipts";
import { SALE_REFUND_FIELDS, saleRefundError, toCents, type SaleRefund } from "@/src/lib/sale-refunds";
import { createClient } from "@/src/lib/supabase-browser";

type Receipt = {
  id: string;
  receipt_type: PaymentReceiptType;
  receipt_date: string;
  amount_paid: number | string;
  bank_account: BankAccount | null;
};

const euro = new Intl.NumberFormat("en-MT", { style: "currency", currency: "EUR" });

function maltaToday() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Malta", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts();
  return ["year", "month", "day"].map((part) => parts.find((p) => p.type === part)?.value).join("-");
}

export function InvoiceRefunds({ invoiceId }: { invoiceId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [refunds, setRefunds] = useState<SaleRefund[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saveError, setSaveError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receiptId, setReceiptId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(maltaToday);
  const [account, setAccount] = useState<BankAccount>("APS");
  const [reason, setReason] = useState("");
  const pending = useRef(false);
  const requestId = useRef<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    const [payments, history] = await Promise.all([
      supabase.from("payment_receipts")
        .select("id, receipt_type, receipt_date, amount_paid, bank_account")
        .eq("invoice_id", invoiceId).order("receipt_date"),
      supabase.from("sale_refunds").select(SALE_REFUND_FIELDS)
        .eq("invoice_id", invoiceId).order("refund_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);
    const error = payments.error || history.error;
    setLoadError(error ? saleRefundError(error) : "");
    if (!error) {
      setReceipts((payments.data || []) as Receipt[]);
      setRefunds((history.data || []) as SaleRefund[]);
    }
    setLoading(false);
  }, [invoiceId, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadHistory(), 0);
    return () => window.clearTimeout(timer);
  }, [loadHistory]);

  const refundedByReceipt = new Map<string, number>();
  for (const refund of refunds) {
    refundedByReceipt.set(refund.receipt_id, (refundedByReceipt.get(refund.receipt_id) || 0) + toCents(refund.amount));
  }
  const paid = receipts.reduce((sum, receipt) => sum + toCents(receipt.amount_paid), 0);
  const refunded = refunds.reduce((sum, refund) => sum + toCents(refund.amount), 0);
  const available = receipts.map((receipt) => ({
    ...receipt,
    remaining: toCents(receipt.amount_paid) - (refundedByReceipt.get(receipt.id) || 0),
  })).filter((receipt) => receipt.remaining > 0);
  const selectedReceipt = available.find((receipt) => receipt.id === receiptId);
  const today = maltaToday();

  function selectReceipt(receipt: (typeof available)[number]) {
    setReceiptId(receipt.id);
    setAccount(resolveBankAccount(receipt.bank_account));
    setAmount((receipt.remaining / 100).toFixed(2));
  }

  function startRefund() {
    if (!available[0]) return;
    selectReceipt(available[0]);
    setDate(today);
    setReason("");
    setSaveError("");
    setFeedback("");
    requestId.current = null;
    setEditing(true);
  }

  async function saveRefund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !selectedReceipt) return;
    const amountCents = toCents(amount);
    if (!/^\d+(?:\.\d{1,2})?$/.test(amount) || amountCents < 1 || amountCents > selectedReceipt.remaining) {
      setSaveError("Enter an amount within the selected payment’s refundable balance.");
      return;
    }
    if (date < selectedReceipt.receipt_date || date > today || !reason.trim()) {
      setSaveError("Enter a valid refund date and a reason.");
      return;
    }
    pending.current = true;
    setSaving(true);
    setSaveError("");
    try {
      requestId.current ??= crypto.randomUUID();
      const { error } = await supabase.rpc("record_sale_refund", {
        refund_id: requestId.current,
        payment_id: selectedReceipt.id,
        paid_on: date,
        refund_amount: amountCents / 100,
        paid_from: account,
        refund_reason: reason.trim(),
      });
      if (error) {
        setSaveError(saleRefundError(error));
        // Server validation failed before saving. Keep the ID for ambiguous failures.
        if (error.code === "P0001") requestId.current = null;
        return;
      }
      setFeedback("Refund recorded.");
      setEditing(false);
      await loadHistory();
    } catch {
      setSaveError("Couldn’t confirm the save. Retry with the same details or reload the refund history.");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <section id="sale-refunds" aria-labelledby="sale-refunds-title" className="no-print mb-5 scroll-mt-5 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="sale-refunds-title" className="m-0 text-lg font-bold text-slate-950">Sale refunds</h2>
        {!loading && !loadError && !editing && available.length > 0 ? (
          <button type="button" onClick={startRefund} className="min-h-10 !rounded-md !border-slate-900 !bg-slate-900 px-3 text-sm font-bold !text-white">
            Record refund
          </button>
        ) : null}
      </div>
      {feedback ? <p role="status" className="mt-3 text-sm font-semibold text-emerald-700">{feedback}</p> : null}
      {loading ? <p className="mb-0 mt-3 text-sm text-slate-600">Loading payments and refunds…</p> : null}
      {loadError ? (
        <p role="alert" className="mb-0 mt-3 text-sm text-red-700">
          {loadError} <button type="button" onClick={() => void loadHistory()} className="ml-2">Reload</button>
        </p>
      ) : null}
      {!loading && !loadError ? (
        paid === 0 ? <p className="mb-0 mt-2 text-sm text-slate-600">Record a payment receipt before recording a refund.</p> : (
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-700">
            <span>Received <strong>{euro.format(paid / 100)}</strong></span>
            <span>Refunded <strong>{euro.format(refunded / 100)}</strong></span>
            <span>Net received <strong>{euro.format((paid - refunded) / 100)}</strong></span>
            {refunded > 0 ? <strong>{paid === refunded ? "All received payments refunded" : "Partially refunded"}</strong> : null}
          </div>
        )
      ) : null}
      {editing && selectedReceipt ? (
        <form onSubmit={(event) => void saveRefund(event)} className="mt-4 border-t border-slate-200 pt-4">
          <p className="mb-3 mt-0 text-sm text-slate-600">Record money already returned to the customer. This entry updates your app’s records only.</p>
          <fieldset disabled={saving} className="m-0 grid min-w-0 gap-3 border-0 p-0 sm:grid-cols-2">
            <label className="block text-sm">Payment
              <select value={receiptId} onChange={(event) => {
                const receipt = available.find((option) => option.id === event.target.value);
                if (receipt) selectReceipt(receipt);
              }} className="mt-1 w-full px-3 py-2">
                {available.map((receipt) => (
                  <option key={receipt.id} value={receipt.id}>
                    {PAYMENT_RECEIPT_TYPE_LABELS[receipt.receipt_type]} · {formatDisplayDate(receipt.receipt_date)} · {euro.format(receipt.remaining / 100)} refundable
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">Refund amount (€)
              <input type="number" min="0.01" max={(selectedReceipt.remaining / 100).toFixed(2)} step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full px-3 py-2" />
            </label>
            <label className="block text-sm">Refund date
              <input type="date" min={selectedReceipt.receipt_date} max={today} required value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full px-3 py-2" />
            </label>
            <label className="block text-sm">Paid from
              <select value={account} onChange={(event) => setAccount(resolveBankAccount(event.target.value))} className="mt-1 w-full px-3 py-2">
                {BANK_ACCOUNTS.map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
            <label className="block text-sm sm:col-span-2">Reason
              <textarea rows={2} maxLength={500} required value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="min-h-10 !rounded-md !border-slate-900 !bg-slate-900 px-3 text-sm font-bold !text-white">{saving ? "Saving…" : "Save refund record"}</button>
              <button type="button" onClick={() => { setEditing(false); setSaveError(""); void loadHistory(); }} className="min-h-10 px-3 text-sm font-bold">Cancel</button>
            </div>
          </fieldset>
          {saveError ? <p role="alert" className="mb-0 mt-3 text-sm text-red-700">{saveError}</p> : null}
        </form>
      ) : null}
      {!loading && !loadError && refunds.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <caption className="sr-only">Refund history</caption>
            <thead className="bg-slate-50 text-left">
              <tr>{["Date", "Original payment", "Paid from", "Amount", "Reason"].map((label) => <th key={label} scope="col" className="px-3 py-2">{label}</th>)}</tr>
            </thead>
            <tbody>
              {refunds.map((refund) => {
                const receipt = receipts.find((payment) => payment.id === refund.receipt_id);
                return (
                  <tr key={refund.id} className="border-b border-slate-100">
                    <td className="whitespace-nowrap px-3 py-2">{formatDisplayDate(refund.refund_date)}</td>
                    <td className="px-3 py-2">{receipt ? PAYMENT_RECEIPT_TYPE_LABELS[receipt.receipt_type] : "Payment receipt"}</td>
                    <td className="px-3 py-2">{refund.bank_account}</td>
                    <td className="whitespace-nowrap px-3 py-2">{euro.format(Number(refund.amount))}</td>
                    <td className="break-words px-3 py-2">{refund.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
