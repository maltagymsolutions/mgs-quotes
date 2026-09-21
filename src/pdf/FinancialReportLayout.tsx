import type { ReactNode } from "react";
import { Font, Image as PdfImage, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReportPeriod } from "@/src/lib/financial-report";

// Bundle fonts locally so currency symbols and client names render consistently offline.
Font.register({ family: "MGS Report", src: `${process.cwd()}/public/fonts/LiberationSans-Regular.ttf` });
Font.register({ family: "MGS Report Bold", src: `${process.cwd()}/public/fonts/LiberationSans-Bold.ttf` });

const colors = {
  ink: "#202926", muted: "#6A7470", line: "#E3E8E4", paper: "#F6F8F6",
  brand: "#D82B24", green: "#176454", greenLight: "#EDF6F1",
  amber: "#865D1D", amberLight: "#FBF4E7", red: "#A32C29", redLight: "#FCF0EE",
};

export const reportStyles = StyleSheet.create({
  page: { paddingTop: 26, paddingHorizontal: 36, paddingBottom: 46, fontFamily: "MGS Report", fontSize: 9, color: colors.ink, backgroundColor: "#FFFFFF" },
  runningHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 13, marginBottom: 17, borderBottomWidth: 0.7, borderBottomColor: colors.line },
  logo: { width: 92, height: 40, objectFit: "contain" },
  headerMeta: { textAlign: "right", color: colors.muted, fontSize: 8, lineHeight: 1.6 },
  footer: { position: "absolute", bottom: 21, left: 36, right: 36, paddingTop: 9, borderTopWidth: 0.7, borderTopColor: colors.line, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: colors.muted },
  eyebrow: { fontSize: 7.5, fontFamily: "MGS Report Bold", color: colors.brand, letterSpacing: 1.2, marginBottom: 7 },
  title: { fontSize: 27, fontFamily: "MGS Report Bold", letterSpacing: -0.6, marginBottom: 7 },
  subtitle: { fontSize: 9, color: colors.muted, lineHeight: 1.45 },
  heading: { marginBottom: 18 },
  metrics: { flexDirection: "row", gap: 10, marginBottom: 10 },
  metric: { flex: 1, backgroundColor: colors.paper, borderRadius: 8, padding: 13 },
  metricLabel: { fontSize: 8, color: colors.muted, marginBottom: 8 },
  metricValue: { fontSize: 19, fontFamily: "MGS Report Bold", letterSpacing: -0.3 },
  metricHint: { fontSize: 7.5, color: colors.muted, marginTop: 6 },
  result: { borderRadius: 9, paddingHorizontal: 16, paddingVertical: 13, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  resultCopy: { flex: 1 },
  resultLabel: { fontSize: 10, fontFamily: "MGS Report Bold", marginBottom: 5 },
  resultNote: { fontSize: 8, lineHeight: 1.35 },
  resultValue: { fontSize: 26, fontFamily: "MGS Report Bold", letterSpacing: -0.5 },
  note: { paddingVertical: 9, paddingHorizontal: 11, borderLeftWidth: 2, borderLeftColor: colors.line, backgroundColor: colors.paper, borderRadius: 3, fontSize: 8, color: colors.muted, lineHeight: 1.5, marginBottom: 7 },
  sectionHeading: { marginTop: 15, marginBottom: 9 },
  sectionTitle: { fontSize: 13, fontFamily: "MGS Report Bold", marginBottom: 4 },
  sectionNote: { fontSize: 8, color: colors.muted, lineHeight: 1.4 },
  detailHeading: { marginBottom: 12 },
  detailTitle: { fontSize: 21, fontFamily: "MGS Report Bold", marginBottom: 6, letterSpacing: -0.3 },
  tableHead: { flexDirection: "row", backgroundColor: "#EAF0EC", borderRadius: 4, minHeight: 25, alignItems: "center" },
  headerCell: { paddingHorizontal: 7, paddingVertical: 8, color: "#41564C", fontSize: 7.5, fontFamily: "MGS Report Bold" },
  row: { flexDirection: "row", minHeight: 25, borderBottomWidth: 0.5, borderBottomColor: colors.line },
  striped: { backgroundColor: "#F8FAF8" },
  cell: { paddingHorizontal: 7, paddingVertical: 7, fontSize: 9, lineHeight: 1.25, justifyContent: "center" },
  compactCell: { paddingVertical: 3.5, fontSize: 8.2, lineHeight: 1.25 },
  compactRow: { minHeight: 18 },
  bold: { fontFamily: "MGS Report Bold" },
  total: { backgroundColor: "#EDF3EF", borderBottomWidth: 0, borderTopWidth: 0.7, borderTopColor: "#BDCEC3" },
  empty: { padding: 17, color: colors.muted, fontSize: 9, backgroundColor: colors.paper, lineHeight: 1.5 },
  badge: { fontSize: 7.3, borderRadius: 3, paddingVertical: 3, paddingHorizontal: 4, alignSelf: "flex-start" },
});

