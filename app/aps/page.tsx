"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppPage } from "@/src/components/app-page";
import { buildCsv, downloadCsv } from "@/src/lib/csv";
import { formatDisplayDate } from "@/src/lib/format-date";
import { DEFAULT_OWNER, Owner, OWNERS, resolveBankAccount } from "@/src/lib/owners";
import { createClient } from "@/src/lib/supabase-browser";

type Client = {
  id: string;
  private_name: string | null;
  company_name: string | null;
};

type Invoice = {
  id: string;
  invoice_number: string;
  client_id: string | null;
};

type PaymentReceipt = {
  id: string;
  created_at: string;
  invoice_id: string;
  receipt_type: string;
  receipt_date: string;
  amount_paid: number;
  bank_account: string | null;
};

type Expense = {
  id: string;
  created_at: string;
  expense_date: string;
  supplier: string | null;
  description: string;
  category: string;
  amount_incl_vat: number;
  bank_account: string | null;
};

type AccountTransfer = {
  id: string;
  created_at: string;
  transfer_date: string;
  from_account: string;
  to_account: string;
  amount: number;
  description: string;
};

type ApsTransaction = {
  id: string;
  date: string;
  createdAt: string;
  type: "Income" | "Expense" | "Transfer";
  counterparty: string;
  reference: string;
  description: string;
  category: string;
  amount: number;
  balance: number;
};

