import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatDisplayDate } from "@/src/lib/format-date";
import { reportPeriodLabel } from "@/src/lib/financial-report";
import { type VatRateBreakdownRow, type VatReport } from "@/src/lib/vat-report";

const styles = StyleSheet.create({
  page: { paddingTop: 32, paddingHorizontal: 32, paddingBottom: 42, fontFamily: "Helvetica", fontSize: 8, color: "#0f172a" },
  header: { marginBottom: 16, borderBottomWidth: 2, borderBottomColor: "#0f172a", paddingBottom: 10 },
  eyebrow: { fontSize: 8, color: "#64748b", letterSpacing: 0.8, marginBottom: 4 },
  title: { fontSize: 21, fontWeight: 700, marginBottom: 5 },
  subtitle: { fontSize: 9, color: "#475569" },
  metrics: { flexDirection: "row", gap: 7 },
  metric: { flex: 1, borderWidth: 1, borderColor: "#cbd5e1", padding: 8, minHeight: 48 },
  metricLabel: { fontSize: 7, color: "#64748b", marginBottom: 6 },
  metricValue: { fontSize: 13, fontWeight: 700 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginBottom: 7 },
  note: { marginTop: 8, padding: 7, backgroundColor: "#f8fafc", color: "#475569", lineHeight: 1.35 },
  table: { borderWidth: 1, borderColor: "#cbd5e1" },
  row: { flexDirection: "row", minHeight: 23 },
  headerRow: { backgroundColor: "#0f172a", color: "#ffffff" },
  cell: { paddingVertical: 5, paddingHorizontal: 5, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  headerCell: { fontWeight: 700, borderBottomWidth: 0 },
  right: { textAlign: "right" },
  empty: { padding: 10, color: "#64748b" },
  pageNumber: { position: "absolute", bottom: 18, left: 32, right: 32, textAlign: "right", color: "#94a3b8" },
});

function money(value: number) {
  return `EUR ${Number(value || 0).toFixed(2)}`;
}

function RateTable({ rows }: { rows: VatRateBreakdownRow[] }) {
  return (
    <View style={styles.table}>
      <View style={[styles.row, styles.headerRow]}>
        <Text style={[styles.cell, styles.headerCell, { width: "18%" }]}>VAT Rate</Text>
        <Text style={[styles.cell, styles.headerCell, styles.right, { width: "14%" }]}>Records</Text>
        <Text style={[styles.cell, styles.headerCell, styles.right, { width: "24%" }]}>Taxable</Text>
        <Text style={[styles.cell, styles.headerCell, styles.right, { width: "20%" }]}>VAT</Text>
        <Text style={[styles.cell, styles.headerCell, styles.right, { width: "24%" }]}>Incl. VAT</Text>
      </View>
      {rows.length === 0 ? <Text style={styles.empty}>No records in this period.</Text> : null}
      {rows.map((row) => (
        <View key={row.vatRate} style={styles.row} wrap={false}>
          <Text style={[styles.cell, { width: "18%" }]}>{row.vatRate}%</Text>
          <Text style={[styles.cell, styles.right, { width: "14%" }]}>{row.count}</Text>
          <Text style={[styles.cell, styles.right, { width: "24%" }]}>{money(row.taxableAmount)}</Text>
          <Text style={[styles.cell, styles.right, { width: "20%" }]}>{money(row.vatAmount)}</Text>
          <Text style={[styles.cell, styles.right, { width: "24%" }]}>{money(row.amountInclVat)}</Text>
        </View>
      ))}
    </View>
  );
}

export default function VatReportPdf({ report }: { report: VatReport }) {
  return (
    <Document title="MGS VAT Report" author="Malta Gym Solutions">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>MALTA GYM SOLUTIONS</Text>
          <Text style={styles.title}>VAT Report</Text>
          <Text style={styles.subtitle}>{reportPeriodLabel(report.period)} | Generated {new Date(report.generatedAt).toLocaleString("en-GB")}</Text>
        </View>

        <View style={styles.metrics}>
          <View style={styles.metric}><Text style={styles.metricLabel}>OUTPUT VAT</Text><Text style={styles.metricValue}>{money(report.summary.outputVat)}</Text></View>
          <View style={styles.metric}><Text style={styles.metricLabel}>INPUT VAT</Text><Text style={styles.metricValue}>{money(report.summary.recoverableInputVat)}</Text></View>
          <View style={styles.metric}><Text style={styles.metricLabel}>VAT PAYMENTS</Text><Text style={styles.metricValue}>{money(report.summary.vatPayments)}</Text></View>
          <View style={styles.metric}><Text style={styles.metricLabel}>VAT POSITION</Text><Text style={styles.metricValue}>{money(report.summary.vatPosition)}</Text></View>
        </View>
        <Text style={styles.note}>Positive VAT position means VAT remains payable. A negative position means a credit or overpayment. Expenses hidden from calculations are excluded.</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sales by VAT Rate</Text>
          <RateTable rows={report.salesByVatRate} />
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Purchases by VAT Rate</Text>
          <RateTable rows={report.purchasesByVatRate} />
        </View>

        <View style={styles.section} break>
          <Text style={styles.sectionTitle}>Sales VAT Detail</Text>
          <View style={styles.table}>
            <View style={[styles.row, styles.headerRow]}>
              <Text style={[styles.cell, styles.headerCell, { width: "12%" }]}>Date</Text>
              <Text style={[styles.cell, styles.headerCell, { width: "16%" }]}>Invoice</Text>
              <Text style={[styles.cell, styles.headerCell, { width: "26%" }]}>Client</Text>
              <Text style={[styles.cell, styles.headerCell, styles.right, { width: "10%" }]}>Rate</Text>
              <Text style={[styles.cell, styles.headerCell, styles.right, { width: "18%" }]}>Taxable</Text>
              <Text style={[styles.cell, styles.headerCell, styles.right, { width: "18%" }]}>VAT</Text>
            </View>
            {report.salesRows.length === 0 ? <Text style={styles.empty}>No sales in this period.</Text> : null}
            {report.salesRows.map((row) => (
              <View key={row.id} style={styles.row} wrap={false}>
                <Text style={[styles.cell, { width: "12%" }]}>{formatDisplayDate(row.date)}</Text>
                <Text style={[styles.cell, { width: "16%" }]}>{row.invoiceNumber}</Text>
                <Text style={[styles.cell, { width: "26%" }]}>{row.client}</Text>
                <Text style={[styles.cell, styles.right, { width: "10%" }]}>{row.vatRate}%</Text>
                <Text style={[styles.cell, styles.right, { width: "18%" }]}>{money(row.amountExclVat)}</Text>
                <Text style={[styles.cell, styles.right, { width: "18%" }]}>{money(row.vatAmount)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section} break>
          <Text style={styles.sectionTitle}>Purchase VAT Detail</Text>
          <View style={styles.table}>
            <View style={[styles.row, styles.headerRow]}>
              <Text style={[styles.cell, styles.headerCell, { width: "12%" }]}>Date</Text>
              <Text style={[styles.cell, styles.headerCell, { width: "22%" }]}>Supplier</Text>
              <Text style={[styles.cell, styles.headerCell, { width: "26%" }]}>Category</Text>
              <Text style={[styles.cell, styles.headerCell, styles.right, { width: "10%" }]}>Rate</Text>
              <Text style={[styles.cell, styles.headerCell, styles.right, { width: "15%" }]}>Taxable</Text>
              <Text style={[styles.cell, styles.headerCell, styles.right, { width: "15%" }]}>VAT</Text>
            </View>
            {report.purchaseRows.length === 0 ? <Text style={styles.empty}>No purchases in this period.</Text> : null}
            {report.purchaseRows.map((row) => (
              <View key={row.id} style={styles.row} wrap={false}>
                <Text style={[styles.cell, { width: "12%" }]}>{formatDisplayDate(row.date)}</Text>
                <Text style={[styles.cell, { width: "22%" }]}>{row.supplier}</Text>
                <Text style={[styles.cell, { width: "26%" }]}>{row.category}</Text>
                <Text style={[styles.cell, styles.right, { width: "10%" }]}>{row.vatRate}%</Text>
                <Text style={[styles.cell, styles.right, { width: "15%" }]}>{money(row.amountExclVat)}</Text>
                <Text style={[styles.cell, styles.right, { width: "15%" }]}>{money(row.vatAmount)}</Text>
              </View>
            ))}
          </View>
        </View>

        {report.paymentRows.length > 0 ? (
          <View style={styles.section} break>
            <Text style={styles.sectionTitle}>VAT Payments</Text>
            <View style={styles.table}>
              {report.paymentRows.map((row) => (
                <View key={row.id} style={styles.row} wrap={false}>
                  <Text style={[styles.cell, { width: "18%" }]}>{formatDisplayDate(row.date)}</Text>
                  <Text style={[styles.cell, { width: "52%" }]}>{row.description}</Text>
                  <Text style={[styles.cell, styles.right, { width: "30%" }]}>{money(row.amountInclVat)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <Text style={styles.pageNumber} fixed render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </Page>
    </Document>
  );
}

