import React from "react";
import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import IncomeExpenseReportPdf from "@/src/pdf/IncomeExpenseReportPdf";
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
    const element = React.createElement(IncomeExpenseReportPdf, { report }) as React.ReactElement<never>;
    const stream = await renderToStream(element);
    const filename = buildReportFilename(period, "pdf");

    return new NextResponse(stream as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to export PDF report.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

