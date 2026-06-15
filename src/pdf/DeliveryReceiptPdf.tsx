import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { formatDisplayDate } from "@/src/lib/format-date";

type DeliveryReceiptPdfProps = {
  invoice: {
    invoice_number: string;
  };
  client: {
    company_name?: string | null;
    private_name?: string | null;
  } | null;
  items: {
    id: string;
    name: string;
    qty: number | string;
  }[];
  companySettings?: {
    vat_number?: string | null;
  } | null;
  delivery: {
    customerName: string;
    deliveryAddress: string;
    deliveryDate: string;
    conditions: string[];
  };
};

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 56,
    paddingTop: 42,
    paddingBottom: 48,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: "#111111",
  },
  logo: {
    width: 210,
    height: 92,
    objectFit: "contain",
    alignSelf: "center",
    marginBottom: 14,
  },
  company: {
    gap: 5,
    marginBottom: 26,
  },
  companyName: {
    fontWeight: 700,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 14,
  },
  details: {
    borderTopWidth: 0.6,
    borderTopColor: "#9ca3af",
    borderLeftWidth: 0.6,
    borderLeftColor: "#9ca3af",
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: "row",
  },
  detailLabel: {
    width: 120,
    padding: 7,
    borderRightWidth: 0.6,
    borderRightColor: "#9ca3af",
    borderBottomWidth: 0.6,
    borderBottomColor: "#9ca3af",
  },
  detailValue: {
    flex: 1,
    padding: 7,
    borderRightWidth: 0.6,
    borderRightColor: "#9ca3af",
    borderBottomWidth: 0.6,
    borderBottomColor: "#9ca3af",
  },
  highlighted: {
    backgroundColor: "#d1d5d4",
    fontWeight: 700,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginTop: 4,
    marginBottom: 7,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 6,
    paddingLeft: 1,
  },
  bullet: {
    width: 8,
  },
  bulletText: {
    flex: 1,
  },
  confirmation: {
    borderTopWidth: 0.7,
    borderTopColor: "#6b7280",
    marginTop: 42,
    paddingTop: 13,
    fontSize: 11,
    lineHeight: 1.5,
  },
  signatures: {
    flexDirection: "row",
    gap: 60,
    marginTop: 48,
  },
  signatureColumn: {
    flex: 1,
  },
  signatureTitle: {
    fontWeight: 700,
    marginBottom: 42,
  },
  signatureLine: {
    borderTopWidth: 0.7,
    borderTopColor: "#555555",
    marginBottom: 18,
  },
  signatureValue: {
    marginBottom: 12,
    minHeight: 14,
  },
});

function quantityLabel(qty: number | string) {
  return Number(qty || 0).toLocaleString("en-MT", {
    maximumFractionDigits: 2,
  });
}

export default function DeliveryReceiptPdf({
  invoice,
  client,
  items,
  companySettings,
  delivery,
}: DeliveryReceiptPdfProps) {
  const companyVatNumber = companySettings?.vat_number || "MT32531436";
  const customerName =
    delivery.customerName ||
    client?.company_name ||
    client?.private_name ||
    "Customer";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image does not support alt text. */}
        <Image
          src={`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/mgs-logo.png`}
          style={styles.logo}
        />

        <View style={styles.company}>
          <Text style={styles.companyName}>Malta Gym Solutions</Text>
          <Text>184, Triq il-Kbira, Birkirkara, Malta</Text>
          <Text>{companyVatNumber}</Text>
        </View>

        <Text style={styles.title}>DELIVERY &amp; ITEM CONFIRMATION RECEIPT</Text>

        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, styles.highlighted]}>Customer Name:</Text>
            <Text style={[styles.detailValue, styles.highlighted]}>{customerName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Delivery Address:</Text>
            <Text style={styles.detailValue}>{delivery.deliveryAddress || "-"}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date of Delivery:</Text>
            <Text style={styles.detailValue}>
              {formatDisplayDate(delivery.deliveryDate)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Invoice Reference:</Text>
            <Text style={styles.detailValue}>{invoice.invoice_number}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Item/s Delivered:</Text>
        {items.map((item) => (
          <View key={item.id} style={styles.bulletRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              {quantityLabel(item.qty)} × {item.name}
            </Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Condition Upon Delivery:</Text>
        {delivery.conditions.map((condition) => (
          <View key={condition} style={styles.bulletRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>{condition}</Text>
          </View>
        ))}

        <Text style={styles.confirmation}>
          I, the undersigned, confirm that the above item/s have been delivered and
          received in satisfactory condition.
        </Text>

        <View style={styles.signatures}>
          <View style={styles.signatureColumn}>
            <Text style={styles.signatureTitle}>Customer Signature</Text>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureValue}>{customerName}</Text>
            <Text>{formatDisplayDate(delivery.deliveryDate)}</Text>
          </View>
          <View style={styles.signatureColumn}>
            <Text style={styles.signatureTitle}>Malta Gym Solutions</Text>
            <View style={styles.signatureLine} />
            <View style={styles.signatureLine} />
            <Text>{formatDisplayDate(delivery.deliveryDate)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
