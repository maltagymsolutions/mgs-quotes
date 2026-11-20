import type { BankAccount } from "@/src/lib/owners";

export const SALE_REFUND_FIELDS =
  "id, created_at, invoice_id, receipt_id, refund_date, amount, bank_account, reason";

export type SaleRefund = {
  id: string;
  created_at: string;
  invoice_id: string;
  receipt_id: string;
  refund_date: string;
  amount: number | string;
  bank_account: BankAccount;
  reason: string;
};

export function saleRefundError(error: { code?: string; message: string }) {
  if (error.code === "PGRST205" || error.code === "PGRST202") {
    return "Refund setup is required. Apply database migration 023.";
  }
  return error.message;
}

export function toCents(amount: number | string) {
  return Math.round(Number(amount) * 100);
}
