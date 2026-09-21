import { Document } from "@react-pdf/renderer";
import { formatDisplayDate } from "@/src/lib/format-date";
import type { IncomeExpenseReport, ReportBreakdownRow, ReportExpenseRow } from "@/src/lib/financial-report";
import { amount, money, DataTable, DetailPage, Metrics, ReportHeading, ReportNote, ReportPage, ResultPanel, SectionHeading, type Column, type TableRow } from "./FinancialReportLayout";

const summaryColumns: Column[] = [
  { label: "Name", width: 34 }, { label: "Records", width: 10, right: true },
  { label: "Excl. VAT", width: 20, right: true }, { label: "VAT", width: 16, right: true },
  { label: "Incl. VAT", width: 20, right: true },
];
const incomeColumns: Column[] = [
  { label: "Date", width: 13 }, { label: "Invoice", width: 15 }, { label: "Client", width: 26 },
  { label: "Status", width: 16 }, { label: "Excl. VAT", width: 15, right: true }, { label: "Incl. VAT", width: 15, right: true },
];
const expenseColumns: Column[] = [
  { label: "Date", width: 12 }, { label: "Supplier", width: 18 }, { label: "Description", width: 26 },
  { label: "Category", width: 16 }, { label: "Excl. VAT", width: 14, right: true }, { label: "Incl. VAT", width: 14, right: true },
];

function summaryRows(rows: ReportBreakdownRow[]): TableRow[] {
  return rows.map((row) => ({ key: row.label, cells: [row.label, row.count, amount(row.amountExclVat), amount(row.vatAmount), amount(row.amountInclVat)] }));
}

function expenseRows(rows: ReportExpenseRow[]): TableRow[] {
  return rows.map((row) => ({ key: row.id, cells: [formatDisplayDate(row.date), row.supplier, row.description, row.category, amount(row.amountExclVat), amount(row.amountInclVat)] }));
}

export default function IncomeExpenseReportPdf({ report }: { report: IncomeExpenseReport }) {
  const name = "Income & expense report";
  const { summary } = report;
  const totals = ["Total", report.expenseRows.length, amount(summary.expensesExclVat), amount(summary.recoverableVat), amount(summary.expensesInclVat)];
  return (
    <Document title="MGS Income and Expense Report" author="Malta Gym Solutions" language="en-GB">
      <ReportPage report={report} name={name} bookmark="Financial overview">
        <ReportHeading title="Income & expenses" subtitle="Your financial activity for the selected period, at a glance." />
        <Metrics items={[
          { label: "Income", value: summary.incomeExclVat, hint: "Excluding VAT" },
          { label: "Expenses", value: summary.expensesExclVat, hint: "Excluding VAT" },
          { label: "VAT payments", value: summary.vatPayments, hint: "Recorded separately from net" },
        ]} />
        <ResultPanel label={summary.netExclVat < 0 ? "Net deficit" : summary.netExclVat > 0 ? "Net surplus" : "Net result"} value={summary.netExclVat} note="Income less expenses, excluding VAT." tone={summary.netExclVat < 0 ? "red" : summary.netExclVat > 0 ? "green" : "neutral"} />
        {summary.excludedExpenseCount > 0 ? <ReportNote>{summary.excludedExpenseCount} excluded expense{summary.excludedExpenseCount === 1 ? "" : "s"}, totalling {money(summary.excludedExpenseAmount)} including VAT. See the appendix after the supplier breakdown.</ReportNote> : null}
        <SectionHeading title="Expenses by category" />
        <DataTable columns={summaryColumns} rows={summaryRows(report.expensesByCategory)} compact />
        <SectionHeading title="Income by invoice status" note="Invoice values grouped by status; these are not cash receipts." />
        <DataTable columns={summaryColumns} rows={summaryRows(report.incomeByStatus)} compact />
      </ReportPage>

      {report.incomeRows.length > 0 ? <DetailPage report={report} name={name} title="Income detail" note={`${report.incomeRows.length} invoices • Most recent first • Amounts in EUR`} columns={incomeColumns}
        rows={report.incomeRows.map((row) => ({ key: row.id, cells: [formatDisplayDate(row.date), row.invoiceNumber, row.client, { text: row.status, tone: row.status === "Fully Paid" ? "green" : row.status === "Deposit Paid" ? "amber" : "neutral" }, amount(row.amountExclVat), amount(row.amountInclVat)] }))}
        total={["Total", "", "", "", amount(summary.incomeExclVat), amount(summary.incomeInclVat)]} emptyLabel="No income records in this period."
      /> : null}

      {report.expensesBySupplier.length > 0 || report.excludedExpenseRows.length > 0 ? <DetailPage report={report} name={name} title="Expenses by supplier" note={`${report.expensesBySupplier.length} suppliers • Included expenses • Amounts in EUR`} columns={summaryColumns} rows={summaryRows(report.expensesBySupplier)} total={totals}>
        <ReportNote>VAT payments appear in the inclusive totals. They are recorded separately from expenses excluding VAT and do not reduce the net result.</ReportNote>
        {report.excludedExpenseRows.length > 0 ? <>
          <SectionHeading title="Appendix: excluded expenses" note="These records are excluded from this report's calculations and remain included in the VAT report." />
          <DataTable columns={expenseColumns} rows={expenseRows(report.excludedExpenseRows)} compact />
        </> : null}
      </DetailPage> : null}

      {report.expenseRows.length > 0 ? <DetailPage report={report} name={name} title="Expense detail" note={`${report.expenseRows.length} included records • Most recent first • Amounts in EUR`} columns={expenseColumns} rows={expenseRows(report.expenseRows)} compact
        total={["Total", "", "", "", amount(summary.expensesExclVat), amount(summary.expensesInclVat)]} emptyLabel="No expense records in this period." /> : null}
    </Document>
  );
}
