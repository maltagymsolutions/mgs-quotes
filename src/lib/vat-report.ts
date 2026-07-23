import {
  type IncomeExpenseReport,
  type ReportExpenseRow,
  type ReportIncomeRow,
  type ReportPeriod,
} from "@/src/lib/financial-report";

export type VatRateBreakdownRow = {
  vatRate: number;
  count: number;
  taxableAmount: number;
  vatAmount: number;
  amountInclVat: number;
};

export type VatReport = {
  generatedAt: string;
  period: ReportPeriod;
  summary: {
    taxableSales: number;
    outputVat: number;
    salesInclVat: number;
    taxablePurchases: number;
    recoverableInputVat: number;
    purchasesInclVat: number;
    vatPayments: number;
    vatDueBeforePayments: number;
    vatPosition: number;
    dashboardHiddenExpenseCount: number;
  };
  salesByVatRate: VatRateBreakdownRow[];
  purchasesByVatRate: VatRateBreakdownRow[];
  salesRows: ReportIncomeRow[];
  purchaseRows: ReportExpenseRow[];
  paymentRows: ReportExpenseRow[];
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function buildRateBreakdown<T extends { vatRate: number; amountExclVat: number; vatAmount: number; amountInclVat: number }>(
  rows: T[]
) {
  const totals = new Map<number, VatRateBreakdownRow>();

  rows.forEach((row) => {
    const rate = Number(row.vatRate || 0);
    const current = totals.get(rate) || {
      vatRate: rate,
      count: 0,
      taxableAmount: 0,
      vatAmount: 0,
      amountInclVat: 0,
    };

    current.count += 1;
    current.taxableAmount = round2(current.taxableAmount + row.amountExclVat);
    current.vatAmount = round2(current.vatAmount + row.vatAmount);
    current.amountInclVat = round2(current.amountInclVat + row.amountInclVat);
    totals.set(rate, current);
  });

  return Array.from(totals.values()).sort((a, b) => b.vatRate - a.vatRate);
}

export function buildVatReport(report: IncomeExpenseReport): VatReport {
  const vatExpenseRows = [
    ...report.expenseRows,
    ...report.excludedExpenseRows,
  ].sort(
    (a, b) => b.date.localeCompare(a.date) || a.supplier.localeCompare(b.supplier)
  );
  const purchaseRows = vatExpenseRows.filter((row) => row.category !== "VAT");
  const paymentRows = vatExpenseRows.filter((row) => row.category === "VAT");
  const taxablePurchases = round2(
    purchaseRows.reduce((sum, row) => sum + row.amountExclVat, 0)
  );
  const recoverableInputVat = round2(
    purchaseRows.reduce((sum, row) => sum + row.vatAmount, 0)
  );
  const purchasesInclVat = round2(
    purchaseRows.reduce((sum, row) => sum + row.amountInclVat, 0)
  );
  const vatPayments = round2(
    paymentRows.reduce((sum, row) => sum + row.amountInclVat, 0)
  );
  const vatDueBeforePayments = round2(
    report.summary.incomeVat - recoverableInputVat
  );

  return {
    generatedAt: report.generatedAt,
    period: report.period,
    summary: {
      taxableSales: report.summary.incomeExclVat,
      outputVat: report.summary.incomeVat,
      salesInclVat: report.summary.incomeInclVat,
      taxablePurchases,
      recoverableInputVat,
      purchasesInclVat,
      vatPayments,
      vatDueBeforePayments,
      vatPosition: round2(vatDueBeforePayments - vatPayments),
      dashboardHiddenExpenseCount: report.excludedExpenseRows.length,
    },
    salesByVatRate: buildRateBreakdown(report.incomeRows),
    purchasesByVatRate: buildRateBreakdown(purchaseRows),
    salesRows: report.incomeRows,
    purchaseRows,
    paymentRows,
  };
}