export function amount(value: number) {
  return Number(value || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function money(value: number) {
  return `${value < 0 ? "-" : ""}€${amount(Math.abs(value))}`;
}

function friendlyDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function periodLabel(period: ReportPeriod) {
  if (period.from && period.to) return `${friendlyDate(period.from)} - ${friendlyDate(period.to)}`;
  if (period.from) return `From ${friendlyDate(period.from)}`;
  if (period.to) return `Up to ${friendlyDate(period.to)}`;
  return "All time";
}

export type ReportMeta = { period: ReportPeriod; generatedAt: string };

export function ReportPage({ report, name, children, bookmark }: { report: ReportMeta; name: string; children: ReactNode; bookmark?: string }) {
  return (
    <Page size="A4" style={reportStyles.page} bookmark={bookmark}>
      <View style={reportStyles.runningHeader} fixed>
        <PdfImage src={`${process.cwd()}/public/mgs-logo.png`} style={reportStyles.logo} />
        <View style={reportStyles.headerMeta}>
          <Text style={reportStyles.bold}>{name}</Text>
          <Text>{periodLabel(report.period)}</Text>
          <Text>Amounts in EUR (€)</Text>
        </View>
      </View>
      {children}
      <View style={reportStyles.footer} fixed>
        <Text>Malta Gym Solutions  /  Generated {new Date(report.generatedAt).toLocaleString("en-GB")}</Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  );
}

export function ReportHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return <View style={reportStyles.heading} wrap={false}>
    <Text style={reportStyles.eyebrow}>FINANCIAL OVERVIEW</Text>
    <Text style={reportStyles.title}>{title}</Text>
    <Text style={reportStyles.subtitle}>{subtitle}</Text>
  </View>;
}

export function Metrics({ items }: { items: { label: string; value: number; hint: string }[] }) {
  return <View style={reportStyles.metrics} wrap={false}>
    {items.map((item) => <View key={item.label} style={reportStyles.metric}>
      <Text style={reportStyles.metricLabel}>{item.label}</Text>
      <Text style={[reportStyles.metricValue, { fontSize: amount(item.value).length > 11 ? 14 : 19 }]}>{money(item.value)}</Text>
      <Text style={reportStyles.metricHint}>{item.hint}</Text>
    </View>)}
  </View>;
}

type Tone = "green" | "amber" | "red" | "neutral";
const toneStyles = {
  green: { backgroundColor: colors.greenLight, color: colors.green },
  amber: { backgroundColor: colors.amberLight, color: colors.amber },
  red: { backgroundColor: colors.redLight, color: colors.red },
  neutral: { backgroundColor: colors.paper, color: colors.ink },
};

export function ResultPanel({ label, value, note, tone = "green" }: { label: string; value: number; note: string; tone?: Tone }) {
  return <View style={[reportStyles.result, toneStyles[tone]]} wrap={false}>
    <View style={reportStyles.resultCopy}><Text style={reportStyles.resultLabel}>{label}</Text><Text style={reportStyles.resultNote}>{note}</Text></View>
    <Text style={[reportStyles.resultValue, { fontSize: amount(value).length > 13 ? 19 : 26 }]}>{money(value)}</Text>
  </View>;
}

export function ReportNote({ children }: { children: ReactNode }) {
  return <Text style={reportStyles.note}>{children}</Text>;
}

export function SectionHeading({ title, note }: { title: string; note?: string }) {
  return <View style={reportStyles.sectionHeading} minPresenceAhead={55} wrap={false}>
    <Text style={reportStyles.sectionTitle}>{title}</Text>
    {note ? <Text style={reportStyles.sectionNote}>{note}</Text> : null}
  </View>;
}

export type Column = { label: string; width: number; right?: boolean };
type Cell = string | number | { text: string; tone: Tone };
export type TableRow = { key: string; cells: Cell[] };
const noHyphenation = (word: string) => [word];

export function TableHeader({ columns }: { columns: Column[] }) {
  return <View style={reportStyles.tableHead} wrap={false} minPresenceAhead={24}>
    {columns.map((column, i) => <Text key={i} style={[reportStyles.headerCell, { width: `${column.width}%`, textAlign: column.right ? "right" : "left" }]}>{column.label}</Text>)}
  </View>;
}

export function TableRows({ columns, rows, emptyLabel = "No records in this period.", compact = false, total }: { columns: Column[]; rows: TableRow[]; emptyLabel?: string; compact?: boolean; total?: Cell[] }) {
  function rowView(row: TableRow, index: number, isTotal = false) {
    return <View key={row.key} style={[reportStyles.row, ...(compact ? [reportStyles.compactRow] : []), ...(index % 2 ? [reportStyles.striped] : []), ...(isTotal ? [reportStyles.total] : [])]} wrap={false} minPresenceAhead={!isTotal && total && index === rows.length - 1 ? (compact ? 20 : 30) : 0}>
      {row.cells.map((cell, i) => <View key={i} style={[reportStyles.cell, { width: `${columns[i].width}%` }, ...(compact ? [reportStyles.compactCell] : [])]}>
        {typeof cell === "object" ? <Text hyphenationCallback={noHyphenation} style={[reportStyles.badge, toneStyles[cell.tone]]}>{cell.text}</Text> : <Text hyphenationCallback={noHyphenation} style={[{ textAlign: columns[i].right ? "right" : "left" }, ...(isTotal ? [reportStyles.bold] : [])]}>{cell}</Text>}
      </View>)}
    </View>;
  }
  return <View>
    {rows.length ? rows.map((row, index) => rowView(row, index)) : <Text style={reportStyles.empty}>{emptyLabel}</Text>}
    {total && rows.length ? rowView({ key: "total", cells: total }, 0, true) : null}
  </View>;
}

export function DataTable(props: Parameters<typeof TableRows>[0]) {
  return <View><TableHeader columns={props.columns} /><TableRows {...props} /></View>;
}

export function DetailPage({ report, name, title, note, columns, rows, compact, emptyLabel, total, children }: Parameters<typeof TableRows>[0] & { report: ReportMeta; name: string; title: string; note: string; children?: ReactNode }) {
  return <ReportPage report={report} name={name} bookmark={title}>
    {/* Repeat the section and column headings on every continuation page. */}
    <View fixed>
      <View style={reportStyles.detailHeading}>
        <Text style={reportStyles.detailTitle}>{title}</Text>
        <Text style={reportStyles.sectionNote}>{note}</Text>
      </View>
      <TableHeader columns={columns} />
    </View>
    <TableRows columns={columns} rows={rows} compact={compact} emptyLabel={emptyLabel} total={total} />
    {children}
  </ReportPage>;
}
