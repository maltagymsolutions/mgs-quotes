"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/src/lib/supabase-browser";

type UserInfo = {
  email?: string;
} | null;

type Expense = {
  id: string;
  created_at: string;
  expense_date: string;
  supplier: string | null;
  description: string;
  category: ExpenseCategory;
  vat_rate: number;
  amount_incl_vat: number;
};

type ExpenseCategory = "Equipment" | "Transport" | "Professional fees" | "Tax" | "Shipping";

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Equipment",
  "Transport",
  "Professional fees",
  "Tax",
  "Shipping",
];

const VAT_RATES = [0, 5, 7, 18] as const;

const EXPENSES_SETUP_MESSAGE =
  "Expenses table is not set up yet. Run supabase/migrations/001_create_expenses.sql in Supabase, then refresh this page.";

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

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

function calculateExpense(amountInclVat: number, vatRate: number) {
  const amountExclVat = round2(amountInclVat / (1 + vatRate / 100));
  const vatAmount = round2(amountInclVat - amountExclVat);

  return { amountExclVat, vatAmount };
}

export default function ExpensesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<UserInfo>(null);
  const [message, setMessage] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const [expenseDate, setExpenseDate] = useState(todayDate());
  const [supplier, setSupplier] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("Equipment");
  const [vatRate, setVatRate] = useState(18);
  const [amountInclVat, setAmountInclVat] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const loadExpenses = useCallback(async function loadExpenses() {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.code === "PGRST205" ? EXPENSES_SETUP_MESSAGE : error.message);
      return;
    }

    setExpenses(data || []);
  }, [supabase]);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user ? { email: data.user.email } : null);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { email: session.user.email } : null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!user) return;

    const timer = window.setTimeout(() => {
      loadExpenses();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadExpenses, user]);

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage(error.code === "PGRST205" ? EXPENSES_SETUP_MESSAGE : error.message);
      return;
    }

    setMessage("Logged out.");
    setExpenses([]);
  }

  function clearForm() {
    setEditingExpenseId(null);
    setExpenseDate(todayDate());
    setSupplier("");
    setDescription("");
    setCategory("Equipment");
    setVatRate(18);
    setAmountInclVat("");
  }

  function startEditing(expense: Expense) {
    setEditingExpenseId(expense.id);
    setExpenseDate(expense.expense_date);
    setSupplier(expense.supplier || "");
    setDescription(expense.description || "");
    setCategory(expense.category);
    setVatRate(Number(expense.vat_rate));
    setAmountInclVat(String(expense.amount_incl_vat ?? ""));
  }

  async function saveExpense() {
    if (!description.trim()) {
      setMessage("Please enter an expense description.");
      return;
    }

    if (Number(amountInclVat || 0) < 0) {
      setMessage("Expense amount cannot be negative.");
      return;
    }

    setMessage(editingExpenseId ? "Updating expense..." : "Saving expense...");

    const payload = {
      expense_date: expenseDate,
      supplier: supplier || null,
      description,
      category,
      vat_rate: vatRate,
      amount_incl_vat: Number(amountInclVat || 0),
    };

    const { error } = editingExpenseId
      ? await supabase.from("expenses").update(payload).eq("id", editingExpenseId)
      : await supabase.from("expenses").insert(payload);

    if (error) {
      setMessage(error.code === "PGRST205" ? EXPENSES_SETUP_MESSAGE : error.message);
      return;
    }

    clearForm();
    setMessage(editingExpenseId ? "Expense updated." : "Expense saved.");
    await loadExpenses();
  }

  async function deleteExpense(expenseId: string) {
    const confirmed = window.confirm("Delete this expense?");
    if (!confirmed) return;

    setMessage("Deleting expense...");

    const { error } = await supabase.from("expenses").delete().eq("id", expenseId);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (editingExpenseId === expenseId) {
      clearForm();
    }

    setMessage("Expense deleted.");
    await loadExpenses();
  }

  const formTotals = useMemo(
    () => calculateExpense(Number(amountInclVat || 0), vatRate),
    [amountInclVat, vatRate]
  );

  const filteredExpenses = useMemo(() => {
    let rows = [...expenses];

    if (categoryFilter !== "All") {
      rows = rows.filter((expense) => expense.category === categoryFilter);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter(
        (expense) =>
          expense.description.toLowerCase().includes(q) ||
          (expense.supplier || "").toLowerCase().includes(q) ||
          expense.category.toLowerCase().includes(q)
      );
    }

    return rows;
  }, [expenses, categoryFilter, searchTerm]);

  const summary = useMemo(() => {
    return expenses.reduce(
      (totals, expense) => {
        const amountIncl = Number(expense.amount_incl_vat || 0);
        const calculated = calculateExpense(amountIncl, Number(expense.vat_rate || 0));

        totals.amountInclVat += amountIncl;
        totals.amountExclVat += calculated.amountExclVat;
        totals.vatAmount += calculated.vatAmount;

        return totals;
      },
      { amountInclVat: 0, amountExclVat: 0, vatAmount: 0 }
    );
  }, [expenses]);

  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 1180 }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/">← Back to dashboard</Link>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ marginBottom: 8 }}>Expenses</h1>
          <p style={{ margin: 0, color: "#4b5563" }}>
            Record business expenses and track VAT by category.
          </p>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            padding: 14,
            minWidth: 240,
          }}
        >
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>Logged in as</div>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>{user?.email || "-"}</div>
          <button onClick={signOut} style={{ padding: "10px 14px" }}>
            Log Out
          </button>
        </div>
      </div>

      <section style={{ padding: 20, borderRadius: 16, marginBottom: 24 }}>
        <h2>{editingExpenseId ? "Edit Expense" : "Add Expense"}</h2>

        <div style={{ display: "grid", gap: 14 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
              gap: 14,
            }}
          >
            <div>
              <label>Date</label>
              <input
                type="date"
                style={{ width: "100%", padding: 12, marginTop: 6 }}
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </div>

            <div>
              <label>Supplier</label>
              <input
                style={{ width: "100%", padding: 12, marginTop: 6 }}
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label>Description</label>
            <input
              style={{ width: "100%", padding: 12, marginTop: 6 }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))",
              gap: 14,
            }}
          >
            <div>
              <label>Category</label>
              <select
                style={{ width: "100%", padding: 12, marginTop: 6 }}
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              >
                {EXPENSE_CATEGORIES.map((expenseCategory) => (
                  <option key={expenseCategory} value={expenseCategory}>
                    {expenseCategory}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>VAT %</label>
              <select
                style={{ width: "100%", padding: 12, marginTop: 6 }}
                value={vatRate}
                onChange={(e) => setVatRate(Number(e.target.value))}
              >
                {VAT_RATES.map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}%
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Amount incl. VAT</label>
              <input
                type="number"
                min="0"
                step="0.01"
                style={{ width: "100%", padding: 12, marginTop: 6 }}
                value={amountInclVat}
                onChange={(e) => setAmountInclVat(e.target.value)}
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))",
              gap: 12,
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <div>
              <div style={{ color: "#6b7280", fontSize: 13 }}>Excluding VAT</div>
              <strong>{money(formTotals.amountExclVat)}</strong>
            </div>
            <div>
              <div style={{ color: "#6b7280", fontSize: 13 }}>VAT amount</div>
              <strong>{money(formTotals.vatAmount)}</strong>
            </div>
            <div>
              <div style={{ color: "#6b7280", fontSize: 13 }}>Total</div>
              <strong>{money(Number(amountInclVat || 0))}</strong>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
            <button onClick={saveExpense} style={{ padding: "10px 14px" }}>
              {editingExpenseId ? "Update Expense" : "Save Expense"}
            </button>
            {editingExpenseId ? (
              <button
                onClick={clearForm}
                style={{
                  padding: "10px 14px",
                  background: "#ffffff",
                  color: "#111827",
                  border: "1px solid #d1d5db",
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section style={{ padding: 20, borderRadius: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <div>
            <h2 style={{ marginBottom: 6 }}>Expense List</h2>
            <p style={{ margin: 0, color: "#6b7280" }}>{expenses.length} expense(s)</p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, 100%), 1fr))",
              gap: 12,
              flex: "1 1 420px",
            }}
          >
            <div>
              <div style={{ color: "#6b7280", fontSize: 13 }}>Total incl. VAT</div>
              <strong>{money(summary.amountInclVat)}</strong>
            </div>
            <div>
              <div style={{ color: "#6b7280", fontSize: 13 }}>Total excl. VAT</div>
              <strong>{money(summary.amountExclVat)}</strong>
            </div>
            <div>
              <div style={{ color: "#6b7280", fontSize: 13 }}>VAT paid</div>
              <strong>{money(summary.vatAmount)}</strong>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
            gap: 14,
            marginBottom: 16,
          }}
        >
          <div>
            <label>Search</label>
            <input
              style={{ width: "100%", padding: 12, marginTop: 6 }}
              placeholder="Search by supplier, description, or category"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div>
            <label>Category</label>
            <select
              style={{ width: "100%", padding: 12, marginTop: 6 }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="All">All categories</option>
              {EXPENSE_CATEGORIES.map((expenseCategory) => (
                <option key={expenseCategory} value={expenseCategory}>
                  {expenseCategory}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <div
            style={{
              border: "1px dashed #d1d5db",
              borderRadius: 12,
              padding: 24,
              color: "#6b7280",
            }}
          >
            No expenses saved yet.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 12 }}>Date</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 12 }}>Supplier</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 12 }}>Description</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 12 }}>Category</th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: 12 }}>VAT %</th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: 12 }}>Excl. VAT</th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: 12 }}>VAT</th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: 12 }}>Incl. VAT</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 12 }}>Edit</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 12 }}>Delete</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((expense) => {
                  const calculated = calculateExpense(
                    Number(expense.amount_incl_vat || 0),
                    Number(expense.vat_rate || 0)
                  );

                  return (
                    <tr key={expense.id}>
                      <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12 }}>{expense.expense_date}</td>
                      <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12 }}>{expense.supplier || "-"}</td>
                      <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12 }}>{expense.description}</td>
                      <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12 }}>{expense.category}</td>
                      <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12, textAlign: "right" }}>
                        {Number(expense.vat_rate)}%
                      </td>
                      <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12, textAlign: "right" }}>
                        {money(calculated.amountExclVat)}
                      </td>
                      <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12, textAlign: "right" }}>
                        {money(calculated.vatAmount)}
                      </td>
                      <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12, textAlign: "right", fontWeight: 700 }}>
                        {money(expense.amount_incl_vat)}
                      </td>
                      <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12 }}>
                        <button
                          onClick={() => startEditing(expense)}
                          style={{
                            padding: "8px 12px",
                            background: "#ffffff",
                            color: "#111827",
                            border: "1px solid #d1d5db",
                          }}
                        >
                          Edit
                        </button>
                      </td>
                      <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12 }}>
                        <button
                          onClick={() => deleteExpense(expense.id)}
                          style={{
                            padding: "8px 12px",
                            background: "#ffffff",
                            color: "#991b1b",
                            border: "1px solid #fca5a5",
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {message ? (
        <div
          style={{
            marginTop: 16,
            background: "#ecfdf5",
            color: "#065f46",
            border: "1px solid #a7f3d0",
            padding: 12,
            borderRadius: 12,
          }}
        >
          {message}
        </div>
      ) : null}
    </main>
  );
}
