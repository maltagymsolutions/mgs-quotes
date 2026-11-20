import type { SupabaseClient } from "@supabase/supabase-js";
import { loadSaleRefunds } from "@/src/lib/sale-refunds";
import {
  buildIncomeExpenseReport,
  type IncomeExpenseReport,
  type FinancialReportSource,
  type ReportPeriod,
} from "@/src/lib/financial-report";

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parseReportPeriod(request: Request): ReportPeriod {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";

  if ((from && !isValidIsoDate(from)) || (to && !isValidIsoDate(to))) {
    throw new Error("Use dates in YYYY-MM-DD format.");
  }

  if (from && to && from > to) {
    throw new Error("The start date must be before the end date.");
  }

  return { from, to };
}

export async function loadIncomeExpenseReport(
  supabase: SupabaseClient,
  period: ReportPeriod
): Promise<IncomeExpenseReport> {
  let invoiceQuery = supabase
    .from("invoices")
    .select(
      "id, invoice_number, client_id, date_issued, status, vat_rate, discount_amount_incl_vat"
    )
    .neq("status", "Archived")
    .order("date_issued", { ascending: false });
  let expenseQuery = supabase
    .from("expenses")
    .select(
      "id, expense_date, supplier, description, category, vat_rate, amount_incl_vat, bank_account, hidden_from_dashboard"
    )
    .order("expense_date", { ascending: false });

  if (period.from) {
    invoiceQuery = invoiceQuery.gte("date_issued", period.from);
    expenseQuery = expenseQuery.gte("expense_date", period.from);
  }
  if (period.to) {
    invoiceQuery = invoiceQuery.lte("date_issued", period.to);
    expenseQuery = expenseQuery.lte("expense_date", period.to);
  }

  const [invoiceResult, expenseResult, datedRefunds, datedCreditNotes] = await Promise.all([
    invoiceQuery,
    expenseQuery,
    loadSaleRefunds(supabase, { ...period, dateColumn: "refund_date" }),
    loadSaleRefunds(supabase, { ...period, dateColumn: "credit_note_date" }),
  ]);

  if (invoiceResult.error) throw new Error(invoiceResult.error.message);
  if (expenseResult.error) throw new Error(expenseResult.error.message);

  const invoices = invoiceResult.data || [];
  const refunds = Array.from(new Map(
    [...datedRefunds, ...datedCreditNotes].map((refund) => [refund.id, refund])
  ).values());
  const invoiceIds = invoices.map((invoice) => invoice.id);
  const inPeriod = new Set(invoiceIds);
  const otherIds = [...new Set(refunds.map((refund) => refund.invoice_id))].filter((id) => !inPeriod.has(id));
  const refundInvoices: NonNullable<FinancialReportSource["refundInvoices"]> = [];
  for (let offset = 0; offset < otherIds.length; offset += 100) {
    const { data, error } = await supabase.from("invoices")
      .select("id, invoice_number, client_id, vat_rate, status")
      .in("id", otherIds.slice(offset, offset + 100));
    if (error) throw new Error(error.message);
    refundInvoices.push(...(data || []));
  }
  const clientIds = Array.from(
    new Set([...invoices, ...refundInvoices].map((invoice) => invoice.client_id).filter(Boolean))
  ) as string[];

  const [itemsResult, clientsResult] = await Promise.all([
    invoiceIds.length
      ? supabase
          .from("invoice_items")
          .select("invoice_id, qty, sale_price_incl_vat, item_discount_percent")
          .in("invoice_id", invoiceIds)
      : Promise.resolve({ data: [], error: null }),
    clientIds.length
      ? supabase
          .from("clients")
          .select("id, private_name, company_name")
          .in("id", clientIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (itemsResult.error) throw new Error(itemsResult.error.message);
  if (clientsResult.error) throw new Error(clientsResult.error.message);

  return buildIncomeExpenseReport(
    {
      invoices,
      refunds,
      refundInvoices,
      invoiceItems: itemsResult.data || [],
      clients: clientsResult.data || [],
      expenses: expenseResult.data || [],
    },
    period
  );
}

export function buildReportFilename(period: ReportPeriod, extension: "pdf" | "xlsx") {
  const range = period.from || period.to
    ? `${period.from || "start"}-to-${period.to || "today"}`
    : "all-time";
  return `MGS-Income-Expense-Report-${range}.${extension}`;
}
