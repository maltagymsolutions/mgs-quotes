import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

type QuotePdfProps = {
  quote: any;
  client: any;
  items: any[];
};

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

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#111111",
  },
  top: {
    flexDirection: "row",
    gap: 16,
  },
  left: {
    width: 150,
    gap: 16,
    alignItems: "flex-start",
  },
  right: {
    flex: 1,
    gap: 12,
  },
 companySmall: {
    gap: 4,
    fontSize: 10,
    lineHeight: 1.35,
    alignItems: "flex-start",
  },
  titleBlock: {
    gap: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: 300,
  },
  clientBlock: {
    gap: 3,
    fontSize: 11,
    lineHeight: 1.3,
  },
  table: {
    borderWidth: 1,
    borderColor: "#cccccc",
  },
  tr: {
    flexDirection: "row",
  },
 th: {
    backgroundColor: "#e10600",
    color: "#ffffff",
    padding: 6,
    fontSize: 10,
    lineHeight: 1.1,
    fontWeight: 700,
  },
  td: {
    padding: 6,
    fontSize: 10,
    lineHeight: 1.15,
    borderTopWidth: 1,
    borderTopColor: "#dddddd",
  },
  colDesc: {
    width: "46%",
  },
  colQty: {
    width: "10%",
    textAlign: "center",
  },
  colVat: {
    width: "10%",
    textAlign: "center",
  },
  colUnit: {
    width: "17%",
    textAlign: "right",
  },
  colLine: {
    width: "17%",
    textAlign: "right",
  },
  footerRow: {
    flexDirection: "row",
  },
  footerLabel: {
    width: "83%",
    padding: 6,
    borderTopWidth: 1,
    borderTopColor: "#cccccc",
  },
  footerValue: {
    width: "17%",
    padding: 6,
    borderTopWidth: 1,
    borderTopColor: "#cccccc",
    textAlign: "right",
  },
   totalLabel: {
      fontSize: 12,
      fontWeight: 700,
    },
    totalValue: {
      fontSize: 12,
      fontWeight: 700,
    },
    totalRowLabel: {
      borderTopWidth: 2,
      borderTopColor: "#111111",
      borderBottomWidth: 2,
      borderBottomColor: "#111111",
    },
    totalRowValue: {
      borderTopWidth: 2,
      borderTopColor: "#111111",
      borderBottomWidth: 2,
      borderBottomColor: "#111111",
    },
    section: {
      gap: 4,
    },
    bold: {
      fontWeight: 700,
    },
    moneyCell: {
      fontFamily: "Courier",
    },
  });

