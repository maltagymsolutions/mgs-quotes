import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import { formatDisplayDate } from "@/src/lib/format-date";
import {
  calculateInvoiceReceiptTotals,
  calculateStillOwingAfterReceipt,
  PAYMENT_RECEIPT_TYPE_LABELS,
  PaymentReceiptType,
} from "@/src/lib/payment-receipts";

type PaymentReceiptPdfProps = {
  receipt: {
    id: string;
    receipt_type: PaymentReceiptType;
    receipt_date: string;
    amount_paid: number | string;
    created_at?: string | null;
  };
  allReceipts: {
    id?: string | null;
    receipt_type: PaymentReceiptType | string;
    receipt_date?: string | null;
    amount_paid: number | string;
    created_at?: string | null;
  }[];
  invoice: {
    date_issued: string;
    invoice_number: string;
    deposit_percent?: number | string | null;
    discount_amount_incl_vat?: number | string | null;
  };
  client: {
    company_name?: string | null;
    private_name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  items: {
    qty: number | string;
    sale_price_incl_vat: number | string;
  }[];
  companySettings?: {
    vat_number?: string | null;
  } | null;
};

function money(value: number) {
  return `€\u00A0${Number(value || 0).toFixed(2)}`;
}

const styles = StyleSheet.create({
  page: { padding: 42, fontSize: 11, fontFamily: "Helvetica", color: "#111111" },
  layout: { flexDirection: "row", gap: 22 },
  left: { width: 160, gap: 22 },
  companySmall: { gap: 9, fontSize: 10, lineHeight: 1.35 },
  logo: { width: 125, height: 53, marginBottom: 2, alignSelf: "flex-start" },
  receiptBlock: { gap: 6 },
  title: { fontSize: 20, fontWeight: 300, color: "#555555" },
  bold: { fontWeight: 700 },
  right: { flex: 1, gap: 34, paddingTop: 4 },
  clientBlock: { gap: 12, fontSize: 11, lineHeight: 1.3 },
  table: { borderBottomWidth: 1.5, borderBottomColor: "#111111" },
  tr: { flexDirection: "row" },
  th: {
    backgroundColor: "#e10600",
    color: "#ffffff",
    padding: 6,
    fontSize: 10,
    lineHeight: 1.15,
    fontWeight: 700,
  },
  td: {
    padding: 6,
    fontSize: 10,
    lineHeight: 1.15,
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
    borderRightWidth: 1,
    borderRightColor: "#dddddd",
  },
  totalCell: {
    padding: 5,
    fontSize: 10,
    fontWeight: 700,
    borderBottomWidth: 1,
    borderBottomColor: "#111111",
    borderRightWidth: 1,
    borderRightColor: "#dddddd",
  },
  colDate: { width: "22%" },
  colReference: { width: "20%" },
  colTotal: { width: "17%", textAlign: "right" },
  colPaid: { width: "20%", textAlign: "right" },
  colOwing: { width: "21%", textAlign: "right" },
  thanks: { marginTop: 58, textAlign: "center", color: "#555555", fontSize: 11 },
});

export default function PaymentReceiptPdf({
  receipt,
  allReceipts,
  invoice,
  client,
  items,
  companySettings,
}: PaymentReceiptPdfProps) {
  const companyVatNumber = companySettings?.vat_number || "MT32755725";
  const totals = calculateInvoiceReceiptTotals(invoice, items);
  const stillOwing = calculateStillOwingAfterReceipt({
    invoiceTotal: totals.invoiceTotal,
    receipts: allReceipts,
    receipt,
  });
  const receiptLabel = PAYMENT_RECEIPT_TYPE_LABELS[receipt.receipt_type];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.layout}>
          <View style={styles.left}>
            <View style={styles.companySmall}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image does not support alt text. */}
              <Image
                src={`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/mgs-logo.png`}
                style={styles.logo}
              />
            </View>

            <View style={styles.receiptBlock}>
              <Text style={styles.title}>RECEIPT</Text>
              <Text>Date: {formatDisplayDate(receipt.receipt_date)}</Text>
            </View>

            <View style={styles.companySmall}>
              <Text style={styles.bold}>{companyVatNumber}</Text>
              <Text>Phone: +356 7954 9541</Text>
              <Text>@maltagymsolutions</Text>
              <Text>maltagymsolutions.com</Text>
            </View>
          </View>

          <View style={styles.right}>
            <View style={styles.clientBlock}>
              <Text style={styles.bold}>
                {client?.company_name || client?.private_name || "Client"}
              </Text>
              {client?.email ? <Text style={styles.bold}>{client.email}</Text> : null}
              {client?.phone ? <Text style={styles.bold}>{client.phone}</Text> : null}
              {client?.address ? <Text style={styles.bold}>{client.address}</Text> : null}
              <Text>{receiptLabel}</Text>
            </View>

            <View style={styles.table}>
              <View style={styles.tr}>
                <Text style={[styles.th, styles.colDate]}>Invoice Date</Text>
                <Text style={[styles.th, styles.colReference]}>Reference</Text>
                <Text style={[styles.th, styles.colTotal]}>Invoice Total</Text>
                <Text style={[styles.th, styles.colPaid]}>Amount Paid</Text>
                <Text style={[styles.th, styles.colOwing]} wrap={false}>
                  Still Owing
                </Text>
              </View>

              <View style={styles.tr}>
                <Text style={[styles.td, styles.colDate]}>
                  {formatDisplayDate(invoice.date_issued)}
                </Text>
                <Text style={[styles.td, styles.colReference]}>{invoice.invoice_number}</Text>
                <Text style={[styles.td, styles.colTotal]}>{money(totals.invoiceTotal)}</Text>
                <Text style={[styles.td, styles.colPaid]}>
                  {money(Number(receipt.amount_paid || 0))}
                </Text>
                <Text style={[styles.td, styles.colOwing]}>{money(stillOwing)}</Text>
              </View>

              <View style={styles.tr}>
                <Text style={[styles.totalCell, styles.colDate]}>Total</Text>
                <Text style={[styles.totalCell, styles.colReference]} />
                <Text style={[styles.totalCell, styles.colTotal]} />
                <Text style={[styles.totalCell, styles.colPaid]}>
                  {money(Number(receipt.amount_paid || 0))}
                </Text>
                <Text style={[styles.totalCell, styles.colOwing]}>{money(stillOwing)}</Text>
              </View>
            </View>

            <Text style={styles.thanks}>Thank you for choosing Malta Gym Solutions!</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
