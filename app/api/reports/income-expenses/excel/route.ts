import { NextResponse } from "next/server";
import { buildFinancialReportWorkbook } from "@/src/lib/financial-report-excel";
import {
  buildReportFilename,
  loadIncomeExpenseReport,
  parseReportPeriod,
} from "@/src/lib/financial-report-server";
import { createClient } from "@/src/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Please log in to export reports." }, { status: 401 });
    }

    const period = parseReportPeriod(request);
    const report = await loadIncomeExpenseReport(supabase, period);
    const workbook = await buildFinancialReportWorkbook(report);
    const filename = buildReportFilename(period, "xlsx");

    return new NextResponse(new Uint8Array(workbook), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to export Excel report.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

