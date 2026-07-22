import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { formatDisplayDate } from "@/src/lib/format-date";
import {
  reportPeriodLabel,
  type IncomeExpenseReport,
  type ReportBreakdownRow,
  type ReportExpenseRow,
  type ReportIncomeRow,
} from "@/src/lib/financial-report";

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingHorizontal: 32,
    paddingBottom: 42,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: "#0f172a",
  },
  header: { marginBottom: 16, borderBottomWidth: 2, borderBottomColor: "#0f172a", paddingBottom: 10 },
  eyebrow: { fontSize: 8, color: "#64748b", letterSpacing: 0.8, marginBottom: 4 },
  title: { fontSize: 21, fontWeight: 700, marginBottom: 5 },
  subtitle: { fontSize: 9, color: "#475569" },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginBottom: 7 },
  metrics: { flexDirection: "row", gap: 7 },
  metric: { flex: 1, borderWidth: 1, borderColor: "#cbd5e1", padding: 8, minHeight: 48 },
  metricLabel: { fontSize: 7, color: "#64748b", marginBottom: 6 },
  metricValue: { fontSize: 13, fontWeight: 700 },
  note: { marginTop: 8, padding: 7, backgroundColor: "#fff7ed", color: "#9a3412", lineHeight: 1.35 },
  table: { borderWidth: 1, borderColor: "#cbd5e1" },
  row: { flexDirection: "row", minHeight: 23 },
  headerRow: { backgroundColor: "#0f172a", color: "#ffffff" },
  cell: { paddingVertical: 5, paddingHorizontal: 5, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  headerCell: { fontWeight: 700, borderBottomWidth: 0 },
  right: { textAlign: "right" },
  muted: { color: "#64748b" },
  pageNumber: { position: "absolute", bottom: 18, left: 32, right: 32, textAlign: "right", color: "#94a3b8" },
  empty: { padding: 10, color: "#64748b" },
});

function money(value: number) {
  return `EUR ${Number(value || 0).toFixed(2)}`;
}

function SummaryTable({ rows }: { rows: ReportBreakdownRow[] }) {
  return (
    <View style={styles.table}>
      <View style={[styles.row, styles.headerRow]}>
        <Text style={[styles.cell, styles.headerCell, { width: "34%" }]}>Name</Text>
        <Text style={[styles.cell, styles.headerCell, styles.right, { width: "10%" }]}>Records</Text>
        <Text style={[styles.cell, styles.headerCell, styles.right, { width: "19%" }]}>Excl. VAT</Text>
        <Text style={[styles.cell, styles.headerCell, styles.right, { width: "18%" }]}>VAT</Text>
        <Text style={[styles.cell, styles.headerCell, styles.right, { width: "19%" }]}>Incl. VAT</Text>
      </View>
      {rows.length === 0 ? <Text style={styles.empty}>No records in this period.</Text> : null}
      {rows.map((row) => (
        <View key={row.label} style={styles.row} wrap={false}>
          <Text style={[styles.cell, { width: "34%" }]}>{row.label}</Text>
          <Text style={[styles.cell, styles.right, { width: "10%" }]}>{row.count}</Text>
          <Text style={[styles.cell, styles.right, { width: "19%" }]}>{money(row.amountExclVat)}</Text>
          <Text style={[styles.cell, styles.right, { width: "18%" }]}>{money(row.vatAmount)}</Text>
          <Text style={[styles.cell, styles.right, { width: "19%" }]}>{money(row.amountInclVat)}</Text>
        </View>
      ))}
    </View>
  );
}

function IncomeTable({ rows }: { rows: ReportIncomeRow[] }) {
  return (
    <View style={styles.table}>
      <View style={[styles.row, styles.headerRow]}>
        <Text style={[styles.cell, styles.headerCell, { width: "12%" }]}>Date</Text>
        <Text style={[styles.cell, styles.headerCell, { width: "15%" }]}>Invoice</Text>
        <Text style={[styles.cell, styles.headerCell, { width: "25%" }]}>Client</Text>
        <Text style={[styles.cell, styles.headerCell, { width: "14%" }]}>Status</Text>
        <Text style={[styles.cell, styles.headerCell, styles.right, { width: "17%" }]}>Excl. VAT</Text>
        <Text style={[styles.cell, styles.headerCell, styles.right, { width: "17%" }]}>Incl. VAT</Text>
      </View>
      {rows.length === 0 ? <Text style={styles.empty}>No income records in this period.</Text> : null}
      {rows.map((row) => (
        <View key={row.id} style={styles.row} wrap={false}>
          <Text style={[styles.cell, { width: "12%" }]}>{formatDisplayDate(row.date)}</Text>
          <Text style={[styles.cell, { width: "15%" }]}>{row.invoiceNumber}</Text>
          <Text style={[styles.cell, { width: "25%" }]}>{row.client}</Text>
          <Text style={[styles.cell, { width: "14%" }]}>{row.status}</Text>
          <Text style={[styles.cell, styles.right, { width: "17%" }]}>{money(row.amountExclVat)}</Text>
          <Text style={[styles.cell, styles.right, { width: "17%" }]}>{money(row.amountInclVat)}</Text>
        </View>
      ))}
    </View>
  );
}

