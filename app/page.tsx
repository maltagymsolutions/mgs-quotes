"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/src/lib/supabase-browser";

type Invoice = {
  id: string;
  date_issued: string;
  status: string;
  vat_rate: number;
  discount_amount_incl_vat: number | null;
};

type InvoiceItem = {
  invoice_id: string;
  qty: number;
  sale_price_incl_vat: number;
};

type Expense = {
  id: string;
  expense_date: string;
  category: string;
  vat_rate: number;
  amount_incl_vat: number;
};

type BreakdownRow = {
  label: string;
  amount: number;
};

const EXPENSES_SETUP_MESSAGE =
  "Expenses table is not set up yet. Run supabase/migrations/001_create_expenses.sql in Supabase, then refresh this page.";

const cards = [
  {
    title: "Clients",
    description: "Add and manage private and business clients used on your documents.",
    href: "/clients",
    cta: "Open Clients",
  },
  {
    title: "Inventory",
    description: "Maintain your catalogue, pricing, and CSV imports for products and equipment.",
    href: "/inventory",
    cta: "Open Inventory",
  },
  {
    title: "Quotes",
    description: "Create quotes, track internal profit, and convert approved quotes into invoices.",
    href: "/quotes",
    cta: "Open Quotes",
  },
  {
    title: "Invoices",
    description: "Create and edit invoices while keeping internal margin details separate from the client view.",
    href: "/invoices",
    cta: "Open Invoices",
  },
  {
    title: "Expenses",
    description: "Record supplier costs, expense categories, and VAT paid on business purchases.",
    href: "/expenses",
    cta: "Open Expenses",
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

export default function HomePage() {
  const supabase = useMemo(() => createClient(), []);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [dashboardMessage, setDashboardMessage] = useState("");

  const loadDashboard = useCallback(async function loadDashboard() {
    const [invoicesResult, invoiceItemsResult, expensesResult] = await Promise.all([
      supabase
        .from("invoices")
        .select("id, date_issued, status, vat_rate, discount_amount_incl_vat")
        .order("date_issued", { ascending: false }),
      supabase.from("invoice_items").select("invoice_id, qty, sale_price_incl_vat"),
      supabase
        .from("expenses")
        .select("id, expense_date, category, vat_rate, amount_incl_vat")
        .order("expense_date", { ascending: false }),
    ]);

    if (invoicesResult.error) {
      setDashboardMessage(invoicesResult.error.message);
      return;
    }

    if (invoiceItemsResult.error) {
      setDashboardMessage(invoiceItemsResult.error.message);
      return;
    }

    setInvoices(invoicesResult.data || []);
    setInvoiceItems(invoiceItemsResult.data || []);

    if (expensesResult.error) {
      setExpenses([]);
      setDashboardMessage(EXPENSES_SETUP_MESSAGE);
      return;
    }

    setExpenses(expensesResult.data || []);
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

    invoiceItems.forEach((item) => {
      const existing = itemsByInvoice.get(item.invoice_id) || [];
      existing.push(item);
      itemsByInvoice.set(item.invoice_id, existing);
    });

    const statusTotals = new Map<string, number>();
    const monthlyIncomeTotals = new Map<string, number>();

    let totalIncome = 0;
    let incomeVat = 0;

    invoices.forEach((invoice) => {
      const rows = itemsByInvoice.get(invoice.id) || [];
      const itemsTotal = rows.reduce(
        (sum, item) => sum + Number(item.sale_price_incl_vat || 0) * Number(item.qty || 0),
        0
      );
      const discountApplied = Math.min(Number(invoice.discount_amount_incl_vat || 0), itemsTotal);
      const invoiceTotal = round2(itemsTotal - discountApplied);
      const currentStatusTotal = statusTotals.get(invoice.status) || 0;

      statusTotals.set(invoice.status, round2(currentStatusTotal + invoiceTotal));

      if (invoice.status !== "Archived") {
        totalIncome = round2(totalIncome + invoiceTotal);
        incomeVat = round2(incomeVat + calculateVatFromInclusive(invoiceTotal, Number(invoice.vat_rate || 0)));

        const month = invoice.date_issued?.slice(0, 7) || "Undated";
        monthlyIncomeTotals.set(month, round2((monthlyIncomeTotals.get(month) || 0) + invoiceTotal));
      }
    });

    const expenseCategoryTotals = new Map<string, number>();
    const monthlyExpenseTotals = new Map<string, number>();

    let totalExpenses = 0;
    let expenseVat = 0;

    expenses.forEach((expense) => {
      const amount = Number(expense.amount_incl_vat || 0);
      totalExpenses = round2(totalExpenses + amount);
      expenseVat = round2(expenseVat + calculateVatFromInclusive(amount, Number(expense.vat_rate || 0)));

      expenseCategoryTotals.set(
        expense.category,
        round2((expenseCategoryTotals.get(expense.category) || 0) + amount)
      );

      const month = expense.expense_date?.slice(0, 7) || "Undated";
      monthlyExpenseTotals.set(month, round2((monthlyExpenseTotals.get(month) || 0) + amount));
    });

    const months = Array.from(new Set([...monthlyIncomeTotals.keys(), ...monthlyExpenseTotals.keys()]))
      .sort()
      .reverse()
      .slice(0, 6);

    return {
      totalIncome,
      totalExpenses,
      netTotal: round2(totalIncome - totalExpenses),
      incomeVat,
      expenseVat,
      vatBalance: round2(incomeVat - expenseVat),
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
  }, [expenses, invoiceItems, invoices]);

  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 1180 }}>
      <section
        style={{
          padding: 36,
          borderRadius: 18,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          marginBottom: 24,
          boxShadow: "0 8px 24px rgba(17, 24, 39, 0.05)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
            gap: 40,
            alignItems: "center",
          }}
        >
          <div>
            <Image
              src="/mgs-logo.svg"
              alt="Malta Gym Solutions"
              width={150}
              height={80}
              priority
              style={{ width: "150px", height: "auto", display: "block" }}
            />

            <div
              style={{
                width: 56,
                height: 3,
                background: "#e10600",
                marginTop: 22,
                marginBottom: 18,
                borderRadius: 999,
              }}
            />

            <p
              style={{
                margin: 0,
                color: "#6b7280",
                fontSize: 14,
                lineHeight: 1.6,
                maxWidth: 180,
              }}
            >
              Internal workspace for quotes, invoices, clients, inventory, and expenses.
            </p>
          </div>

          <div style={{ maxWidth: 720 }}>
            <p
              style={{
                margin: "0 0 10px 0",
                fontSize: 13,
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
                margin: "0 0 14px 0",
                fontSize: "3.2rem",
                lineHeight: 0.98,
                color: "#111827",
                letterSpacing: 0,
              }}
            >
              Quote and Invoice Creator
            </h1>

            <p
              style={{
                margin: 0,
                color: "#4b5563",
                lineHeight: 1.65,
                fontSize: 17,
                maxWidth: 560,
              }}
            >
              Create quotes, manage inventory, track income, and record expenses.
            </p>
          </div>
        </div>
      </section>

      <section style={{ padding: 24, borderRadius: 16, marginBottom: 24 }}>
        <div style={{ marginBottom: 22 }}>
          <h2 style={{ marginBottom: 8 }}>Income and Expenses</h2>
          <p style={{ margin: 0, color: "#6b7280" }}>
            Totals exclude archived invoices and use amounts including VAT.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))",
            gap: 14,
            marginBottom: 20,
          }}
        >
          {[
            ["Income", dashboard.totalIncome],
            ["Expenses", dashboard.totalExpenses],
            ["Net", dashboard.netTotal],
            ["VAT balance", dashboard.vatBalance],
          ].map(([label, amount]) => (
            <div
              key={label}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 16,
                background: "#f9fafb",
              }}
            >
              <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 8 }}>{label}</div>
              <strong style={{ fontSize: 22 }}>{money(Number(amount))}</strong>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
            gap: 18,
          }}
        >
          <BreakdownPanel title="Income by Status" rows={dashboard.statusBreakdown} />
          <BreakdownPanel title="Expenses by Category" rows={dashboard.categoryBreakdown} />

          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 16,
              background: "#ffffff",
            }}
          >
            <h3 style={{ marginBottom: 12 }}>Monthly Breakdown</h3>
            {dashboard.monthlyBreakdown.length === 0 ? (
              <p style={{ margin: 0, color: "#6b7280" }}>No invoice or expense data yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {dashboard.monthlyBreakdown.map((row) => (
                  <div
                    key={row.month}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "0.8fr 1fr 1fr",
                      gap: 10,
                      alignItems: "center",
                      borderBottom: "1px solid #f1f5f9",
                      paddingBottom: 10,
                    }}
                  >
                    <strong>{row.month}</strong>
                    <span style={{ color: "#065f46" }}>{money(row.income)}</span>
                    <span style={{ color: "#991b1b" }}>{money(row.expenses)}</span>
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
              borderRadius: 12,
            }}
          >
            {dashboardMessage}
          </div>
        ) : null}
      </section>

      <section style={{ padding: 24, borderRadius: 16 }}>
        <div style={{ marginBottom: 22 }}>
          <h2 style={{ marginBottom: 8 }}>Choose a section</h2>
          <p style={{ margin: 0, color: "#6b7280" }}>
            Open the area you want to work on.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
            gap: 18,
          }}
        >
          {cards.map((card) => (
            <div
              key={card.href}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 20,
                background: "#ffffff",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: 215,
              }}
            >
              <div>
                <h3 style={{ margin: "0 0 12px 0", fontSize: 18, color: "#111827" }}>{card.title}</h3>
                <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.6 }}>{card.description}</p>
              </div>

              <div style={{ marginTop: 20 }}>
                <Link
                  href={card.href}
                  style={{
                    display: "inline-block",
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "#111827",
                    color: "#ffffff",
                    textDecoration: "none",
                    fontWeight: 700,
                  }}
                >
                  {card.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>
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
