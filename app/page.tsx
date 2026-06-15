"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildCsv, downloadCsv } from "@/src/lib/csv";
import { calculateItemsTotals } from "@/src/lib/item-discounts";
import { Owner, OWNERS, resolveOwner, resolveOwnerSplit } from "@/src/lib/owners";
import { createClient } from "@/src/lib/supabase-browser";

type Invoice = {
  id: string;
  invoice_number: string;
  client_id: string | null;
  date_issued: string;
  status: string;
  vat_rate: number;
  discount_amount_incl_vat: number | null;
};

type InvoiceItem = {
  invoice_id: string;
  qty: number;
  sale_price_incl_vat: number;
  item_discount_percent: number | null;
};

type Expense = {
  id: string;
  created_at: string;
  expense_date: string;
  supplier: string | null;
  description: string;
  category: string;
  vat_rate: number;
  amount_incl_vat: number;
  bank_account?: Owner | null;
  paid_by_owner: Owner | null;
  split_owners: Owner[] | null;
};

type PaymentReceipt = {
  id: string;
  created_at: string;
  invoice_id: string;
  receipt_type: string;
  receipt_date: string;
  amount_paid: number;
  bank_account?: Owner | null;
  received_by_owner: Owner | null;
};

type Client = {
  id: string;
  private_name: string | null;
  company_name: string | null;
};

type OwnerTransaction = {
  date: string;
  createdAt: string;
  owner: Owner;
  type: string;
  counterparty: string;
  reference: string;
  description: string;
  category: string;
  amount: number;
  balance: number;
};

type BreakdownRow = {
  label: string;
  amount: number;
};

const EXPENSES_SETUP_MESSAGE =
  "Expenses table is not set up yet. Run supabase/migrations/001_create_expenses.sql, 004_add_bank_accounts_to_money_records.sql, 005_adapt_money_records_to_owners.sql, and 006_add_vat_expense_category.sql in Supabase, then refresh this page.";
const RECEIPTS_SETUP_MESSAGE =
  "Payment receipts table is not set up yet. Run supabase/migrations/003_create_payment_receipts.sql, 004_add_bank_accounts_to_money_records.sql, and 005_adapt_money_records_to_owners.sql in Supabase, then refresh this page.";

const cards = [
  {
    title: "Clients",
    href: "/clients",
  },
  {
    title: "Inventory",
    href: "/inventory",
  },
  {
    title: "Quotes",
    href: "/quotes",
  },
  {
    title: "Invoices",
    href: "/invoices",
  },
  {
    title: "Payment Receipts",
    href: "/receipts",
  },
  {
    title: "Expenses",
    href: "/expenses",
  },
  {
    title: "Shipments",
    href: "/shipments",
  },
];

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

function calculateVatFromInclusive(amountInclVat: number, vatRate: number) {
  return round2(amountInclVat - amountInclVat / (1 + vatRate / 100));
}

function sortBreakdown(rows: BreakdownRow[]) {
  return rows.sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label));
}

function exportFilename(prefix: string) {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
}

function localIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isDateInRange(date: string, dateFrom: string, dateTo: string) {
  if (!date) return false;
  if (dateFrom && date < dateFrom) return false;
  if (dateTo && date > dateTo) return false;
  return true;
}

