import { NextResponse } from "next/server";
import { loadIncomeExpenseReport, parseReportPeriod } from "@/src/lib/financial-report-server";
import { createClient } from "@/src/lib/supabase-server";
import { buildVatReport } from "@/src/lib/vat-report";
import { buildVatReportWorkbook } from "@/src/lib/vat-report-excel";

export const dynamic = "force-dynamic";

function filename(from: string, to: string) {
  const range = from || to ? `${from || "start"}-to-${to || "today"}` : "all-time";
  return `MGS-VAT-Report-${range}.xlsx`;
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Please log in to export reports." }, { status: 401 });
    }

    const period = parseReportPeriod(request);
    const financialReport = await loadIncomeExpenseReport(supabase, period);
    const workbook = await buildVatReportWorkbook(buildVatReport(financialReport));

    return new NextResponse(new Uint8Array(workbook), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename(period.from, period.to)}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to export VAT Excel report.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

