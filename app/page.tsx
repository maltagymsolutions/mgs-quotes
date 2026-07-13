"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CalendarDays,
  CreditCard,
  Download,
  FileText,
  Filter,
  Landmark,
  Package,
  ReceiptText,
  RefreshCw,
  Ship,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { buildCsv, downloadCsv } from "@/src/lib/csv";
import { calculateItemsTotals } from "@/src/lib/item-discounts";
import {
  BankAccount,
  isOwner,
  Owner,
  OWNERS,
  resolveBankAccount,
  resolveOwner,
  resolveOwnerSplit,
} from "@/src/lib/owners";
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
  bank_account?: BankAccount | null;
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
  bank_account?: BankAccount | null;
  received_by_owner: Owner | null;
};

type AccountTransfer = {
  id: string;
  created_at: string;
  transfer_date: string;
  from_account: string;
  to_account: string;
  amount: number;
  description: string | null;
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

type OwnerCashTotals = {
  customerReceived: number;
  supplierPaid: number;
  splitReceived: number;
  splitPaid: number;
  transferReceived: number;
  transferPaid: number;
};

const EXPENSES_SETUP_MESSAGE =
  "Expenses table is not set up yet. Run supabase/migrations/001_create_expenses.sql, 004_add_bank_accounts_to_money_records.sql, 005_adapt_money_records_to_owners.sql, and 006_add_vat_expense_category.sql in Supabase, then refresh this page.";
const RECEIPTS_SETUP_MESSAGE =
  "Payment receipts table is not set up yet. Run supabase/migrations/003_create_payment_receipts.sql, 004_add_bank_accounts_to_money_records.sql, and 005_adapt_money_records_to_owners.sql in Supabase, then refresh this page.";
const TRANSFERS_SETUP_MESSAGE =
  "Account transfers are not set up yet. Run supabase/migrations/017_create_account_transfers.sql in Supabase, then refresh this page.";

const cards = [
  {
    title: "Clients",
    href: "/clients",
    description: "Manage contacts and billing details",
    icon: Users,
  },
  {
    title: "Inventory",
    href: "/inventory",
    description: "Track stock, pricing, and categories",
    icon: Boxes,
  },
  {
    title: "Quotes",
    href: "/quotes",
    description: "Create and revise customer quotes",
    icon: FileText,
  },
  {
    title: "Invoices",
    href: "/invoices",
    description: "Issue invoices and track statuses",
    icon: ReceiptText,
  },
  {
    title: "Payment Receipts",
    href: "/receipts",
    description: "Record deposits and payments",
    icon: CreditCard,
  },
  {
    title: "APS Account",
    href: "/aps",
    description: "Review APS balance and transactions",
    icon: Landmark,
  },
  {
    title: "Expenses",
    href: "/expenses",
    description: "Capture supplier and VAT costs",
    icon: TrendingDown,
  },
  {
    title: "Shipments",
    href: "/shipments",
    description: "Monitor shipment profitability",
    icon: Ship,
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

function emptyOwnerCashTotals(): OwnerCashTotals {
  return {
    customerReceived: 0,
    supplierPaid: 0,
    splitReceived: 0,
    splitPaid: 0,
    transferReceived: 0,
    transferPaid: 0,
  };
}

export default function HomePage() {
  const supabase = useMemo(() => createClient(), []);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [paymentReceipts, setPaymentReceipts] = useState<PaymentReceipt[]>([]);
  const [accountTransfers, setAccountTransfers] = useState<AccountTransfer[]>([]);
  const [dashboardMessage, setDashboardMessage] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadDashboard = useCallback(async function loadDashboard() {
    setIsLoadingDashboard(true);

    try {
      const [clientsResult, invoicesResult, invoiceItemsResult, expensesResult, receiptsResult, transfersResult] = await Promise.all([
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
        supabase
          .from("account_transfers")
          .select("*")
          .order("transfer_date", { ascending: false })
          .order("created_at", { ascending: false }),
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
      if (transfersResult.error) {
        setAccountTransfers([]);
        setDashboardMessage(TRANSFERS_SETUP_MESSAGE);
      } else {
        setAccountTransfers((transfersResult.data || []) as AccountTransfer[]);
        setDashboardMessage("");
      }
      setLastUpdated(new Date().toLocaleString("en-MT", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }));
    } finally {
      setIsLoadingDashboard(false);
    }
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
    const ownerTotals = new Map<Owner, OwnerCashTotals>();

    OWNERS.forEach((owner) => {
      ownerTotals.set(owner, emptyOwnerCashTotals());
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
      const bankAccount = resolveBankAccount(receipt.bank_account);
      if (!isOwner(bankAccount)) return;

      const owner = resolveOwner(receipt.received_by_owner || bankAccount);
      const invoice = invoiceById.get(receipt.invoice_id);
      const client = invoice?.client_id ? clientById.get(invoice.client_id) : null;
      const clientName = client?.company_name || client?.private_name || "Customer";
      const totals =
        ownerTotals.get(owner) || emptyOwnerCashTotals();

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
      const bankAccount = resolveBankAccount(expense.bank_account);
      if (!isOwner(bankAccount)) {
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

        return;
      }

      const paidBy = resolveOwner(expense.paid_by_owner || bankAccount);
      const splitBetween = Array.from(new Set([paidBy, ...resolveOwnerSplit(expense.split_owners, paidBy)]));
      const paidTotals =
        ownerTotals.get(paidBy) || emptyOwnerCashTotals();
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
          ownerTotals.get(owner) || emptyOwnerCashTotals();
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

    accountTransfers
      .filter((transfer) => isDateInRange(transfer.transfer_date, dateFrom, dateTo))
      .forEach((transfer) => {
        const fromAccount = resolveBankAccount(transfer.from_account);
        const toAccount = resolveBankAccount(transfer.to_account);
        const amount = Number(transfer.amount || 0);

        if (fromAccount === "APS" && isOwner(toAccount)) {
          const totals = ownerTotals.get(toAccount) || emptyOwnerCashTotals();

          totals.transferReceived = round2(totals.transferReceived + amount);
          ownerTotals.set(toAccount, totals);
          ownerTransactionRows.push({
            date: transfer.transfer_date,
            createdAt: transfer.created_at,
            owner: toAccount,
            type: "APS transfer received",
            counterparty: "APS",
            reference: transfer.id,
            description: transfer.description || "Transfer from APS",
            category: "Transfer",
            amount,
          });
        }

        if (toAccount === "APS" && isOwner(fromAccount)) {
          const totals = ownerTotals.get(fromAccount) || emptyOwnerCashTotals();

          totals.transferPaid = round2(totals.transferPaid + amount);
          ownerTotals.set(fromAccount, totals);
          ownerTransactionRows.push({
            date: transfer.transfer_date,
            createdAt: transfer.created_at,
            owner: fromAccount,
            type: "APS transfer paid",
            counterparty: "APS",
            reference: transfer.id,
            description: transfer.description || "Transfer to APS",
            category: "Transfer",
            amount: -amount,
          });
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
        const totals = ownerTotals.get(owner) || emptyOwnerCashTotals();
        const totalReceived = round2(totals.customerReceived + totals.splitReceived + totals.transferReceived);
        const totalPaid = round2(totals.supplierPaid + totals.splitPaid + totals.transferPaid);

        return {
          owner,
          customerReceived: totals.customerReceived,
          supplierPaid: totals.supplierPaid,
          splitReceived: totals.splitReceived,
          splitPaid: totals.splitPaid,
          transferReceived: totals.transferReceived,
          transferPaid: totals.transferPaid,
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
  }, [accountTransfers, clients, dateFrom, dateTo, expenses, invoiceItems, invoices, paymentReceipts]);

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

  const activeRangeLabel = dateFrom || dateTo
    ? `${dateFrom || "Start"} to ${dateTo || "Today"}`
    : "All time";
  const latestOwnerTransactions = dashboard.ownerTransactions.slice().reverse().slice(0, 8);
  const summaryCards = [
    {
      label: "Income excl. VAT",
      amount: dashboard.totalIncomeExclVat,
      icon: TrendingUp,
      tone: "green" as const,
      caption: "Invoice value before VAT",
    },
    {
      label: "Expenses excl. VAT",
      amount: dashboard.totalExpensesExclVat,
      icon: TrendingDown,
      tone: "red" as const,
      caption: "Supplier costs before VAT",
    },
    {
      label: "Operating costs",
      amount: dashboard.operatingCostsExclVat,
      icon: Package,
      tone: "amber" as const,
      caption: "Excluding equipment, shipping, and tax",
    },
    {
      label: "Net excl. VAT",
      amount: dashboard.netTotal,
      icon: BarChart3,
      tone: dashboard.netTotal < 0 ? "red" as const : "green" as const,
      caption: "Income minus expenses",
    },
    {
      label: "VAT balance",
      amount: dashboard.vatBalance,
      icon: Landmark,
      tone: dashboard.vatBalance < 0 ? "green" as const : "blue" as const,
      caption: "Output VAT less input VAT and payments",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 font-sans text-slate-950 sm:px-6 lg:px-8">
      <div className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-6 border-b border-slate-200 bg-slate-950 px-5 py-5 text-white sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/mgs-logo.svg"
              alt="Malta Gym Solutions"
              width={118}
              height={63}
              priority
              className="block h-auto w-[108px] rounded bg-white px-2 py-1"
            />
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-300">Admin Dashboard</p>
              <h1 className="m-0 text-2xl font-bold tracking-normal !text-white sm:text-3xl">MGS Workspace</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Finance, sales, inventory, receipts, and owner cash movement in one operational view.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Link
              href="/invoices"
              className="inline-flex min-h-10 items-center gap-2 rounded-md bg-white px-3 text-sm font-bold !text-slate-950 shadow-sm transition hover:bg-slate-100"
            >
              <ReceiptText size={16} aria-hidden="true" />
              New invoice
            </Link>
            <Link
              href="/quotes"
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/20 px-3 text-sm font-bold !text-white transition hover:bg-white/10"
            >
              <FileText size={16} aria-hidden="true" />
              New quote
            </Link>
            <button
              onClick={loadDashboard}
              disabled={isLoadingDashboard}
              className="inline-flex min-h-10 items-center gap-2 !rounded-md !border-white/20 !bg-transparent px-3 text-sm font-bold !text-white transition hover:!bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={16} className={isLoadingDashboard ? "animate-spin" : ""} aria-hidden="true" />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardFact label="Active range" value={activeRangeLabel} icon={CalendarDays} />
          <DashboardFact label="Invoices" value={String(invoices.length)} icon={ReceiptText} />
          <DashboardFact label="Receipts" value={String(paymentReceipts.length)} icon={CreditCard} />
          <DashboardFact label="Last update" value={lastUpdated || "Loading"} icon={RefreshCw} />
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="m-0 text-lg font-bold text-slate-950">Workspace Tools</h2>
            <p className="mt-1 text-sm text-slate-500">Fast access to the pages used most often while handling quotes and cash flow.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="group flex min-h-28 items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 text-slate-950 no-underline shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              >
                <span className="flex min-w-0 gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                    <card.icon size={20} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{card.title}</span>
                    <span className="mt-1 block text-sm font-normal leading-5 text-slate-500">{card.description}</span>
                  </span>
                </span>
                <ArrowRight className="mt-1 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-700" size={18} aria-hidden="true" />
              </Link>
            ))}
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="m-0 text-lg font-bold text-slate-950">Income and Expenses</h2>
            <p className="mt-1 text-sm text-slate-500">
              VAT-exclusive net with VAT payments deducted from the VAT balance.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
            <div>
              <label htmlFor="dashboard-date-from" className="mb-1 block text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                From
              </label>
              <input
                id="dashboard-date-from"
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) => setDateFrom(event.target.value)}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
              />
            </div>
            <div>
              <label htmlFor="dashboard-date-to" className="mb-1 block text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                To
              </label>
              <input
                id="dashboard-date-to"
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) => setDateTo(event.target.value)}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
              />
            </div>
            <button onClick={showThisMonth} className="inline-flex h-10 items-center gap-2 !rounded-md !border-slate-900 !bg-slate-900 px-3 text-sm font-bold !text-white">
              <Filter size={15} aria-hidden="true" />
              Month
            </button>
            <button onClick={showThisYear} className="inline-flex h-10 items-center gap-2 !rounded-md !border-slate-300 !bg-white px-3 text-sm font-bold !text-slate-900">
              Year
            </button>
            <button onClick={showAllDates} className="inline-flex h-10 items-center gap-2 !rounded-md !border-slate-300 !bg-white px-3 text-sm font-bold !text-slate-900">
              All time
            </button>
          </div>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {summaryCards.map((card) => (
            <MetricCard key={card.label} {...card} />
          ))}
        </div>

        <div className="mb-5 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="m-0 text-base font-bold text-slate-950">Owner Cash Balances</h3>
              <button
                onClick={exportOwnerTransactionsCsv}
                className="inline-flex h-10 items-center gap-2 !rounded-md !border-slate-300 !bg-white px-3 text-sm font-bold !text-slate-950"
              >
                <Download size={16} aria-hidden="true" />
                Export CSV
              </button>
            </div>

            <div className="max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[1040px] border-collapse">
                <thead>
                  <tr>
                    {[
                      "Owner",
                      "Balance",
                      "Customer received",
                      "Supplier paid",
                      "Split received",
                      "Split paid",
                      "APS received",
                      "APS paid",
                    ].map(
                      (heading) => (
                        <th
                          key={heading}
                          className={`border-b border-slate-200 bg-slate-50 px-3 py-3 text-xs font-bold uppercase tracking-[0.08em] text-slate-500 ${
                            heading === "Owner" ? "text-left" : "text-right"
                          }`}
                        >
                          {heading}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {dashboard.ownerBalances.map((row) => (
                    <tr key={row.owner} className="hover:bg-slate-50">
                      <td className="border-b border-slate-100 px-3 py-3 font-bold text-slate-950">
                        <span className="inline-flex items-center gap-2">
                          <WalletCards size={16} className="text-slate-400" aria-hidden="true" />
                          {row.owner}
                        </span>
                      </td>
                      <td className={`border-b border-slate-100 px-3 py-3 text-right font-extrabold ${row.balance < 0 ? "text-red-700" : "text-slate-950"}`}>
                        {money(row.balance)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-right tabular-nums text-slate-700">
                        {money(row.customerReceived)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-right tabular-nums text-slate-700">
                        {money(row.supplierPaid)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-right tabular-nums text-slate-700">
                        {money(row.splitReceived)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-right tabular-nums text-slate-700">
                        {money(row.splitPaid)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-right tabular-nums text-slate-700">
                        {money(row.transferReceived)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-right tabular-nums text-slate-700">
                        {money(row.transferPaid)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <RecentActivity rows={latestOwnerTransactions} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <BreakdownPanel title="Income by Status" rows={dashboard.statusBreakdown} />
          <BreakdownPanel title="Expenses by Category" rows={dashboard.categoryBreakdown} />

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-base font-bold text-slate-950">Monthly Breakdown</h3>
            {dashboard.monthlyBreakdown.length === 0 ? (
              <p className="m-0 text-sm text-slate-500">No invoice or expense data yet.</p>
            ) : (
              <div className="grid gap-3">
                {dashboard.monthlyBreakdown.map((row) => {
                  const maxAmount = Math.max(row.income, row.expenses, 1);
                  const incomeWidth = `${Math.max((row.income / maxAmount) * 100, row.income > 0 ? 8 : 0)}%`;
                  const expenseWidth = `${Math.max((row.expenses / maxAmount) * 100, row.expenses > 0 ? 8 : 0)}%`;

                  return (
                    <div key={row.month} className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <strong className="text-sm text-slate-950">{row.month}</strong>
                        <span className="text-xs font-semibold text-slate-500">
                          Net {money(row.income - row.expenses)}
                        </span>
                      </div>
                      <div className="grid gap-2">
                        <BarRow label="Income" value={money(row.income)} width={incomeWidth} colorClass="bg-emerald-600" />
                        <BarRow label="Expenses" value={money(row.expenses)} width={expenseWidth} colorClass="bg-red-600" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {dashboardMessage ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
            {dashboardMessage}
          </div>
        ) : null}
      </div>
    </main>
  );
}

function DashboardFact({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="flex min-h-20 items-center gap-3 bg-white px-5 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{label}</span>
        <span className="mt-1 block truncate text-sm font-bold text-slate-950">{value}</span>
      </span>
    </div>
  );
}

function MetricCard({
  label,
  amount,
  icon: Icon,
  tone,
  caption,
}: {
  label: string;
  amount: number;
  icon: LucideIcon;
  tone: "green" | "red" | "amber" | "blue";
  caption: string;
}) {
  const toneClasses = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
    red: "bg-red-50 text-red-700 border-red-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    blue: "bg-sky-50 text-sky-700 border-sky-100",
  }[tone];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-600">{label}</div>
          <p className="mt-1 min-h-10 text-xs leading-5 text-slate-500">{caption}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ${toneClasses}`}>
          <Icon size={19} aria-hidden="true" />
        </span>
      </div>
      <strong className={`block text-2xl font-extrabold tabular-nums ${amount < 0 ? "text-red-700" : "text-slate-950"}`}>
        {money(amount)}
      </strong>
    </div>
  );
}

function RecentActivity({ rows }: { rows: OwnerTransaction[] }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="m-0 text-base font-bold text-slate-950">Recent Owner Activity</h3>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
          Latest 8
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="m-0 text-sm text-slate-500">No owner transactions in this range.</p>
      ) : (
        <div className="grid gap-2">
          {rows.map((row) => (
            <div key={`${row.owner}-${row.createdAt}-${row.type}-${row.amount}`} className="rounded-md border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-slate-950">{row.counterparty}</div>
                  <div className="mt-1 text-xs text-slate-500">{row.date} - {row.owner}</div>
                </div>
                <strong className={`shrink-0 text-sm tabular-nums ${row.amount < 0 ? "text-red-700" : "text-emerald-700"}`}>
                  {money(row.amount)}
                </strong>
              </div>
              <div className="truncate text-xs text-slate-500">{row.type} - {row.category}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BarRow({ label, value, width, colorClass }: { label: string; value: string; width: string; colorClass: string }) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)_88px] items-center gap-2 text-xs">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-slate-100">
        <span className={`block h-full rounded-full ${colorClass}`} style={{ width }} />
      </span>
      <span className="text-right font-bold tabular-nums text-slate-700">{value}</span>
    </div>
  );
}

function BreakdownPanel({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="m-0 text-base font-bold text-slate-950">{title}</h3>
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400">{money(total)}</span>
      </div>
      {rows.length === 0 ? (
        <p className="m-0 text-sm text-slate-500">No data yet.</p>
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => {
            const width = total > 0 ? `${Math.max((row.amount / total) * 100, 6)}%` : "0%";

            return (
              <div key={row.label}>
                <div className="mb-1.5 flex justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-semibold text-slate-700">{row.label}</span>
                  <strong className="shrink-0 tabular-nums text-slate-950">{money(row.amount)}</strong>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-900" style={{ width }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
