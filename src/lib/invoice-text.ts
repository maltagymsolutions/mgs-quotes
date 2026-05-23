export const DEFAULT_INVOICE_BANK_DETAILS = [
  "Beneficiary: Luke Galea",
  "IBAN: LT59 3250 0534 4337 4796",
  "SWIFT/BIC: REVOLT21",
].join("\n");

export const DEFAULT_INVOICE_NOTES =
  "Price includes ground floor delivery and installation";

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
  const lines = [
    `Deposit required: ${formatMoney(depositAmount)} (${depositPercent}% of ${depositBasisLabel}).`,
    `Balance due on delivery: ${formatMoney(balanceDue)}.`,
  ];

  if (discountAmount > 0) {
    lines.push(`Discount applied: ${formatMoney(discountAmount)}.`);
  }

  lines.push(`Transfer the deposit quoting invoice number ${invoiceNumber} as reference.`);

  return lines.join("\n");
}

export function resolveCustomText(
  customText: string | null | undefined,
  defaultText: string
) {
  return customText?.trim() ? customText : defaultText;
}
