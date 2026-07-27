import {
  Document,
  Page,
  Text,
  View,
  Image,
  Link,
  StyleSheet,
} from "@react-pdf/renderer";
import { Fragment } from "react";
import { isPartialDeposit } from "@/src/lib/deposits";
import { formatDisplayDate } from "@/src/lib/format-date";
import { CARD_PAYMENT_BRANDS, normalizeExternalUrl } from "@/src/lib/card-payment";
import {
  buildDefaultInvoicePaymentTerms,
  DEFAULT_INVOICE_NOTES,
  resolveCustomText,
  resolveInvoiceBankDetails,
  splitTextLines,
} from "@/src/lib/invoice-text";
import { calculateItemLineTotals, calculateItemsTotals } from "@/src/lib/item-discounts";
import { normalizePackageContents } from "@/src/lib/package-contents";

type InvoicePdfProps = {
  invoice: {
    date_issued: string;
    invoice_number: string;
    vat_rate: number | string;
    discount_amount_incl_vat?: number | string | null;
    deposit_percent: number | string;
    payment_terms?: string | null;
    bank_details?: string | null;
    card_payment_link?: string | null;
    notes?: string | null;
  };
  client: {
    is_business_client?: boolean | null;
    company_name?: string | null;
    private_name?: string | null;
    contact_person?: string | null;
    email?: string | null;
    phone?: string | null;
    vat_number?: string | null;
    address?: string | null;
  } | null;
  items: {
    id?: string | number | null;
    name: string;
    sale_price_incl_vat: number | string;
    qty: number | string;
    item_discount_percent?: number | string | null;
    package_contents?: string[] | null;
  }[];
  companySettings?: {
    vat_number?: string | null;
  } | null;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function money(value: number) {

  return `€\u00A0${Number(value || 0).toFixed(2)}`;

}

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 11, fontFamily: "Helvetica", color: "#111111" },
  top: { flexDirection: "row", gap: 16 },
  left: { width: 150, gap: 16 },
  right: { flex: 1, gap: 12 },
  companySmall: { gap: 4, fontSize: 10, lineHeight: 1.35 },
  titleBlock: { gap: 4 },
  title: { fontSize: 26, fontWeight: 300 },
  clientBlock: { gap: 3, fontSize: 11, lineHeight: 1.3 },
  table: { borderWidth: 1, borderColor: "#cccccc" },
  tr: { flexDirection: "row" },
  th: {
    backgroundColor: "#e10600",
    color: "#ffffff",
    padding: 6,
    fontSize: 10,
    lineHeight: 1.1,
    fontWeight: 700,
  },  td: { padding: 6, fontSize: 10, lineHeight: 1.15, borderTopWidth: 1, borderTopColor: "#dddddd" },
  colDesc: { width: "46%" },
  colQty: { width: "10%", textAlign: "center" },
  colVat: { width: "10%", textAlign: "center" },
  colUnit: { width: "17%", textAlign: "right" },
  colLine: { width: "17%", textAlign: "right" },
  discountTd: {
    paddingHorizontal: 6,
    paddingBottom: 6,
    fontSize: 9,
    fontStyle: "italic",
    color: "#555555",
  },
  packageContents: {
    marginTop: 3,
    gap: 1,
  },
  packageLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: "#475569",
  },
  packageItem: {
    fontSize: 8,
    color: "#475569",
  },
  footerRow: { flexDirection: "row" },
  footerLabel: { width: "83%", padding: 6, borderTopWidth: 1, borderTopColor: "#cccccc" },
  footerValue: { width: "17%", padding: 6, borderTopWidth: 1, borderTopColor: "#cccccc", textAlign: "right" },
  totalLabel: { fontSize: 12, fontWeight: 700 },
  totalValue: { fontSize: 12, fontWeight: 700 },
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
  section: { gap: 4 },
  cardBrandRow: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    marginTop: 2,
  },
  cardBrandImage: { objectFit: "contain" },
  cardPaymentLink: {
    color: "#008fb3",
    fontSize: 13,
    textDecoration: "underline",
  },
  bold: { fontWeight: 700 },
});