export default function HomePage() {
  const supabase = useMemo(() => createClient(), []);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [paymentReceipts, setPaymentReceipts] = useState<PaymentReceipt[]>([]);
  const [dashboardMessage, setDashboardMessage] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadDashboard = useCallback(async function loadDashboard() {
    const [clientsResult, invoicesResult, invoiceItemsResult, expensesResult, receiptsResult] = await Promise.all([
      supabase.from("clients").select("id, private_name, company_name"),
      supabase
        .from("invoices")
        .select("id, invoice_number, client_id, date_issued, status, vat_rate, discount_amount_incl_vat")
        .order("date_issued", { ascending: false }),
      supabase.from("invoice_items").select("*"),
      supabase
        .from("expenses")
        .select("id, created_at, expense_date, supplier, description, category, vat_rate, amount_incl_vat, bank_account, paid_by_owner, split_owners")
        .order("expense_date", { ascending: false }),
      supabase
        .from("payment_receipts")
        .select("id, created_at, invoice_id, receipt_type, receipt_date, amount_paid, bank_account, received_by_owner")
        .order("receipt_date", { ascending: false }),
    ]);

    if (clientsResult.error) {
      setDashboardMessage(clientsResult.error.message);
      return;
    }

    if (invoicesResult.error) {
      setDashboardMessage(invoicesResult.error.message);
      return;
    }

    if (invoiceItemsResult.error) {
      setDashboardMessage(invoiceItemsResult.error.message);
      return;
    }

    setClients(clientsResult.data || []);
    setInvoices(invoicesResult.data || []);
    setInvoiceItems(invoiceItemsResult.data || []);

    if (expensesResult.error) {
      setExpenses([]);
      setDashboardMessage(EXPENSES_SETUP_MESSAGE);
      return;
    }

    setExpenses(expensesResult.data || []);

    if (receiptsResult.error) {
      setPaymentReceipts([]);
      setDashboardMessage(RECEIPTS_SETUP_MESSAGE);
      return;
    }

    setPaymentReceipts(receiptsResult.data || []);
    setDashboardMessage("");
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadDashboard();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const dashboard = useMemo(() => {
    const itemsByInvoice = new Map<string, InvoiceItem[]>();
    const receiptsByInvoice = new Map<string, PaymentReceipt[]>();
    const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
    const clientById = new Map(clients.map((client) => [client.id, client]));
    const ownerTransactionRows: Omit<OwnerTransaction, "balance">[] = [];

    invoiceItems.forEach((item) => {
      const existing = itemsByInvoice.get(item.invoice_id) || [];
      existing.push(item);
      itemsByInvoice.set(item.invoice_id, existing);
    });

    paymentReceipts.forEach((receipt) => {
      const existing = receiptsByInvoice.get(receipt.invoice_id) || [];
      existing.push(receipt);
      receiptsByInvoice.set(receipt.invoice_id, existing);
    });

    const statusTotals = new Map<string, number>();
    const monthlyIncomeTotals = new Map<string, number>();
    const ownerTotals = new Map<
      Owner,
      {
        customerReceived: number;
        supplierPaid: number;
        splitReceived: number;
        splitPaid: number;
      }
    >();

    OWNERS.forEach((owner) => {
      ownerTotals.set(owner, {
        customerReceived: 0,
        supplierPaid: 0,
        splitReceived: 0,
        splitPaid: 0,
      });
    });

    let totalIncome = 0;
    let totalIncomeExclVat = 0;
    let incomeVat = 0;

    invoices
      .filter((invoice) => isDateInRange(invoice.date_issued, dateFrom, dateTo))
      .forEach((invoice) => {
      const rows = itemsByInvoice.get(invoice.id) || [];
      const itemsTotal = calculateItemsTotals(rows).totalAfterItemDiscounts;
      const discountApplied = Math.min(Number(invoice.discount_amount_incl_vat || 0), itemsTotal);
      const invoiceTotal = round2(itemsTotal - discountApplied);
      const invoiceReceipts = receiptsByInvoice.get(invoice.id) || [];
      const totalPaid = Math.min(
        invoiceTotal,
        round2(
          invoiceReceipts.reduce(
            (sum, receipt) => sum + Number(receipt.amount_paid || 0),
            0
          )
        )
      );

      if (invoice.status === "Deposit Paid") {
        const depositPaid = Math.min(
          totalPaid,
          round2(
            invoiceReceipts
              .filter((receipt) => receipt.receipt_type === "deposit")
              .reduce((sum, receipt) => sum + Number(receipt.amount_paid || 0), 0)
          )
        );
        const unpaidBalance = round2(Math.max(invoiceTotal - totalPaid, 0));

        statusTotals.set(
          "Deposit Paid",
          round2((statusTotals.get("Deposit Paid") || 0) + depositPaid)
        );
        statusTotals.set(
          "Unpaid",
          round2((statusTotals.get("Unpaid") || 0) + unpaidBalance)
        );
      } else {
        const currentStatusTotal = statusTotals.get(invoice.status) || 0;
        statusTotals.set(invoice.status, round2(currentStatusTotal + invoiceTotal));
      }

      if (invoice.status !== "Archived") {
        totalIncome = round2(totalIncome + invoiceTotal);
        const invoiceVat = calculateVatFromInclusive(invoiceTotal, Number(invoice.vat_rate || 0));
        const invoiceExclVat = round2(invoiceTotal - invoiceVat);

        totalIncomeExclVat = round2(totalIncomeExclVat + invoiceExclVat);
        incomeVat = round2(incomeVat + invoiceVat);

        const month = invoice.date_issued?.slice(0, 7) || "Undated";
        monthlyIncomeTotals.set(month, round2((monthlyIncomeTotals.get(month) || 0) + invoiceExclVat));
      }
    });

    const expenseCategoryTotals = new Map<string, number>();
    const monthlyExpenseTotals = new Map<string, number>();

    let totalExpenses = 0;
    let totalExpensesExclVat = 0;
    let operatingCostsExclVat = 0;
    let expenseVat = 0;
    let vatPayments = 0;

    paymentReceipts
      .filter((receipt) => isDateInRange(receipt.receipt_date, dateFrom, dateTo))
      .forEach((receipt) => {
      const owner = resolveOwner(receipt.received_by_owner || receipt.bank_account);
      const invoice = invoiceById.get(receipt.invoice_id);
      const client = invoice?.client_id ? clientById.get(invoice.client_id) : null;
      const clientName = client?.company_name || client?.private_name || "Customer";
      const totals =
        ownerTotals.get(owner) || {
          customerReceived: 0,
          supplierPaid: 0,
          splitReceived: 0,
          splitPaid: 0,
        };

      totals.customerReceived = round2(
        totals.customerReceived + Number(receipt.amount_paid || 0)
      );
      ownerTotals.set(owner, totals);
      ownerTransactionRows.push({
        date: receipt.receipt_date,
        createdAt: receipt.created_at,
        owner,
        type: "Customer receipt",
        counterparty: clientName,
        reference: invoice?.invoice_number || receipt.invoice_id,
        description: receipt.receipt_type,
        category: "Income",
        amount: Number(receipt.amount_paid || 0),
      });
    });

    expenses
      .filter((expense) => isDateInRange(expense.expense_date, dateFrom, dateTo))
      .forEach((expense) => {
      const amount = Number(expense.amount_incl_vat || 0);
      const isVatPayment = expense.category === "VAT";
      const paidBy = resolveOwner(expense.paid_by_owner || expense.bank_account);
      const splitBetween = Array.from(new Set([paidBy, ...resolveOwnerSplit(expense.split_owners, paidBy)]));
      const paidTotals =
        ownerTotals.get(paidBy) || {
          customerReceived: 0,
          supplierPaid: 0,
          splitReceived: 0,
          splitPaid: 0,
        };
      const ownerShare = round2(amount / splitBetween.length);

      paidTotals.supplierPaid = round2(paidTotals.supplierPaid + amount);
      ownerTotals.set(paidBy, paidTotals);
      ownerTransactionRows.push({
        date: expense.expense_date,
        createdAt: expense.created_at,
        owner: paidBy,
        type: isVatPayment ? "VAT payment" : "Supplier payment",
        counterparty: expense.supplier || (isVatPayment ? "VAT department" : "Supplier"),
        reference: expense.id,
        description: expense.description,
        category: expense.category,
        amount: -amount,
      });

      splitBetween.forEach((owner) => {
        if (owner === paidBy) return;

        const totals =
          ownerTotals.get(owner) || {
            customerReceived: 0,
            supplierPaid: 0,
            splitReceived: 0,
            splitPaid: 0,
          };
        const currentPaidTotals = ownerTotals.get(paidBy) || paidTotals;

        totals.splitPaid = round2(totals.splitPaid + ownerShare);
        currentPaidTotals.splitReceived = round2(currentPaidTotals.splitReceived + ownerShare);
        ownerTotals.set(owner, totals);
        ownerTotals.set(paidBy, currentPaidTotals);
        ownerTransactionRows.push(
          {
            date: expense.expense_date,
            createdAt: expense.created_at,
            owner: paidBy,
            type: "Split reimbursement received",
            counterparty: owner,
            reference: expense.id,
            description: expense.description,
            category: expense.category,
            amount: ownerShare,
          },
          {
            date: expense.expense_date,
            createdAt: expense.created_at,
            owner,
            type: "Split reimbursement paid",
            counterparty: paidBy,
            reference: expense.id,
            description: expense.description,
            category: expense.category,
            amount: -ownerShare,
          }
        );
      });

      totalExpenses = round2(totalExpenses + amount);
      const expenseVatAmount = isVatPayment
        ? 0
        : calculateVatFromInclusive(amount, Number(expense.vat_rate || 0));
      const expenseExclVat = round2(amount - expenseVatAmount);

      if (isVatPayment) {
        vatPayments = round2(vatPayments + amount);
      } else {
        totalExpensesExclVat = round2(totalExpensesExclVat + expenseExclVat);
        expenseVat = round2(expenseVat + expenseVatAmount);

        if (
          expense.category !== "Equipment" &&
          expense.category !== "Shipping" &&
          expense.category !== "Tax"
        ) {
          operatingCostsExclVat = round2(operatingCostsExclVat + expenseExclVat);
        }
      }

      expenseCategoryTotals.set(
        expense.category,
        round2((expenseCategoryTotals.get(expense.category) || 0) + amount)
      );

      const month = expense.expense_date?.slice(0, 7) || "Undated";
      if (!isVatPayment) {
        monthlyExpenseTotals.set(month, round2((monthlyExpenseTotals.get(month) || 0) + expenseExclVat));
      }
    });

    const months = Array.from(new Set([...monthlyIncomeTotals.keys(), ...monthlyExpenseTotals.keys()]))
      .sort()
      .reverse()
      .slice(0, 6);
    const runningBalances = new Map<Owner, number>();
    const ownerTransactions = ownerTransactionRows
      .sort(
        (a, b) =>
          a.owner.localeCompare(b.owner) ||
          a.date.localeCompare(b.date) ||
          a.createdAt.localeCompare(b.createdAt) ||
          a.type.localeCompare(b.type)
      )
      .map((row) => {
        const balance = round2((runningBalances.get(row.owner) || 0) + row.amount);
        runningBalances.set(row.owner, balance);

        return { ...row, amount: round2(row.amount), balance };
      });

    return {
      totalIncome,
      totalExpenses,
      totalIncomeExclVat,
      totalExpensesExclVat,
      operatingCostsExclVat,
      netTotal: round2(totalIncomeExclVat - totalExpensesExclVat),
      incomeVat,
      expenseVat,
      vatPayments,
      vatBalance: round2(incomeVat - expenseVat - vatPayments),
      ownerTransactions,
      ownerBalances: OWNERS.map((owner) => {
        const totals =
          ownerTotals.get(owner) || {
            customerReceived: 0,
            supplierPaid: 0,
            splitReceived: 0,
            splitPaid: 0,
          };
        const totalReceived = round2(totals.customerReceived + totals.splitReceived);
        const totalPaid = round2(totals.supplierPaid + totals.splitPaid);

        return {
          owner,
          customerReceived: totals.customerReceived,
          supplierPaid: totals.supplierPaid,
          splitReceived: totals.splitReceived,
          splitPaid: totals.splitPaid,
          totalReceived,
          totalPaid,
          balance: round2(totalReceived - totalPaid),
        };
      }),
      statusBreakdown: sortBreakdown(
        Array.from(statusTotals.entries()).map(([label, amount]) => ({ label, amount }))
      ),
      categoryBreakdown: sortBreakdown(
        Array.from(expenseCategoryTotals.entries()).map(([label, amount]) => ({ label, amount }))
      ),
      monthlyBreakdown: months.map((month) => ({
        month,
        income: monthlyIncomeTotals.get(month) || 0,
        expenses: monthlyExpenseTotals.get(month) || 0,
      })),
    };
  }, [clients, dateFrom, dateTo, expenses, invoiceItems, invoices, paymentReceipts]);

  function showAllDates() {
    setDateFrom("");
    setDateTo("");
  }

  function showThisMonth() {
    const today = new Date();
    setDateFrom(localIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)));
    setDateTo(localIsoDate(today));
  }

  function showThisYear() {
    const today = new Date();
    setDateFrom(`${today.getFullYear()}-01-01`);
    setDateTo(localIsoDate(today));
  }

  function exportOwnerTransactionsCsv() {
    if (dashboard.ownerTransactions.length === 0) {
      setDashboardMessage("No owner transactions to export.");
      return;
    }

    const headers = [
      "Owner",
      "Date",
      "Type",
      "Counterparty",
      "Reference",
      "Description",
      "Category",
      "Amount",
      "Running Balance",
    ];
    const rows = dashboard.ownerTransactions.map((transaction: OwnerTransaction) => ({
      "Owner": transaction.owner,
      "Date": transaction.date,
      "Type": transaction.type,
      "Counterparty": transaction.counterparty,
      "Reference": transaction.reference,
      "Description": transaction.description,
      "Category": transaction.category,
      "Amount": transaction.amount.toFixed(2),
      "Running Balance": transaction.balance.toFixed(2),
    }));

    downloadCsv(exportFilename("mgs-owner-transactions"), buildCsv(headers, rows));
    setDashboardMessage(`Exported ${dashboard.ownerTransactions.length} owner transaction(s).`);
  }

  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 1280 }}>
      <section
        style={{
          padding: 18,
          borderRadius: 12,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          marginBottom: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 18,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Image
              src="/mgs-logo.svg"
              alt="Malta Gym Solutions"
              width={118}
              height={63}
              priority
              style={{ width: 118, height: "auto", display: "block" }}
            />
            <div>
              <p
                style={{
                  margin: "0 0 4px 0",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#6b7280",
                }}
              >
                Admin Dashboard
              </p>
              <h1
                style={{
                  margin: 0,
                  fontSize: 28,
                  lineHeight: 1.1,
                  color: "#111827",
                  letterSpacing: 0,
                }}
              >
                MGS Workspace
              </h1>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            {cards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                style={{
                  padding: "9px 11px",
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  color: "#111827",
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {card.title}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: 20, borderRadius: 12, marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <div>
            <h2 style={{ margin: "0 0 6px 0" }}>Income and Expenses</h2>
            <p style={{ margin: 0, color: "#6b7280" }}>
              VAT-exclusive net with VAT payments deducted from the VAT balance.
            </p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 10,
            flexWrap: "wrap",
            padding: 12,
            marginBottom: 18,
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            background: "#f9fafb",
          }}
        >
          <div>
            <label htmlFor="dashboard-date-from" style={{ display: "block", fontSize: 13, color: "#6b7280", marginBottom: 5 }}>
              From
            </label>
            <input
              id="dashboard-date-from"
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) => setDateFrom(event.target.value)}
              style={{ padding: "8px 10px" }}
            />
          </div>
          <div>
            <label htmlFor="dashboard-date-to" style={{ display: "block", fontSize: 13, color: "#6b7280", marginBottom: 5 }}>
              To
            </label>
            <input
              id="dashboard-date-to"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => setDateTo(event.target.value)}
              style={{ padding: "8px 10px" }}
            />
          </div>
          <button onClick={showThisMonth} style={{ padding: "9px 12px" }}>
            This Month
          </button>
          <button onClick={showThisYear} style={{ padding: "9px 12px" }}>
            This Year
          </button>
          <button
            onClick={showAllDates}
            style={{
              padding: "9px 12px",
              background: "#ffffff",
              color: "#111827",
              border: "1px solid #d1d5db",
            }}
          >
            All Time
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(190px, 100%), 1fr))",
            gap: 12,
            marginBottom: 18,
          }}
        >
          {[
            ["Income excl. VAT", dashboard.totalIncomeExclVat],
            ["Expenses excl. VAT", dashboard.totalExpensesExclVat],
            ["Operating costs excl. VAT", dashboard.operatingCostsExclVat],
            ["Net excl. VAT", dashboard.netTotal],
            ["VAT balance", dashboard.vatBalance],
          ].map(([label, amount]) => (
            <div
              key={label}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 14,
                background: "#f9fafb",
                minHeight: 82,
              }}
            >
              <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 8 }}>{label}</div>
              <strong style={{ fontSize: 24 }}>{money(Number(amount))}</strong>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 10,
            }}
          >
            <h3 style={{ margin: 0 }}>Owner Cash Balances</h3>
            <button
              onClick={exportOwnerTransactionsCsv}
              style={{
                padding: "9px 12px",
                background: "#ffffff",
                color: "#111827",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                fontWeight: 700,
              }}
            >
              Export Owner Transactions CSV
            </button>
          </div>

          <div
            style={{
              overflowX: "auto",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              background: "#ffffff",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
              <thead>
                <tr>
                  {["Owner", "Balance", "Customer received", "Supplier paid", "Split received", "Split paid"].map(
                    (heading) => (
                      <th
                        key={heading}
                        style={{
                          textAlign: heading === "Owner" ? "left" : "right",
                          padding: "10px 12px",
                          borderBottom: "1px solid #e5e7eb",
                          color: "#6b7280",
                          fontSize: 13,
                          background: "#f9fafb",
                        }}
                      >
                        {heading}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {dashboard.ownerBalances.map((row) => (
                  <tr key={row.owner}>
                    <td style={{ padding: "12px", borderBottom: "1px solid #f1f5f9", fontWeight: 700 }}>
                      {row.owner}
                    </td>
                    <td
                      style={{
                        padding: "12px",
                        borderBottom: "1px solid #f1f5f9",
                        textAlign: "right",
                        fontWeight: 800,
                        color: row.balance < 0 ? "#991b1b" : "#111827",
                      }}
                    >
                      {money(row.balance)}
                    </td>
                    <td style={{ padding: "12px", borderBottom: "1px solid #f1f5f9", textAlign: "right" }}>
                      {money(row.customerReceived)}
                    </td>
                    <td style={{ padding: "12px", borderBottom: "1px solid #f1f5f9", textAlign: "right" }}>
                      {money(row.supplierPaid)}
                    </td>
                    <td style={{ padding: "12px", borderBottom: "1px solid #f1f5f9", textAlign: "right" }}>
                      {money(row.splitReceived)}
                    </td>
                    <td style={{ padding: "12px", borderBottom: "1px solid #f1f5f9", textAlign: "right" }}>
                      {money(row.splitPaid)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))",
            gap: 14,
          }}
        >
          <BreakdownPanel title="Income by Status" rows={dashboard.statusBreakdown} />
          <BreakdownPanel title="Expenses by Category" rows={dashboard.categoryBreakdown} />

          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: 14,
              background: "#ffffff",
            }}
          >
            <h3 style={{ margin: "0 0 12px 0" }}>Monthly Breakdown</h3>
            {dashboard.monthlyBreakdown.length === 0 ? (
              <p style={{ margin: 0, color: "#6b7280" }}>No invoice or expense data yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {dashboard.monthlyBreakdown.map((row) => (
                  <div
                    key={row.month}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "0.8fr 1fr 1fr",
                      gap: 10,
                      alignItems: "center",
                      borderBottom: "1px solid #f1f5f9",
                      paddingBottom: 8,
                    }}
                  >
                    <strong>{row.month}</strong>
                    <span style={{ color: "#065f46", textAlign: "right" }}>{money(row.income)}</span>
                    <span style={{ color: "#991b1b", textAlign: "right" }}>{money(row.expenses)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {dashboardMessage ? (
          <div
            style={{
              marginTop: 16,
              background: "#fff7ed",
              color: "#9a3412",
              border: "1px solid #fed7aa",
              padding: 12,
              borderRadius: 8,
            }}
          >
            {dashboardMessage}
          </div>
        ) : null}
      </section>

    </main>
  );
}

function BreakdownPanel({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        background: "#ffffff",
      }}
    >
      <h3 style={{ marginBottom: 12 }}>{title}</h3>
      {rows.length === 0 ? (
        <p style={{ margin: 0, color: "#6b7280" }}>No data yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((row) => {
            const width = total > 0 ? `${Math.max((row.amount / total) * 100, 6)}%` : "0%";

            return (
              <div key={row.label}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
                  <span>{row.label}</span>
                  <strong>{money(row.amount)}</strong>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: "#f3f4f6", overflow: "hidden" }}>
                  <div style={{ height: "100%", width, background: "#111827", borderRadius: 999 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
