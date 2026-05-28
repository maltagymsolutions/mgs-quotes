export type PaymentReceiptType = "deposit" | "balance";

export type InvoiceTotalSource = {
  deposit_percent?: number | string | null;
  discount_amount_incl_vat?: number | string | null;
};

export type InvoiceItemTotalSource = {
  qty: number | string;
  sale_price_incl_vat: number | string;
};

export type PaymentReceiptTotalSource = {
  id?: string | null;
  receipt_type: PaymentReceiptType | string;
  receipt_date?: string | null;
  created_at?: string | null;
  amount_paid: number | string;
};

export const PAYMENT_RECEIPT_TYPE_LABELS: Record<PaymentReceiptType, string> = {
  deposit: "Deposit Payment",
  balance: "Balance Payment",
};

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateInvoiceReceiptTotals(
  invoice: InvoiceTotalSource,
  items: InvoiceItemTotalSource[]
) {
  const grossBeforeDiscount = roundMoney(
    items.reduce(
      (sum, item) => sum + Number(item.sale_price_incl_vat || 0) * Number(item.qty || 0),
      0
    )
  );
  const discountAmount = roundMoney(
    Math.min(Number(invoice.discount_amount_incl_vat || 0), grossBeforeDiscount)
  );
  const invoiceTotal = roundMoney(grossBeforeDiscount - discountAmount);
  const depositAmount = roundMoney(invoiceTotal * (Number(invoice.deposit_percent || 0) / 100));
  const balanceAmount = roundMoney(invoiceTotal - depositAmount);

  return {
    grossBeforeDiscount,
    discountAmount,
    invoiceTotal,
    depositAmount,
    balanceAmount,
  };
}

export function getDefaultReceiptAmount({
  receiptType,
  invoiceTotal,
  depositAmount,
  receipts,
  currentReceiptId,
}: {
  receiptType: PaymentReceiptType;
  invoiceTotal: number;
  depositAmount: number;
  receipts: PaymentReceiptTotalSource[];
  currentReceiptId?: string | null;
}) {
  if (receiptType === "deposit") {
    return depositAmount;
  }

  const paidOutsideCurrent = receipts
    .filter((receipt) => receipt.id !== currentReceiptId)
    .reduce((sum, receipt) => sum + Number(receipt.amount_paid || 0), 0);

  return roundMoney(Math.max(invoiceTotal - paidOutsideCurrent, 0));
}

function receiptSortRank(receipt: PaymentReceiptTotalSource) {
  return receipt.receipt_type === "deposit" ? 0 : 1;
}

export function calculateStillOwingAfterReceipt({
  invoiceTotal,
  receipts,
  receipt,
}: {
  invoiceTotal: number;
  receipts: PaymentReceiptTotalSource[];
  receipt: PaymentReceiptTotalSource;
}) {
  const allReceipts = receipts.some((row) => row.id && row.id === receipt.id)
    ? receipts
    : [...receipts, receipt];

  const sortedReceipts = [...allReceipts].sort((a, b) => {
    const rankDelta = receiptSortRank(a) - receiptSortRank(b);
    if (rankDelta !== 0) return rankDelta;

    const dateDelta = String(a.receipt_date || "").localeCompare(String(b.receipt_date || ""));
    if (dateDelta !== 0) return dateDelta;

    return String(a.created_at || a.id || "").localeCompare(String(b.created_at || b.id || ""));
  });

  let paidThroughReceipt = 0;

  for (const row of sortedReceipts) {
    paidThroughReceipt = roundMoney(paidThroughReceipt + Number(row.amount_paid || 0));

    if (row.id && row.id === receipt.id) {
      break;
    }
  }

  return roundMoney(Math.max(invoiceTotal - paidThroughReceipt, 0));
}
