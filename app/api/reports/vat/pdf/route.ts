import React from "react";
import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { loadIncomeExpenseReport, parseReportPeriod } from "@/src/lib/financial-report-server";
import { createClient } from "@/src/lib/supabase-server";
import { buildVatReport } from "@/src/lib/vat-report";
import VatReportPdf from "@/src/pdf/VatReportPdf";

export const dynamic = "force-dynamic";

function filename(from: string, to: string) {
  const range = from || to ? `${from || "start"}-to-${to || "today"}` : "all-time";
  return `MGS-VAT-Report-${range}.pdf`;
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
    const report = buildVatReport(financialReport);
    const element = React.createElement(VatReportPdf, { report }) as React.ReactElement<never>;
    const stream = await renderToStream(element);

    return new NextResponse(stream as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename(period.from, period.to)}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to export VAT PDF report.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

