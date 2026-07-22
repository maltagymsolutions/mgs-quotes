import { NextResponse } from "next/server";
import {
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
      return NextResponse.json({ error: "Please log in to view reports." }, { status: 401 });
    }

    const period = parseReportPeriod(request);
    const report = await loadIncomeExpenseReport(supabase, period);
    return NextResponse.json(report, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to build report.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

