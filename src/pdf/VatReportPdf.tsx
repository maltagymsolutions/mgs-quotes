import { Document } from "@react-pdf/renderer";
import { formatDisplayDate } from "@/src/lib/format-date";
import type { VatRateBreakdownRow, VatReport } from "@/src/lib/vat-report";
import { amount, DataTable, DetailPage, Metrics, ReportHeading, ReportNote, ReportPage, ResultPanel, SectionHeading, type Column } from "./FinancialReportLayout";

const rateColumns: Column[] = [
  { label: "VAT rate", width: 18 }, { label: "Records", width: 14, right: true }, { label: "Taxable", width: 24, right: true },
  { label: "VAT", width: 20, right: true }, { label: "Incl. VAT", width: 24, right: true },
];
const salesColumns: Column[] = [
  { label: "Date", width: 13 }, { label: "Invoice", width: 16 }, { label: "Client", width: 29 },
  { label: "Rate", width: 8, right: true }, { label: "Taxable", width: 18, right: true }, { label: "VAT", width: 16, right: true },
];
const purchaseColumns: Column[] = [
  { label: "Date", width: 13 }, { label: "Supplier", width: 25 }, { label: "Category", width: 22 },
  { label: "Rate", width: 8, right: true }, { label: "Taxable", width: 17, right: true }, { label: "VAT", width: 15, right: true },
];

function RateTable({ rows }: { rows: VatRateBreakdownRow[] }) {
  return <DataTable columns={rateColumns} rows={rows.map((row) => ({ key: String(row.vatRate), cells: [`${row.vatRate}%`, row.count, amount(row.taxableAmount), amount(row.vatAmount), amount(row.amountInclVat)] }))} />;
}

export default function VatReportPdf({ report }: { report: VatReport }) {
  const name = "VAT report";
  const { summary } = report;
  const positionLabel = summary.vatPosition > 0 ? "VAT remaining payable" : summary.vatPosition < 0 ? "VAT credit / overpayment" : "VAT position settled";
  return <Document title="MGS VAT Report" author="Malta Gym Solutions" language="en-GB">
    <ReportPage report={report} name={name} bookmark="VAT overview">
      <ReportHeading title="VAT report" subtitle="Sales VAT, purchase VAT and payments, brought together." />
      <Metrics items={[
        { label: "Output VAT", value: summary.outputVat, hint: "VAT on sales" },
        { label: "Input VAT", value: summary.recoverableInputVat, hint: "Recoverable purchase VAT" },
        { label: "VAT payments", value: summary.vatPayments, hint: "Payments recorded in this period" },
      ]} />
      <ResultPanel label={positionLabel} value={summary.vatPosition} note="Output VAT less input VAT and recorded payments." tone={summary.vatPosition > 0 ? "amber" : summary.vatPosition < 0 ? "green" : "neutral"} />
      <ReportNote>Positive = VAT payable. Negative = credit or overpayment. Expenses hidden from dashboard calculations remain included in this VAT report{summary.dashboardHiddenExpenseCount > 0 ? ` (${summary.dashboardHiddenExpenseCount} records)` : ""}.</ReportNote>
      <SectionHeading title="Sales by VAT rate" />
      <RateTable rows={report.salesByVatRate} />
      <SectionHeading title="Purchases by VAT rate" />
      <RateTable rows={report.purchasesByVatRate} />
      <SectionHeading title="VAT reconciliation" />
      <DataTable columns={[{ label: "Calculation", width: 75 }, { label: "EUR", width: 25, right: true }]} rows={[
        { key: "before", cells: ["VAT due before payments", amount(summary.vatDueBeforePayments)] },
        { key: "paid", cells: ["Less: VAT payments", amount(summary.vatPayments)] },
      ]} total={["VAT position", amount(summary.vatPosition)]} />
    </ReportPage>

    {report.salesRows.length > 0 || report.paymentRows.length > 0 ? <DetailPage report={report} name={name} title="Sales VAT detail" note={`${report.salesRows.length} invoices • Most recent first • Amounts in EUR`} columns={salesColumns}
      rows={report.salesRows.map((row) => ({ key: row.id, cells: [formatDisplayDate(row.date), row.invoiceNumber, row.client, `${row.vatRate}%`, amount(row.amountExclVat), amount(row.vatAmount)] }))}
      total={["Total", "", "", "", amount(summary.taxableSales), amount(summary.outputVat)]} emptyLabel="No sales in this period.">
      <SectionHeading title="VAT payments" note="Payments deducted when calculating the VAT position." />
      <DataTable columns={[{ label: "Date", width: 18 }, { label: "Description", width: 57 }, { label: "Amount", width: 25, right: true }]}
        rows={report.paymentRows.map((row) => ({ key: row.id, cells: [formatDisplayDate(row.date), row.description, amount(row.amountInclVat)] }))}
        emptyLabel="No VAT payments recorded in this period." />
    </DetailPage> : null}

    {report.purchaseRows.length > 0 ? <DetailPage report={report} name={name} title="Purchase VAT detail" note={`${report.purchaseRows.length} purchases • Includes expenses hidden from the dashboard • Amounts in EUR`} columns={purchaseColumns}
      rows={report.purchaseRows.map((row) => ({ key: row.id, cells: [formatDisplayDate(row.date), row.supplier, row.category, `${row.vatRate}%`, amount(row.amountExclVat), amount(row.vatAmount)] }))}
      total={["Total", "", "", "", amount(summary.taxablePurchases), amount(summary.recoverableInputVat)]} compact emptyLabel="No purchases in this period." /> : null}
  </Document>;
}