export default function InvoicePdf({ invoice, client, items, companySettings }: InvoicePdfProps) {
  const isBusinessClient = !!client?.is_business_client;
  const companyVatNumber = companySettings?.vat_number || "MT32755725";

  const itemTotals = calculateItemsTotals(items);
  const grossBeforeDiscount = itemTotals.totalAfterItemDiscounts;

  const discountAmount = round2(
    Math.min(Number(invoice.discount_amount_incl_vat || 0), grossBeforeDiscount)
  );

  const grossAfterDiscount = round2(grossBeforeDiscount - discountAmount);

 const subtotal = isBusinessClient
   ? round2(grossBeforeDiscount / (1 + Number(invoice.vat_rate) / 100))
   : grossBeforeDiscount;
 
 const vatAmount = round2(
   grossAfterDiscount - grossAfterDiscount / (1 + Number(invoice.vat_rate) / 100)
 );
  
  const depositAmount = round2(grossAfterDiscount * (Number(invoice.deposit_percent) / 100));
  const balanceDue = round2(grossAfterDiscount - depositAmount);
  const showDepositDetails = isPartialDeposit(invoice.deposit_percent);
  const paymentTerms = resolveCustomText(
    invoice.payment_terms,
    buildDefaultInvoicePaymentTerms({
      depositAmount,
      balanceDue,
      depositPercent: invoice.deposit_percent,
      discountAmount: round2(itemTotals.itemDiscountTotal + discountAmount),
      invoiceNumber: invoice.invoice_number,
      formatMoney: money,
    })
  );
  const bankDetails = resolveInvoiceBankDetails(invoice.bank_details);
  const notesText = resolveCustomText(invoice.notes, DEFAULT_INVOICE_NOTES);

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
              <Text>{companyVatNumber}</Text>
              <Text>Phone: +356 7954 9541</Text>
              <Text>@maltagymsolutions</Text>
              <Text>maltagymsolutions.com</Text>
            </View>

            <View style={styles.titleBlock}>
              <Text style={styles.title}>INVOICE</Text>
              <Text>Date: {formatDisplayDate(invoice.date_issued)}</Text>
              <Text>Invoice No: {invoice.invoice_number}</Text>
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
                        (1 + Number(invoice.vat_rate) / 100)
                    )
                  : Number(item.sale_price_incl_vat);

                const lineTotals = calculateItemLineTotals(item);
                const lineDisplay = round2(unitDisplay * Number(item.qty));
                const discountDisplay = isBusinessClient
                  ? round2(
                      lineTotals.discountAmount /
                        (1 + Number(invoice.vat_rate) / 100)
                    )
                  : lineTotals.discountAmount;

                return (
                  <Fragment key={item.id}>
                    <View style={styles.tr} wrap={false}>
                      <View style={[styles.td, styles.colDesc]}>
                        <Text>{item.name}</Text>
                        {normalizePackageContents(item.package_contents).length > 0 ? (
                          <View style={styles.packageContents}>
                            <Text style={styles.packageLabel}>Package includes:</Text>
                            {normalizePackageContents(item.package_contents).map((content, index) => (
                              <Text key={`${content}-${index}`} style={styles.packageItem}>- {content}</Text>
                            ))}
                          </View>
                        ) : null}
                      </View>
                      <Text style={[styles.td, styles.colQty]}>{item.qty}</Text>
                      <Text style={[styles.td, styles.colVat]}>{invoice.vat_rate}%</Text>
                      <Text style={[styles.td, styles.colUnit]}>{money(unitDisplay)}</Text>
                      <Text style={[styles.td, styles.colLine]}>{money(lineDisplay)}</Text>
                    </View>
                    {lineTotals.discountPercent > 0 ? (
                      <View style={styles.tr}>
                        <Text style={[styles.discountTd, styles.colDesc]}>
                          Discount: {lineTotals.discountPercent}% item discount
                        </Text>
                        <Text style={[styles.discountTd, styles.colQty]} />
                        <Text style={[styles.discountTd, styles.colVat]} />
                        <Text style={[styles.discountTd, styles.colUnit]} />
                        <Text style={[styles.discountTd, styles.colLine]}>
                          -{money(discountDisplay)}
                        </Text>
                      </View>
                    ) : null}
                  </Fragment>
                );
              })}

              <View style={styles.footerRow}>
                <Text style={styles.footerLabel}>
                  {isBusinessClient ? "Subtotal excl. VAT" : "Subtotal incl. VAT"}
                </Text>
                <Text style={styles.footerValue}>{money(subtotal)}</Text>
              </View>

              {discountAmount > 0 ? (
                <View style={styles.footerRow}>
                  <Text style={styles.footerLabel}>
                    {itemTotals.itemDiscountTotal > 0
                      ? "Additional discount incl. VAT"
                      : "Discount incl. VAT"}
                  </Text>
                  <Text style={styles.footerValue}>-{money(discountAmount)}</Text>
                </View>
              ) : null}
              
              <View style={styles.footerRow}>
                <Text style={styles.footerLabel}>
                  VAT {Number(invoice.vat_rate).toFixed(2)}%
                </Text>
                <Text style={styles.footerValue}>{money(vatAmount)}</Text>
              </View>

              <View style={styles.footerRow}>
                <Text style={[styles.footerLabel, styles.totalLabel, styles.totalRowLabel]}>
                  Total incl. VAT
                </Text>
                <Text style={[styles.footerValue, styles.totalValue, styles.totalRowValue]}>
                  {money(grossAfterDiscount)}
                </Text>
              </View>

              {showDepositDetails ? (
                <>
                  <View style={styles.footerRow}>
                    <Text style={styles.footerLabel}>
                      Deposit Required ({invoice.deposit_percent}%)
                    </Text>
                    <Text style={styles.footerValue}>{money(depositAmount)}</Text>
                  </View>

                  <View style={styles.footerRow}>
                    <Text style={styles.footerLabel}>Balance Due on Delivery</Text>
                    <Text style={styles.footerValue}>{money(balanceDue)}</Text>
                  </View>
                </>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.bold}>PAYMENT TERMS</Text>
              {splitTextLines(paymentTerms).map((line, index) => (
                <Text key={`${line}-${index}`}>{line}</Text>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.bold}>BANK DETAILS:</Text>
              {splitTextLines(bankDetails).map((line, index) => (
                <Text key={`${line}-${index}`}>{line}</Text>
              ))}
            </View>

            {invoice.card_payment_link ? (
              <View style={styles.section}>
                <Text style={styles.bold}>CARD PAYMENT:</Text>
                <View style={styles.cardBrandRow}>
                  {CARD_PAYMENT_BRANDS.map((brand) => (
                    // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image does not support alt text.
                    <Image
                      key={brand.label}
                      src={`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}${brand.src}`}
                      style={[
                        styles.cardBrandImage,
                        {
                          width: brand.width,
                          height: brand.height,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Link src={normalizeExternalUrl(invoice.card_payment_link)}>
                  <Text style={styles.cardPaymentLink}>View and pay online now</Text>
                </Link>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.bold}>Notes:</Text>
              {splitTextLines(notesText).map((line, index) => (
                <Text key={`${line}-${index}`}>{line}</Text>
              ))}
              <Text>Thank you for choosing Malta Gym Solutions!</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
