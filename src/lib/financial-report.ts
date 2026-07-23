import { calculateItemsTotals } from "@/src/lib/item-discounts";
import { resolveBankAccount } from "@/src/lib/owners";

export type ReportPeriod = {
  from: string;
  to: string;
};

export type ReportBreakdownRow = {
  label: string;
  count: number;
  amountExclVat: number;
  vatAmount: number;
  amountInclVat: number;
};

export type ReportIncomeRow = {
  id: string;
  date: string;
  invoiceNumber: string;
  client: string;
  status: string;
  vatRate: number;
  amountExclVat: number;
  vatAmount: number;
  amountInclVat: number;
};

export type ReportExpenseRow = {
  id: string;
  date: string;
  supplier: string;
  description: string;
  category: string;
  paidFrom: string;
  vatRate: number;
  amountExclVat: number;
  vatAmount: number;
  amountInclVat: number;
};

export type MonthlyReportRow = {
  month: string;
  incomeExclVat: number;
  expensesExclVat: number;
  netExclVat: number;
};

export type IncomeExpenseReport = {
  generatedAt: string;
  period: ReportPeriod;
  summary: {
    incomeExclVat: number;
    incomeVat: number;
    incomeInclVat: number;
    expensesExclVat: number;
    recoverableVat: number;
    expensesInclVat: number;
    vatPayments: number;
    netExclVat: number;
    excludedExpenseCount: number;
    excludedExpenseAmount: number;
  };
  incomeByStatus: ReportBreakdownRow[];
  expensesByCategory: ReportBreakdownRow[];
  expensesBySupplier: ReportBreakdownRow[];
  monthly: MonthlyReportRow[];
  incomeRows: ReportIncomeRow[];
  expenseRows: ReportExpenseRow[];
  excludedExpenseRows: ReportExpenseRow[];
};