function ExpenseTable({ rows, emptyLabel }: { rows: ReportExpenseRow[]; emptyLabel: string }) {
  return (
    <View style={styles.table}>
      <View style={[styles.row, styles.headerRow]}>
        <Text style={[styles.cell, styles.headerCell, { width: "11%" }]}>Date</Text>
        <Text style={[styles.cell, styles.headerCell, { width: "18%" }]}>Supplier</Text>
        <Text style={[styles.cell, styles.headerCell, { width: "25%" }]}>Description</Text>
        <Text style={[styles.cell, styles.headerCell, { width: "16%" }]}>Category</Text>
        <Text style={[styles.cell, styles.headerCell, styles.right, { width: "15%" }]}>Excl. VAT</Text>
        <Text style={[styles.cell, styles.headerCell, styles.right, { width: "15%" }]}>Incl. VAT</Text>
      </View>
      {rows.length === 0 ? <Text style={styles.empty}>{emptyLabel}</Text> : null}
      {rows.map((row) => (
        <View key={row.id} style={styles.row} wrap={false}>
          <Text style={[styles.cell, { width: "11%" }]}>{formatDisplayDate(row.date)}</Text>
          <Text style={[styles.cell, { width: "18%" }]}>{row.supplier}</Text>
          <Text style={[styles.cell, { width: "25%" }]}>{row.description}</Text>
          <Text style={[styles.cell, { width: "16%" }]}>{row.category}</Text>
          <Text style={[styles.cell, styles.right, { width: "15%" }]}>{money(row.amountExclVat)}</Text>
          <Text style={[styles.cell, styles.right, { width: "15%" }]}>{money(row.amountInclVat)}</Text>
        </View>
      ))}
    </View>
  );
}

export default function IncomeExpenseReportPdf({ report }: { report: IncomeExpenseReport }) {
  return (
    <Document title="MGS Income and Expense Report" author="Malta Gym Solutions">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>MALTA GYM SOLUTIONS</Text>
          <Text style={styles.title}>Income and Expense Report</Text>
          <Text style={styles.subtitle}>
            {reportPeriodLabel(report.period)} | Generated {new Date(report.generatedAt).toLocaleString("en-GB")}
          </Text>
        </View>

        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>INCOME EXCL. VAT</Text>
            <Text style={styles.metricValue}>{money(report.summary.incomeExclVat)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>EXPENSES EXCL. VAT</Text>
            <Text style={styles.metricValue}>{money(report.summary.expensesExclVat)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>NET EXCL. VAT</Text>
            <Text style={styles.metricValue}>{money(report.summary.netExclVat)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>VAT PAYMENTS</Text>
            <Text style={styles.metricValue}>{money(report.summary.vatPayments)}</Text>
          </View>
        </View>

        {report.summary.excludedExpenseCount > 0 ? (
          <Text style={styles.note}>
            {report.summary.excludedExpenseCount} expense record(s), totalling {money(report.summary.excludedExpenseAmount)}, are excluded from calculations and listed in the appendix.
          </Text>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expenses by Category</Text>
          <SummaryTable rows={report.expensesByCategory} />
        </View>

        <View style={styles.section} break>
          <Text style={styles.sectionTitle}>Expenses by Supplier</Text>
          <SummaryTable rows={report.expensesBySupplier} />
        </View>

        <View style={styles.section} break>
          <Text style={styles.sectionTitle}>Income by Invoice Status</Text>
          <SummaryTable rows={report.incomeByStatus} />
        </View>

        <View style={styles.section} break>
          <Text style={styles.sectionTitle}>Income Detail</Text>
          <IncomeTable rows={report.incomeRows} />
        </View>

        <View style={styles.section} break>
          <Text style={styles.sectionTitle}>Expense Detail</Text>
          <ExpenseTable rows={report.expenseRows} emptyLabel="No expense records in this period." />
        </View>

        {report.excludedExpenseRows.length > 0 ? (
          <View style={styles.section} break>
            <Text style={styles.sectionTitle}>Appendix: Expenses Excluded from Calculations</Text>
            <ExpenseTable rows={report.excludedExpenseRows} emptyLabel="No excluded expenses." />
          </View>
        ) : null}

        <Text
          style={styles.pageNumber}
          fixed
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </Page>
    </Document>
  );
}
