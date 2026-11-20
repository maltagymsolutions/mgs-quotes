import type { BankAccount } from "@/src/lib/owners";
import type { SupabaseClient } from "@supabase/supabase-js";

export const SALE_REFUND_FIELDS =
  "id, created_at, invoice_id, receipt_id, refund_date, amount, bank_account, reason";

export const REPORT_REFUND_FIELDS = `${SALE_REFUND_FIELDS}, credit_note_number, credit_note_date, credit_note_vat_amount` as const;

export type SaleRefund = {
  id: string;
  created_at: string;
  invoice_id: string;
  receipt_id: string;
  refund_date: string;
  amount: number | string;
  bank_account: BankAccount;
  reason: string;
  credit_note_number?: string | null;
  credit_note_date?: string | null;
  credit_note_vat_amount?: number | string | null;
};

export function saleRefundError(error: { code?: string; message: string }) {
  if (error.message.includes("credit_note") && ["42703", "PGRST204", "PGRST202"].includes(error.code || "")) {
    return "Apply database migration 024 to enable refund reporting and credit notes.";
  }
  if (error.code === "PGRST205" || error.code === "PGRST202") {
    return "Refund setup is required. Apply database migration 023.";
  }
  return error.message;
}

export function toCents(amount: number | string) {
  return Math.round(Number(amount) * 100);
}

export function refundAmounts(amount: number | string, vatRate: number | string, creditedVat?: number | string | null) {
  const gross = toCents(amount);
  const net = creditedVat == null ? Math.round(gross / (1 + Number(vatRate) / 100)) : gross - toCents(creditedVat);
  return { amountInclVat: -gross / 100, amountExclVat: -net / 100, vatAmount: (net - gross) / 100 };
}

export async function loadSaleRefunds(
  supabase: SupabaseClient,
  filter?: { dateColumn: "refund_date" | "credit_note_date"; from: string; to: string }
): Promise<SaleRefund[]> {
  const refunds: SaleRefund[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    let query = supabase.from("sale_refunds").select(REPORT_REFUND_FIELDS).order("id");
    if (filter?.dateColumn === "credit_note_date") query = query.not("credit_note_date", "is", null);
    if (filter?.from) query = query.gte(filter.dateColumn, filter.from);
    if (filter?.to) query = query.lte(filter.dateColumn, filter.to);
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw new Error(saleRefundError(error));
    refunds.push(...((data || []) as SaleRefund[]));
    if (!data || data.length < pageSize) return refunds;
  }
}
