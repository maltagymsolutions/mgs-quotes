import { isPartialDeposit } from "@/src/lib/deposits";

export const DEFAULT_INVOICE_BANK_DETAILS = [
  "Account Name: MALTA GYM SOLUTIONS",
  "IBAN: MT32APSB77013000000050409410015",
  "BIC/SWIFT: APSBMTMTXXX",
  "Bank details: APS BANK LTD, APS CENTRE TOWER STREET, BIRKIRKARA",
].join("\n");

const LEGACY_REVOLUT_INVOICE_BANK_DETAILS = [
  "Beneficiary: Luke Galea",
  "IBAN: LT59 3250 0534 4337 4796",
  "SWIFT/BIC: REVOLT21",
].join("\n");

const LEGACY_APS_INVOICE_BANK_DETAILS = [
  "Account Name: ROBERT MALLIA & LUKE GALEA & KARL JOSEPH CAMILLERI T/A MALTA GYM SOLUTIONS",
  "IBAN: MT32APSB77013000000050409410015",
  "BIC/SWIFT: APSBMTMTXXX",
  "Bank details: APS BANK LTD, APS CENTRE TOWER STREET, BIRKIRKARA",
].join("\n");

export const DEFAULT_INVOICE_NOTES =
  "Price includes ground floor delivery. Installation is available for an additional €30.";

export function splitTextLines(value: string) {
  return value.split(/\r?\n/).filter((line) => line.trim().length > 0);
}

export function buildDefaultInvoicePaymentTerms({
  depositAmount,
  balanceDue,
  depositPercent,
  discountAmount,
  invoiceNumber,
  formatMoney,
}: {
  depositAmount: number;
  balanceDue: number;
  depositPercent: number | string;
  discountAmount: number;
  invoiceNumber: string;
  formatMoney: (value: number) => string;
}) {
  const depositBasisLabel = discountAmount > 0 ? "total after discount" : "total";
  const hasDeposit = isPartialDeposit(depositPercent);
  const lines = hasDeposit
    ? [
        `Deposit required: ${formatMoney(depositAmount)} (${depositPercent}% of ${depositBasisLabel}).`,
        `Balance due on delivery: ${formatMoney(balanceDue)}.`,
      ]
    : [];

  if (discountAmount > 0) {
    lines.push(`Discount applied: ${formatMoney(discountAmount)}.`);
  }

  lines.push(
    hasDeposit
      ? `Transfer the deposit quoting invoice number ${invoiceNumber} as reference.`
      : `Transfer payment quoting invoice number ${invoiceNumber} as reference.`
  );

  return lines.join("\n");
}

export function resolveCustomText(
  customText: string | null | undefined,
  defaultText: string
) {
  return customText?.trim() ? customText : defaultText;
}

export function resolveInvoiceBankDetails(customText: string | null | undefined) {
  const normalizedText = customText?.trim();

  if (
    !normalizedText ||
    normalizedText === LEGACY_REVOLUT_INVOICE_BANK_DETAILS ||
    normalizedText === LEGACY_APS_INVOICE_BANK_DETAILS
  ) {
    return DEFAULT_INVOICE_BANK_DETAILS;
  }

  return normalizedText;
}