export type FinancialReportSource = {
  invoices: {
    id: string;
    invoice_number: string;
    client_id: string | null;
    date_issued: string;
    status: string;
    vat_rate: number | string;
    discount_amount_incl_vat: number | string | null;
  }[];
  invoiceItems: {
    invoice_id: string;
    qty: number | string;
    sale_price_incl_vat: number | string;
    item_discount_percent?: number | string | null;
  }[];
  clients: {
    id: string;
    private_name: string | null;
    company_name: string | null;
  }[];
  expenses: {
    id: string;
    expense_date: string;
    supplier: string | null;
    description: string;
    category: string;
    vat_rate: number | string;
    amount_incl_vat: number | string;
    bank_account?: string | null;
    hidden_from_dashboard?: boolean | null;
  }[];
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculateInclusiveAmounts(amountInclVat: number, vatRate: number) {
  const amountExclVat = round2(amountInclVat / (1 + vatRate / 100));
  return {
    amountExclVat,
    vatAmount: round2(amountInclVat - amountExclVat),
  };
}

function addBreakdownValue(
  map: Map<string, ReportBreakdownRow>,
  label: string,
  amountExclVat: number,
  vatAmount: number,
  amountInclVat: number
) {
  const current = map.get(label) || {
    label,
    count: 0,
    amountExclVat: 0,
    vatAmount: 0,
    amountInclVat: 0,
  };

  current.count += 1;
  current.amountExclVat = round2(current.amountExclVat + amountExclVat);
  current.vatAmount = round2(current.vatAmount + vatAmount);
  current.amountInclVat = round2(current.amountInclVat + amountInclVat);
  map.set(label, current);
}

function sortBreakdown(rows: ReportBreakdownRow[]) {
  return rows.sort(
    (a, b) => b.amountInclVat - a.amountInclVat || a.label.localeCompare(b.label)
  );
}

function buildExpenseRow(
  expense: FinancialReportSource["expenses"][number]
): ReportExpenseRow {
  const amountInclVat = Number(expense.amount_incl_vat || 0);
  const vatRate = Number(expense.vat_rate || 0);
  const isVatPayment = expense.category === "VAT";
  const calculated = isVatPayment
    ? { amountExclVat: 0, vatAmount: 0 }
    : calculateInclusiveAmounts(amountInclVat, vatRate);

  return {
    id: expense.id,
    date: expense.expense_date,
    supplier: expense.supplier || "No supplier",
    description: expense.description,
    category: expense.category,
    paidFrom: resolveBankAccount(expense.bank_account),
    vatRate,
    amountExclVat: calculated.amountExclVat,
    vatAmount: calculated.vatAmount,
    amountInclVat: round2(amountInclVat),
  };
}

export function buildIncomeExpenseReport(
  source: FinancialReportSource,
  period: ReportPeriod
): IncomeExpenseReport {
  const itemsByInvoice = new Map<string, FinancialReportSource["invoiceItems"]>();
  const clientById = new Map(source.clients.map((client) => [client.id, client]));

  source.invoiceItems.forEach((item) => {
    const rows = itemsByInvoice.get(item.invoice_id) || [];
    rows.push(item);
    itemsByInvoice.set(item.invoice_id, rows);
  });

  const incomeByStatus = new Map<string, ReportBreakdownRow>();
  const expenseByCategory = new Map<string, ReportBreakdownRow>();
  const expenseBySupplier = new Map<string, ReportBreakdownRow>();
  const monthlyIncome = new Map<string, number>();
  const monthlyExpenses = new Map<string, number>();

  const incomeRows = source.invoices
    .filter((invoice) => invoice.status !== "Archived")
    .map((invoice): ReportIncomeRow => {
      const itemTotal = calculateItemsTotals(itemsByInvoice.get(invoice.id) || [])
        .totalAfterItemDiscounts;
      const discount = Math.min(
        Number(invoice.discount_amount_incl_vat || 0),
        itemTotal
      );
      const amountInclVat = round2(itemTotal - discount);
      const calculated = calculateInclusiveAmounts(
        amountInclVat,
        Number(invoice.vat_rate || 0)
      );
      const client = invoice.client_id ? clientById.get(invoice.client_id) : null;

      addBreakdownValue(
        incomeByStatus,
        invoice.status,
        calculated.amountExclVat,
        calculated.vatAmount,
        amountInclVat
      );

      const month = invoice.date_issued.slice(0, 7);
      monthlyIncome.set(
        month,
        round2((monthlyIncome.get(month) || 0) + calculated.amountExclVat)
      );

      return {
        id: invoice.id,
        date: invoice.date_issued,
        invoiceNumber: invoice.invoice_number,
        client: client?.company_name || client?.private_name || "Client",
        status: invoice.status,
        vatRate: Number(invoice.vat_rate || 0),
        amountExclVat: calculated.amountExclVat,
        vatAmount: calculated.vatAmount,
        amountInclVat,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.invoiceNumber.localeCompare(b.invoiceNumber));

  const includedExpenseRows: ReportExpenseRow[] = [];
  const excludedExpenseRows: ReportExpenseRow[] = [];
  let vatPayments = 0;

  source.expenses.forEach((expense) => {
    const row = buildExpenseRow(expense);

    if (expense.hidden_from_dashboard) {
      excludedExpenseRows.push(row);
      return;
    }

    includedExpenseRows.push(row);
    if (expense.category === "VAT") {
      vatPayments = round2(vatPayments + row.amountInclVat);
    }

    addBreakdownValue(
      expenseByCategory,
      row.category,
      row.amountExclVat,
      row.vatAmount,
      row.amountInclVat
    );
    addBreakdownValue(
      expenseBySupplier,
      row.supplier,
      row.amountExclVat,
      row.vatAmount,
      row.amountInclVat
    );

    const month = row.date.slice(0, 7);
    monthlyExpenses.set(
      month,
      round2((monthlyExpenses.get(month) || 0) + row.amountExclVat)
    );
  });

  includedExpenseRows.sort(
    (a, b) => b.date.localeCompare(a.date) || a.supplier.localeCompare(b.supplier)
  );
  excludedExpenseRows.sort(
    (a, b) => b.date.localeCompare(a.date) || a.supplier.localeCompare(b.supplier)
  );

  const incomeInclVat = round2(
    incomeRows.reduce((sum, row) => sum + row.amountInclVat, 0)
  );
  const incomeExclVat = round2(
    incomeRows.reduce((sum, row) => sum + row.amountExclVat, 0)
  );
  const incomeVat = round2(incomeRows.reduce((sum, row) => sum + row.vatAmount, 0));
  const expensesInclVat = round2(
    includedExpenseRows.reduce((sum, row) => sum + row.amountInclVat, 0)
  );
  const expensesExclVat = round2(
    includedExpenseRows.reduce((sum, row) => sum + row.amountExclVat, 0)
  );
  const recoverableVat = round2(
    includedExpenseRows.reduce((sum, row) => sum + row.vatAmount, 0)
  );
  const excludedExpenseAmount = round2(
    excludedExpenseRows.reduce((sum, row) => sum + row.amountInclVat, 0)
  );

  const months = Array.from(
    new Set([...monthlyIncome.keys(), ...monthlyExpenses.keys()])
  ).sort();

  return {
    generatedAt: new Date().toISOString(),
    period,
    summary: {
      incomeExclVat,
      incomeVat,
      incomeInclVat,
      expensesExclVat,
      recoverableVat,
      expensesInclVat,
      vatPayments,
      netExclVat: round2(incomeExclVat - expensesExclVat),
      excludedExpenseCount: excludedExpenseRows.length,
      excludedExpenseAmount,
    },
    incomeByStatus: sortBreakdown(Array.from(incomeByStatus.values())),
    expensesByCategory: sortBreakdown(Array.from(expenseByCategory.values())),
    expensesBySupplier: sortBreakdown(Array.from(expenseBySupplier.values())),
    monthly: months.map((month) => {
      const income = monthlyIncome.get(month) || 0;
      const expenses = monthlyExpenses.get(month) || 0;
      return {
        month,
        incomeExclVat: income,
        expensesExclVat: expenses,
        netExclVat: round2(income - expenses),
      };
    }),
    incomeRows,
    expenseRows: includedExpenseRows,
    excludedExpenseRows,
  };
}

export function reportPeriodLabel(period: ReportPeriod) {
  if (period.from && period.to) return `${period.from} to ${period.to}`;
  if (period.from) return `From ${period.from}`;
  if (period.to) return `Up to ${period.to}`;
  return "All time";
}
