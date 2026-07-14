"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppPage } from "@/src/components/app-page";
import { buildCsv, downloadCsv } from "@/src/lib/csv";
import { formatDatabaseError } from "@/src/lib/database-errors";
import {
  BankAccount,
  BANK_ACCOUNTS,
  DEFAULT_BANK_ACCOUNT,
  DEFAULT_OWNER,
  isOwner,
  Owner,
  OWNERS,
  resolveBankAccount,
  resolveOwner,
  resolveOwnerSplit,
} from "@/src/lib/owners";
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
  bank_account?: BankAccount | null;
  paid_by_owner: Owner | null;
  split_owners: Owner[] | null;
  hidden_from_dashboard?: boolean | null;
};

type ExpenseCategory = "Equipment" | "Professional fees" | "Tax" | "Shipping" | "VAT" | "Advertising";

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Equipment",
  "Professional fees",
  "Tax",
  "Shipping",
  "VAT",
  "Advertising",
];

const VAT_RATES = [0, 5, 7, 18] as const;

const EXPENSES_SETUP_MESSAGE =
  "Expenses table is not set up yet. Run supabase/migrations/001_create_expenses.sql, 004_add_bank_accounts_to_money_records.sql, 005_adapt_money_records_to_owners.sql, 006_add_vat_expense_category.sql, and 018_add_hidden_expenses_from_dashboard.sql in Supabase, then refresh this page.";

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

