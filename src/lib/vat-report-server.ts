import type { SupabaseClient } from "@supabase/supabase-js";
import { buildExpenseRow, type FinancialReportSource, type ReportPeriod } from "@/src/lib/financial-report";
import { loadIncomeExpenseReport } from "@/src/lib/financial-report-server";
import { buildVatReport } from "@/src/lib/vat-report";

export async function loadVatPayments(supabase: SupabaseClient) {
  const payments: FinancialReportSource["expenses"] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    // Payment dates must not be restricted to the report dates: Q2 can be paid in Q3.
    const { data, error } = await supabase.from("expenses")
      .select("id, expense_date, supplier, description, category, vat_rate, amount_incl_vat, bank_account, vat_period_start, vat_period_end")
      .eq("category", "VAT")
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) {
      if (error.code === "42703" || error.code === "PGRST204") {
        throw new Error("VAT period setup is required before generating VAT reports. Apply database migration 022.");
      }
      throw new Error(error.message);
    }
    payments.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return payments.map(buildExpenseRow);
}

export async function loadVatReport(supabase: SupabaseClient, period: ReportPeriod) {
  const [report, payments] = await Promise.all([
    loadIncomeExpenseReport(supabase, period),
    loadVatPayments(supabase),
  ]);
  return buildVatReport(report, payments);
}