export default function QuotePdf({ quote, client, items }: QuotePdfProps) {
  const isBusinessClient = !!client?.is_business_client;

  const grossBeforeDiscount = round2(
    items.reduce(
      (sum, item) => sum + Number(item.sale_price_incl_vat) * Number(item.qty),
      0
    )
  );

  const discountAmount = round2(
    Math.min(Number(quote.discount_amount_incl_vat || 0), grossBeforeDiscount)
  );

  const grossAfterDiscount = round2(grossBeforeDiscount - discountAmount);

  const subtotal = isBusinessClient
    ? round2(grossAfterDiscount / (1 + Number(quote.vat_rate) / 100))
    : grossAfterDiscount;

  const vatAmount = isBusinessClient
    ? round2(grossAfterDiscount - subtotal)
    : round2(
        grossAfterDiscount - grossAfterDiscount / (1 + Number(quote.vat_rate) / 100)
      );

  const depositAmount = round2(
    grossAfterDiscount * (Number(quote.deposit_percent) / 100)
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.top}>
          <View style={styles.left}>
            <View style={styles.companySmall}>
             <Image
                src={`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/mgs-logo.png`}
                style={{ width: 120, height: 52, marginBottom: 6, alignSelf: "flex-start" }}
              />
              <Text>MT32531436</Text>
              <Text>Phone: +356 7954 9541</Text>
              <Text>@maltagymsolutions</Text>
              <Text>maltagymsolutions.com</Text>
            </View>

            <View style={styles.titleBlock}>
              <Text style={styles.title}>QUOTE</Text>
              <Text>Date: {quote.date_issued}</Text>
              <Text>Quote No: {quote.quote_number}</Text>
            </View>
          </View>

          <View style={styles.right}>
            <View style={styles.clientBlock}>
              <Text style={styles.bold}>
                {client?.company_name || client?.private_name || "Client"}
              </Text>
              {client?.company_name && client?.contact_person ? (
                <Text>Attn: {client.contact_person}</Text>
              ) : null}
              {client?.email ? <Text>{client.email}</Text> : null}
              {client?.phone ? <Text>{client.phone}</Text> : null}
              {client?.vat_number ? <Text>VAT No: {client.vat_number}</Text> : null}
              {client?.address ? <Text>{client.address}</Text> : null}
            </View>

            <View style={styles.table}>
              <View style={styles.tr}>
                <Text style={[styles.th, styles.colDesc]}>Description</Text>
                <Text style={[styles.th, styles.colQty]}>Qty</Text>
                <Text style={[styles.th, styles.colVat]}>VAT</Text>
                <Text style={[styles.th, styles.colUnit]}>
                  {isBusinessClient ? "Unit Price excl. VAT" : "Unit Price incl. VAT"}
                </Text>
                <Text style={[styles.th, styles.colLine]}>
                  {isBusinessClient ? "Price excl. VAT" : "Price incl. VAT"}
                </Text>
              </View>

              {items.map((item) => {
                const unitDisplay = isBusinessClient
                  ? round2(
                      Number(item.sale_price_incl_vat) /
                        (1 + Number(quote.vat_rate) / 100)
                    )
                  : Number(item.sale_price_incl_vat);

                const lineDisplay = round2(unitDisplay * Number(item.qty));

                return (
                  <View style={styles.tr} key={item.id}>
                    <Text style={[styles.td, styles.colDesc]}>{item.name}</Text>
                    <Text style={[styles.td, styles.colQty]}>{item.qty}</Text>
                    <Text style={[styles.td, styles.colVat]}>{quote.vat_rate}%</Text>
                    <Text style={[styles.td, styles.colUnit]}>{money(unitDisplay)}</Text>
                    <Text style={[styles.td, styles.colLine]}>{money(lineDisplay)}</Text>
                  </View>
                );
              })}

              <View style={styles.footerRow}>
                <Text style={styles.footerLabel}>
                  {isBusinessClient ? "Subtotal excl. VAT" : "Subtotal"}
                </Text>
                <Text style={styles.footerValue}>{money(subtotal)}</Text>
              </View>

              <View style={styles.footerRow}>
                <Text style={styles.footerLabel}>
                  VAT {Number(quote.vat_rate).toFixed(2)}%
                </Text>
                <Text style={styles.footerValue}>{money(vatAmount)}</Text>
              </View>

              {discountAmount > 0 ? (
                <View style={styles.footerRow}>
                  <Text style={styles.footerLabel}>Discount incl. VAT</Text>
                  <Text style={styles.footerValue}>-{money(discountAmount)}</Text>
                </View>
              ) : null}

              <View style={styles.footerRow}>
                <Text style={[styles.footerLabel, styles.totalLabel, styles.totalRowLabel]}>
                  Total incl. VAT
                </Text>
                <Text style={[styles.footerValue, styles.totalValue, styles.totalRowValue]}>
                  {money(grossAfterDiscount)}
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text>
                Payment Terms: {quote.deposit_percent}% deposit upon order ({money(depositAmount)}),
                remaining balance upon delivery.
                {discountAmount > 0 ? ` Discount applied: ${money(discountAmount)}.` : ""}
              </Text>
              <Text>Quote Validity: 10 days from date of issue</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.bold}>Notes:</Text>
              <Text>{quote.notes || "No notes."}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}