function exportFilename(prefix: string) {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
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
  const [bankAccount, setBankAccount] = useState<BankAccount>(DEFAULT_BANK_ACCOUNT);
  const [paidByOwner, setPaidByOwner] = useState<Owner>(DEFAULT_OWNER);
  const [splitOwners, setSplitOwners] = useState<Owner[]>([DEFAULT_OWNER]);
  const [hiddenFromDashboard, setHiddenFromDashboard] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [supplierFilter, setSupplierFilter] = useState("All");
  const [bankAccountFilter, setBankAccountFilter] = useState("All");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [dashboardFilter, setDashboardFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadExpenses = useCallback(async function loadExpenses() {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(formatDatabaseError(error, EXPENSES_SETUP_MESSAGE));
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
      setMessage(formatDatabaseError(error, EXPENSES_SETUP_MESSAGE));
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
    setBankAccount(DEFAULT_BANK_ACCOUNT);
    setPaidByOwner(DEFAULT_OWNER);
    setSplitOwners([DEFAULT_OWNER]);
    setHiddenFromDashboard(false);
  }

  function startEditing(expense: Expense) {
    const account = resolveBankAccount(expense.bank_account);
    const owner = resolveOwner(expense.paid_by_owner);

    setEditingExpenseId(expense.id);
    setExpenseDate(expense.expense_date);
    setSupplier(expense.supplier || "");
    setDescription(expense.description || "");
    setCategory(expense.category);
    setVatRate(Number(expense.vat_rate));
    setAmountInclVat(String(expense.amount_incl_vat ?? ""));
    setBankAccount(account);
    setPaidByOwner(owner);
    setSplitOwners(resolveOwnerSplit(expense.split_owners, owner));
    setHiddenFromDashboard(Boolean(expense.hidden_from_dashboard));
  }

  function updateBankAccount(account: BankAccount) {
    setBankAccount(account);

    if (isOwner(account)) {
      updatePaidByOwner(account);
    }
  }

  function updatePaidByOwner(owner: Owner) {
    setPaidByOwner(owner);
    setSplitOwners((currentOwners) =>
      currentOwners.length === 1 ? [owner] : currentOwners.includes(owner) ? currentOwners : [owner, ...currentOwners]
    );
  }

  function toggleSplitOwner(owner: Owner) {
    setSplitOwners((currentOwners) => {
      if (currentOwners.includes(owner)) {
        return currentOwners.length === 1 ? currentOwners : currentOwners.filter((row) => row !== owner);
      }

      return [...currentOwners, owner];
    });
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

    if (splitOwners.length === 0) {
      setMessage("Choose at least one owner to split this expense.");
      return;
    }

    setMessage(editingExpenseId ? "Updating expense..." : "Saving expense...");

    const normalizedPaidByOwner = isOwner(bankAccount) ? paidByOwner : DEFAULT_OWNER;
    const normalizedSplitOwners = isOwner(bankAccount)
      ? Array.from(new Set([paidByOwner, ...splitOwners]))
      : [DEFAULT_OWNER];
    const normalizedVatRate = category === "VAT" ? 0 : vatRate;

    const payload = {
      expense_date: expenseDate,
      supplier: supplier || null,
      description,
      category,
      vat_rate: normalizedVatRate,
      amount_incl_vat: Number(amountInclVat || 0),
      bank_account: bankAccount,
      paid_by_owner: normalizedPaidByOwner,
      split_owners: normalizedSplitOwners,
      hidden_from_dashboard: hiddenFromDashboard,
    };

    const { error } = editingExpenseId
      ? await supabase.from("expenses").update(payload).eq("id", editingExpenseId)
      : await supabase.from("expenses").insert(payload);

    if (error) {
      setMessage(formatDatabaseError(error, EXPENSES_SETUP_MESSAGE));
      return;
    }

    clearForm();
    setMessage(editingExpenseId ? "Expense updated." : "Expense saved.");
    await loadExpenses();
  }

  async function toggleDashboardVisibility(expense: Expense) {
    const nextHidden = !expense.hidden_from_dashboard;

    setMessage(nextHidden ? "Hiding expense from dashboard calculations..." : "Including expense in dashboard calculations...");

    const { error } = await supabase
      .from("expenses")
      .update({ hidden_from_dashboard: nextHidden })
      .eq("id", expense.id);

    if (error) {
      setMessage(formatDatabaseError(error, EXPENSES_SETUP_MESSAGE));
      return;
    }

    setMessage(nextHidden ? "Expense hidden from dashboard calculations." : "Expense included in dashboard calculations.");
    await loadExpenses();
  }

  async function deleteExpense(expenseId: string) {
    const confirmed = window.confirm("Delete this expense?");
    if (!confirmed) return;

    setMessage("Deleting expense...");

    const { error } = await supabase.from("expenses").delete().eq("id", expenseId);

    if (error) {
      setMessage(formatDatabaseError(error));
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

    if (dateFrom) {
      rows = rows.filter((expense) => expense.expense_date >= dateFrom);
    }

    if (dateTo) {
      rows = rows.filter((expense) => expense.expense_date <= dateTo);
    }

    if (categoryFilter !== "All") {
      rows = rows.filter((expense) => expense.category === categoryFilter);
    }

    if (supplierFilter !== "All") {
      rows = rows.filter((expense) => (expense.supplier || "No supplier") === supplierFilter);
    }

    if (bankAccountFilter !== "All") {
      rows = rows.filter((expense) => resolveBankAccount(expense.bank_account) === bankAccountFilter);
    }

    if (ownerFilter !== "All") {
      rows = rows.filter((expense) => {
        const account = resolveBankAccount(expense.bank_account);
        if (!isOwner(account)) return false;

        const paidBy = resolveOwner(expense.paid_by_owner);
        const splitBetween = resolveOwnerSplit(expense.split_owners, paidBy);

        return paidBy === ownerFilter || splitBetween.includes(ownerFilter as Owner);
      });
    }

    if (dashboardFilter === "Included") {
      rows = rows.filter((expense) => !expense.hidden_from_dashboard);
    }

    if (dashboardFilter === "Hidden") {
      rows = rows.filter((expense) => Boolean(expense.hidden_from_dashboard));
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter(
        (expense) =>
          expense.description.toLowerCase().includes(q) ||
          (expense.supplier || "").toLowerCase().includes(q) ||
          expense.category.toLowerCase().includes(q) ||
          resolveBankAccount(expense.bank_account).toLowerCase().includes(q) ||
          resolveOwner(expense.paid_by_owner).toLowerCase().includes(q) ||
          resolveOwnerSplit(expense.split_owners, resolveOwner(expense.paid_by_owner))
            .join(" ")
            .toLowerCase()
            .includes(q)
      );
    }

    return rows;
  }, [expenses, bankAccountFilter, categoryFilter, dashboardFilter, dateFrom, dateTo, ownerFilter, searchTerm, supplierFilter]);

  const summary = useMemo(() => {
    return filteredExpenses.reduce(
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
  }, [filteredExpenses]);

  const supplierOptions = useMemo(
    () =>
      Array.from(new Set(expenses.map((expense) => expense.supplier || "No supplier"))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [expenses]
  );

  const filteredCategoryTotals = useMemo(() => {
    const totals = new Map<string, number>();

    filteredExpenses.forEach((expense) => {
      totals.set(
        expense.category,
        round2((totals.get(expense.category) || 0) + Number(expense.amount_incl_vat || 0))
      );
    });

    return Array.from(totals.entries())
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label));
  }, [filteredExpenses]);

  function exportExpensesCsv() {
    if (filteredExpenses.length === 0) {
      setMessage("No expenses to export.");
      return;
    }

    const headers = [
      "Date",
      "Supplier",
      "Description",
      "Category",
      "Paid From",
      "Direct Owner",
      "Split Between",
      "VAT %",
      "Amount Excl. VAT",
      "VAT Amount",
      "Amount Incl. VAT",
      "Dashboard Calculations",
      "Created At",
    ];

    const rows = filteredExpenses.map((expense) => {
      const account = resolveBankAccount(expense.bank_account);
      const paidBy = resolveOwner(expense.paid_by_owner);
      const splitBetween = resolveOwnerSplit(expense.split_owners, paidBy);
      const calculated = calculateExpense(
        Number(expense.amount_incl_vat || 0),
        Number(expense.vat_rate || 0)
      );

      return {
        "Date": expense.expense_date,
        "Supplier": expense.supplier || "",
        "Description": expense.description,
        "Category": expense.category,
        "Paid From": account,
        "Direct Owner": isOwner(account) ? paidBy : "",
        "Split Between": isOwner(account) ? splitBetween.join("; ") : "",
        "VAT %": Number(expense.vat_rate || 0),
        "Amount Excl. VAT": calculated.amountExclVat.toFixed(2),
        "VAT Amount": calculated.vatAmount.toFixed(2),
        "Amount Incl. VAT": Number(expense.amount_incl_vat || 0).toFixed(2),
        "Dashboard Calculations": expense.hidden_from_dashboard ? "Hidden" : "Included",
        "Created At": expense.created_at,
      };
    });

    downloadCsv(exportFilename("mgs-expenses"), buildCsv(headers, rows));
    setMessage(`Exported ${filteredExpenses.length} expense(s).`);
  }

  return (
    <AppPage
      title="Expenses"
      description="Record supplier costs, VAT, APS payments, and direct owner-paid expenses."
      actions={
        <div className="rounded-md border border-white/15 px-3 py-2 text-sm text-slate-200">
          <span className="mr-3">{user?.email || "-"}</span>
          <button onClick={signOut} className="!rounded-md !border-white/20 !bg-transparent px-3 py-1.5 text-sm font-bold !text-white">
            Log out
          </button>
        </div>
      }
    >

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
                onChange={(e) => {
                  const nextCategory = e.target.value as ExpenseCategory;
                  setCategory(nextCategory);
                  if (nextCategory === "VAT") {
                    setVatRate(0);
                  }
                }}
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

            <div>
              <label>Paid From</label>
              <select
                style={{ width: "100%", padding: 12, marginTop: 6 }}
                value={bankAccount}
                onChange={(e) => updateBankAccount(e.target.value as BankAccount)}
              >
                {BANK_ACCOUNTS.map((account) => (
                  <option key={account} value={account}>
                    {account}
                  </option>
                ))}
              </select>
            </div>

            {isOwner(bankAccount) ? (
              <div>
                <label>Owner Who Paid</label>
                <select
                  style={{ width: "100%", padding: 12, marginTop: 6 }}
                  value={paidByOwner}
                  onChange={(e) => updatePaidByOwner(e.target.value as Owner)}
                >
                  {OWNERS.map((owner) => (
                    <option key={owner} value={owner}>
                      {owner}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {isOwner(bankAccount) ? (
            <div>
              <label>Split Between</label>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  marginTop: 8,
                }}
              >
                {OWNERS.map((owner) => (
                  <label
                    key={owner}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      border: "1px solid #d1d5db",
                      borderRadius: 8,
                      padding: "9px 11px",
                      background: splitOwners.includes(owner) ? "#f3f4f6" : "#ffffff",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={splitOwners.includes(owner)}
                      disabled={owner === paidByOwner}
                      onChange={() => toggleSplitOwner(owner)}
                    />
                    {owner}
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                background: "#f9fafb",
                color: "#4b5563",
                padding: 12,
              }}
            >
              APS expenses are treated as company-paid and are not added to owner cash balances.
            </div>
          )}

          <label
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: hiddenFromDashboard ? "#fff7ed" : "#f9fafb",
              padding: 12,
            }}
          >
            <input
              type="checkbox"
              checked={hiddenFromDashboard}
              onChange={(e) => setHiddenFromDashboard(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>
              <strong style={{ display: "block", color: "#111827" }}>Hide from dashboard calculations</strong>
              <span style={{ display: "block", marginTop: 3, color: "#6b7280", fontSize: 13 }}>
                The expense stays in this list, but dashboard expense totals, VAT, owner balances, and category/monthly breakdowns omit it.
              </span>
            </span>
          </label>

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
            <div>
              <div style={{ color: "#6b7280", fontSize: 13 }}>Split share</div>
              <strong>{isOwner(bankAccount) ? money(Number(amountInclVat || 0) / splitOwners.length) : "-"}</strong>
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
            <p style={{ margin: 0, color: "#6b7280" }}>
              {filteredExpenses.length} of {expenses.length} expense(s)
            </p>
          </div>

          <button
            onClick={exportExpensesCsv}
            style={{
              padding: "10px 14px",
              background: "#111827",
              color: "#ffffff",
              border: "1px solid #111827",
              borderRadius: 8,
              fontWeight: 700,
            }}
          >
            Export CSV
          </button>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, 100%), 1fr))",
              gap: 12,
              flex: "1 1 420px",
            }}
          >
            <div>
              <div style={{ color: "#6b7280", fontSize: 13 }}>Filtered incl. VAT</div>
              <strong>{money(summary.amountInclVat)}</strong>
            </div>
            <div>
              <div style={{ color: "#6b7280", fontSize: 13 }}>Filtered excl. VAT</div>
              <strong>{money(summary.amountExclVat)}</strong>
            </div>
            <div>
              <div style={{ color: "#6b7280", fontSize: 13 }}>Filtered VAT</div>
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
            <label>From</label>
            <input
              type="date"
              style={{ width: "100%", padding: 12, marginTop: 6 }}
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div>
            <label>To</label>
            <input
              type="date"
              style={{ width: "100%", padding: 12, marginTop: 6 }}
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

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

          <div>
            <label>Supplier / Retailer</label>
            <select
              style={{ width: "100%", padding: 12, marginTop: 6 }}
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
            >
              <option value="All">All suppliers</option>
              {supplierOptions.map((supplierName) => (
                <option key={supplierName} value={supplierName}>
                  {supplierName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Paid From</label>
            <select
              style={{ width: "100%", padding: 12, marginTop: 6 }}
              value={bankAccountFilter}
              onChange={(e) => setBankAccountFilter(e.target.value)}
            >
              <option value="All">All accounts</option>
              {BANK_ACCOUNTS.map((account) => (
                <option key={account} value={account}>
                  {account}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Owner</label>
            <select
              style={{ width: "100%", padding: 12, marginTop: 6 }}
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
            >
              <option value="All">All owners</option>
              {OWNERS.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Dashboard</label>
            <select
              style={{ width: "100%", padding: 12, marginTop: 6 }}
              value={dashboardFilter}
              onChange={(e) => setDashboardFilter(e.target.value)}
            >
              <option value="All">All statuses</option>
              <option value="Included">Included in dashboard</option>
              <option value="Hidden">Hidden from dashboard</option>
            </select>
          </div>
        </div>

        {filteredCategoryTotals.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))",
              gap: 12,
              marginBottom: 16,
            }}
          >
            {filteredCategoryTotals.map((row) => (
              <div
                key={row.label}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 12,
                  background: "#f9fafb",
                }}
              >
                <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 4 }}>{row.label}</div>
                <strong>{money(row.amount)}</strong>
              </div>
            ))}
          </div>
        ) : null}

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
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 12 }}>Paid From</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 12 }}>Direct Owner</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 12 }}>Split Between</th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: 12 }}>VAT %</th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: 12 }}>Excl. VAT</th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: 12 }}>VAT</th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #e5e7eb", padding: 12 }}>Incl. VAT</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 12 }}>Dashboard</th>
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
                  const account = resolveBankAccount(expense.bank_account);
                  const paidBy = resolveOwner(expense.paid_by_owner);
                  const splitBetween = resolveOwnerSplit(expense.split_owners, paidBy);

                  return (
                    <tr key={expense.id}>
                      <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12 }}>{expense.expense_date}</td>
                      <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12 }}>{expense.supplier || "-"}</td>
                      <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12 }}>{expense.description}</td>
                      <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12 }}>{expense.category}</td>
                      <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12 }}>
                        {account}
                      </td>
                      <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12 }}>
                        {isOwner(account) ? paidBy : "-"}
                      </td>
                      <td style={{ borderBottom: "1px solid #f1f5f9", padding: 12 }}>
                        {isOwner(account) ? splitBetween.join(", ") : "-"}
                      </td>
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
                          onClick={() => toggleDashboardVisibility(expense)}
                          style={{
                            padding: "8px 12px",
                            background: expense.hidden_from_dashboard ? "#fff7ed" : "#ecfdf5",
                            color: expense.hidden_from_dashboard ? "#9a3412" : "#065f46",
                            border: expense.hidden_from_dashboard ? "1px solid #fdba74" : "1px solid #a7f3d0",
                          }}
                        >
                          {expense.hidden_from_dashboard ? "Hidden" : "Included"}
                        </button>
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
    </AppPage>
  );
}