function money(value: number) {
  return new Intl.NumberFormat("en-MT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function exportFilename(prefix: string) {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
}

function isDateInRange(date: string, dateFrom: string, dateTo: string) {
  if (!date) return false;
  if (dateFrom && date < dateFrom) return false;
  if (dateTo && date > dateTo) return false;
  return true;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

const TRANSFERS_SETUP_MESSAGE =
  "Account transfers are not set up yet. Run supabase/migrations/017_create_account_transfers.sql in Supabase, then refresh this page.";

export default function ApsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [message, setMessage] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [transfers, setTransfers] = useState<AccountTransfer[]>([]);
  const [transferDate, setTransferDate] = useState(todayIsoDate());
  const [transferDirection, setTransferDirection] = useState<"aps-to-owner" | "owner-to-aps">("aps-to-owner");
  const [transferOwner, setTransferOwner] = useState<Owner>(DEFAULT_OWNER);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDescription, setTransferDescription] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const loadData = useCallback(async function loadData() {
    const [clientsResult, invoicesResult, receiptsResult, expensesResult, transfersResult] = await Promise.all([
      supabase.from("clients").select("id, private_name, company_name"),
      supabase.from("invoices").select("id, invoice_number, client_id"),
      supabase
        .from("payment_receipts")
        .select("id, created_at, invoice_id, receipt_type, receipt_date, amount_paid, bank_account")
        .order("receipt_date", { ascending: false }),
      supabase
        .from("expenses")
        .select("id, created_at, expense_date, supplier, description, category, amount_incl_vat, bank_account")
        .order("expense_date", { ascending: false }),
      supabase
        .from("account_transfers")
        .select("*")
        .order("transfer_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    const error = clientsResult.error || invoicesResult.error || receiptsResult.error || expensesResult.error;

    if (error) {
      setMessage(error.message);
      return;
    }

    setClients((clientsResult.data || []) as Client[]);
    setInvoices((invoicesResult.data || []) as Invoice[]);
    setReceipts((receiptsResult.data || []) as PaymentReceipt[]);
    setExpenses((expensesResult.data || []) as Expense[]);
    setTransfers((transfersResult.data || []) as AccountTransfer[]);
    setMessage(transfersResult.error ? TRANSFERS_SETUP_MESSAGE : "");
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadData]);

  const clientById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const invoiceById = useMemo(() => new Map(invoices.map((invoice) => [invoice.id, invoice])), [invoices]);

  const allTransactions = useMemo(() => {
    const rows: Omit<ApsTransaction, "balance">[] = [];

    receipts
      .filter((receipt) => resolveBankAccount(receipt.bank_account) === "APS")
      .forEach((receipt) => {
        const invoice = invoiceById.get(receipt.invoice_id);
        const client = invoice?.client_id ? clientById.get(invoice.client_id) : null;

        rows.push({
          id: `receipt-${receipt.id}`,
          date: receipt.receipt_date,
          createdAt: receipt.created_at,
          type: "Income",
          counterparty: client?.company_name || client?.private_name || "Customer",
          reference: invoice?.invoice_number || receipt.invoice_id,
          description: receipt.receipt_type,
          category: "Receipt",
          amount: Number(receipt.amount_paid || 0),
        });
      });

    expenses
      .filter((expense) => resolveBankAccount(expense.bank_account) === "APS")
      .forEach((expense) => {
        rows.push({
          id: `expense-${expense.id}`,
          date: expense.expense_date,
          createdAt: expense.created_at,
          type: "Expense",
          counterparty: expense.supplier || "Supplier",
          reference: expense.id,
          description: expense.description,
          category: expense.category,
          amount: -Number(expense.amount_incl_vat || 0),
        });
      });

    transfers.forEach((transfer) => {
      const fromAccount = resolveBankAccount(transfer.from_account);
      const toAccount = resolveBankAccount(transfer.to_account);
      const amount = Number(transfer.amount || 0);

      if (fromAccount !== "APS" && toAccount !== "APS") return;

      rows.push({
        id: `transfer-${transfer.id}`,
        date: transfer.transfer_date,
        createdAt: transfer.created_at,
        type: "Transfer",
        counterparty: fromAccount === "APS" ? toAccount : fromAccount,
        reference: transfer.id,
        description: transfer.description || (fromAccount === "APS" ? "Transfer to owner" : "Transfer from owner"),
        category: fromAccount === "APS" ? "Transfer out" : "Transfer in",
        amount: fromAccount === "APS" ? -amount : amount,
      });
    });

    return rows
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.createdAt.localeCompare(b.createdAt) ||
          a.id.localeCompare(b.id)
      )
      .reduce<ApsTransaction[]>((transactions, row) => {
        const previousBalance = transactions.at(-1)?.balance || 0;
        const amount = round2(row.amount);

        transactions.push({
          ...row,
          amount,
          balance: round2(previousBalance + amount),
        });

        return transactions;
      }, []);
  }, [clientById, expenses, invoiceById, receipts, transfers]);

  const filteredTransactions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return allTransactions
      .filter((transaction) => isDateInRange(transaction.date, dateFrom, dateTo))
      .filter((transaction) => typeFilter === "All" || transaction.type === typeFilter)
      .filter((transaction) => categoryFilter === "All" || transaction.category === categoryFilter)
      .filter((transaction) => {
        if (!q) return true;

        return [
          transaction.counterparty,
          transaction.reference,
          transaction.description,
          transaction.category,
          transaction.type,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .slice()
      .reverse();
  }, [allTransactions, categoryFilter, dateFrom, dateTo, searchTerm, typeFilter]);

  const categories = useMemo(
    () => Array.from(new Set(allTransactions.map((transaction) => transaction.category))).sort(),
    [allTransactions]
  );

  const summary = useMemo(() => {
    const income = allTransactions
      .filter((transaction) => transaction.amount > 0)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const expensesTotal = allTransactions
      .filter((transaction) => transaction.amount < 0)
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
    const filteredNet = filteredTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);

    return {
      balance: allTransactions.at(-1)?.balance || 0,
      income: round2(income),
      expenses: round2(expensesTotal),
      filteredNet: round2(filteredNet),
    };
  }, [allTransactions, filteredTransactions]);

  function exportTransactionsCsv() {
    if (filteredTransactions.length === 0) {
      setMessage("No APS transactions to export.");
      return;
    }

    const headers = [
      "Date",
      "Type",
      "Counterparty",
      "Reference",
      "Description",
      "Category",
      "Amount",
      "Running Balance",
    ];
    const rows = filteredTransactions
      .slice()
      .reverse()
      .map((transaction) => ({
        "Date": transaction.date,
        "Type": transaction.type,
        "Counterparty": transaction.counterparty,
        "Reference": transaction.reference,
        "Description": transaction.description,
        "Category": transaction.category,
        "Amount": transaction.amount.toFixed(2),
        "Running Balance": transaction.balance.toFixed(2),
      }));

    downloadCsv(exportFilename("mgs-aps-transactions"), buildCsv(headers, rows));
    setMessage(`Exported ${filteredTransactions.length} APS transaction(s).`);
  }

  async function saveTransfer() {
    const amount = Number(transferAmount || 0);

    if (amount <= 0) {
      setMessage("Transfer amount must be greater than zero.");
      return;
    }

    const payload = {
      transfer_date: transferDate,
      from_account: transferDirection === "aps-to-owner" ? "APS" : transferOwner,
      to_account: transferDirection === "aps-to-owner" ? transferOwner : "APS",
      amount,
      description:
        transferDescription.trim() ||
        (transferDirection === "aps-to-owner" ? "Transfer to owner" : "Transfer from owner"),
    };

    setMessage("Saving transfer...");

    const { error } = await supabase.from("account_transfers").insert(payload);

    if (error) {
      setMessage(error.code === "PGRST205" || error.code === "42P01" ? TRANSFERS_SETUP_MESSAGE : error.message);
      return;
    }

    setTransferAmount("");
    setTransferDescription("");
    await loadData();
    setMessage("Transfer saved.");
  }

  return (
    <AppPage
      title="APS Account"
      description="Review APS receipts, expenses, running balance, and filtered transaction totals."
      actions={
        <>
          <Link href="/receipts" className="inline-flex min-h-10 items-center rounded-md bg-white px-3 text-sm font-bold !text-slate-950 no-underline shadow-sm">
            Receipts
          </Link>
          <Link href="/expenses" className="inline-flex min-h-10 items-center rounded-md border border-white/20 px-3 text-sm font-bold !text-white no-underline">
            Expenses
          </Link>
        </>
      }
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Current APS balance" value={money(summary.balance)} />
        <SummaryCard label="Total APS income" value={money(summary.income)} />
        <SummaryCard label="Total APS expenses" value={money(summary.expenses)} />
        <SummaryCard label="Filtered net" value={money(summary.filteredNet)} />
      </div>

      <section className="mb-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4">
          <h2 className="m-0 text-lg font-bold text-slate-950">Transfer Money</h2>
          <p className="mt-1 text-sm text-slate-500">Record money moving between APS and an owner account.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label htmlFor="transfer-date">Date</label>
            <input
              id="transfer-date"
              type="date"
              className="mt-1 w-full px-3 py-2"
              value={transferDate}
              onChange={(event) => setTransferDate(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="transfer-direction">Direction</label>
            <select
              id="transfer-direction"
              className="mt-1 w-full px-3 py-2"
              value={transferDirection}
              onChange={(event) =>
                setTransferDirection(event.target.value as "aps-to-owner" | "owner-to-aps")
              }
            >
              <option value="aps-to-owner">APS to owner</option>
              <option value="owner-to-aps">Owner to APS</option>
            </select>
          </div>
          <div>
            <label htmlFor="transfer-owner">Owner</label>
            <select
              id="transfer-owner"
              className="mt-1 w-full px-3 py-2"
              value={transferOwner}
              onChange={(event) => setTransferOwner(event.target.value as Owner)}
            >
              {OWNERS.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="transfer-amount">Amount</label>
            <input
              id="transfer-amount"
              type="number"
              min="0"
              step="0.01"
              className="mt-1 w-full px-3 py-2"
              value={transferAmount}
              onChange={(event) => setTransferAmount(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={saveTransfer}
              className="inline-flex h-10 w-full items-center justify-center !rounded-md !border-slate-900 !bg-slate-900 px-3 text-sm font-bold !text-white"
            >
              Save Transfer
            </button>
          </div>
          <div className="sm:col-span-2 lg:col-span-5">
            <label htmlFor="transfer-description">Description</label>
            <input
              id="transfer-description"
              className="mt-1 w-full px-3 py-2"
              placeholder="Optional note"
              value={transferDescription}
              onChange={(event) => setTransferDescription(event.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-lg font-bold text-slate-950">Transactions</h2>
            <p className="mt-1 text-sm text-slate-500">
              {filteredTransactions.length} of {allTransactions.length} APS transaction(s)
            </p>
          </div>
          <button
            onClick={exportTransactionsCsv}
            className="inline-flex h-10 items-center !rounded-md !border-slate-900 !bg-slate-900 px-3 text-sm font-bold !text-white"
          >
            Export CSV
          </button>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label htmlFor="aps-date-from">From</label>
            <input
              id="aps-date-from"
              type="date"
              className="mt-1 w-full px-3 py-2"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="aps-date-to">To</label>
            <input
              id="aps-date-to"
              type="date"
              className="mt-1 w-full px-3 py-2"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="aps-type-filter">Type</label>
            <select
              id="aps-type-filter"
              className="mt-1 w-full px-3 py-2"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="All">All types</option>
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
              <option value="Transfer">Transfer</option>
            </select>
          </div>
          <div>
            <label htmlFor="aps-category-filter">Category</label>
            <select
              id="aps-category-filter"
              className="mt-1 w-full px-3 py-2"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="All">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="aps-search">Search</label>
            <input
              id="aps-search"
              className="mt-1 w-full px-3 py-2"
              placeholder="Supplier, invoice, client"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
            No APS transactions match the selected filters.
          </div>
        ) : (
          <div className="max-w-full overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[920px] border-collapse bg-white">
              <thead>
                <tr>
                  {["Date", "Type", "Counterparty", "Reference", "Description", "Category", "Amount", "Balance"].map(
                    (heading) => (
                      <th
                        key={heading}
                        className={`border-b border-slate-200 bg-slate-50 px-3 py-3 text-xs font-bold uppercase tracking-[0.08em] text-slate-500 ${
                          heading === "Amount" || heading === "Balance" ? "text-right" : "text-left"
                        }`}
                      >
                        {heading}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-slate-50">
                    <td className="border-b border-slate-100 px-3 py-3">{formatDisplayDate(transaction.date)}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{transaction.type}</td>
                    <td className="border-b border-slate-100 px-3 py-3 font-semibold">{transaction.counterparty}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{transaction.reference}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{transaction.description}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{transaction.category}</td>
                    <td className={`border-b border-slate-100 px-3 py-3 text-right font-bold tabular-nums ${transaction.amount < 0 ? "text-red-700" : "text-emerald-700"}`}>
                      {money(transaction.amount)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-right font-extrabold tabular-nums">
                      {money(transaction.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {message ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
            {message}
          </div>
        ) : null}
      </section>
    </AppPage>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-bold text-slate-500">{label}</div>
      <strong className="mt-2 block text-2xl font-extrabold tabular-nums text-slate-950">{value}</strong>
    </div>
  );
}
