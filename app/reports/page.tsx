"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Download,
  FileSpreadsheet,
  FileText,
  Landmark,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { AppPage } from "@/src/components/app-page";
import {
  reportPeriodLabel,
  type IncomeExpenseReport,
  type ReportBreakdownRow,
} from "@/src/lib/financial-report";
import { type VatRateBreakdownRow, type VatReport } from "@/src/lib/vat-report";

type ReportMode = "income-expenses" | "vat";

function localIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function money(value: number) {
  return new Intl.NumberFormat("en-MT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function queryString(from: string, to: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export default function ReportsPage() {
  const today = useMemo(() => new Date(), []);
  const [dateFrom, setDateFrom] = useState(`${today.getFullYear()}-01-01`);
  const [dateTo, setDateTo] = useState(localIsoDate(today));
  const [reportMode, setReportMode] = useState<ReportMode>("income-expenses");
  const [report, setReport] = useState<IncomeExpenseReport | null>(null);
  const [vatReport, setVatReport] = useState<VatReport | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const loadReport = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setMessage("");

    try {
      const endpoint = reportMode === "vat" ? "/api/reports/vat" : "/api/reports/income-expenses";
      const response = await fetch(`${endpoint}${queryString(from, to)}`, {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load report.");
      }

      if (reportMode === "vat") {
        setVatReport(payload as VatReport);
      } else {
        setReport(payload as IncomeExpenseReport);
      }
    } catch (error) {
      if (reportMode === "vat") {
        setVatReport(null);
      } else {
        setReport(null);
      }
      setMessage(error instanceof Error ? error.message : "Unable to load report.");
    } finally {
      setLoading(false);
    }
  }, [reportMode]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadReport(dateFrom, dateTo), 0);
    return () => window.clearTimeout(timer);
  }, [dateFrom, dateTo, loadReport]);

  function selectPeriod(from: string, to: string) {
    setDateFrom(from);
    setDateTo(to);
  }

  function selectThisMonth() {
    const now = new Date();
    selectPeriod(localIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)), localIsoDate(now));
  }

  function selectThisYear() {
    const now = new Date();
    selectPeriod(`${now.getFullYear()}-01-01`, localIsoDate(now));
  }

  const exportQuery = queryString(dateFrom, dateTo);
  const exportBase = reportMode === "vat" ? "/api/reports/vat" : "/api/reports/income-expenses";
  const activeReport = reportMode === "vat" ? vatReport : report;

  return (
    <AppPage
      title="Financial Reports"
      description="Review income, expenses, and VAT for any period, then export a detailed Excel workbook or PDF report."
      actions={
        <>
          <a
            href={`${exportBase}/excel${exportQuery}`}
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-bold !text-white no-underline transition hover:bg-emerald-700"
          >
            <FileSpreadsheet size={16} aria-hidden="true" />
            Excel
          </a>
          <a
            href={`${exportBase}/pdf${exportQuery}`}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/25 px-3 text-sm font-bold !text-white no-underline transition hover:bg-white/10"
          >
            <FileText size={16} aria-hidden="true" />
            PDF
          </a>
        </>
      }
    >
      <div className="mb-5 inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm" role="tablist" aria-label="Report type">
        <button
          type="button"
          role="tab"
          aria-selected={reportMode === "income-expenses"}
          onClick={() => setReportMode("income-expenses")}
          className={`h-10 !rounded-md px-4 text-sm ${reportMode === "income-expenses" ? "!border-slate-950 !bg-slate-950 !text-white" : "!border-transparent !bg-white !text-slate-600"}`}
        >
          Income & Expenses
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={reportMode === "vat"}
          onClick={() => setReportMode("vat")}
          className={`inline-flex h-10 items-center gap-2 !rounded-md px-4 text-sm ${reportMode === "vat" ? "!border-slate-950 !bg-slate-950 !text-white" : "!border-transparent !bg-white !text-slate-600"}`}
        >
          <Landmark size={16} aria-hidden="true" />
          VAT Report
        </button>
      </div>

      <section className="mb-5 p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="!mb-1">Report Period</h2>
            <p className="m-0 text-sm text-slate-500">
              {reportMode === "vat"
                ? "Output VAT follows invoice issue dates. Recoverable VAT includes all expenses, even those hidden from dashboard calculations."
                : "Income follows invoice issue dates. Expenses marked as hidden are listed separately and excluded from totals."}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-40 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
              From
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) => setDateFrom(event.target.value)}
                className="mt-1 block h-10 w-full px-3 text-sm font-normal normal-case"
              />
            </label>
            <label className="min-w-40 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
              To
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) => setDateTo(event.target.value)}
                className="mt-1 block h-10 w-full px-3 text-sm font-normal normal-case"
              />
            </label>
            <button onClick={selectThisMonth} className="inline-flex h-10 items-center gap-2 px-3 text-sm">
              <CalendarDays size={15} aria-hidden="true" />
              Month
            </button>
            <button onClick={selectThisYear} className="h-10 !border-slate-300 !bg-white px-3 text-sm !text-slate-900">
              Year
            </button>
            <button onClick={() => selectPeriod("", "")} className="h-10 !border-slate-300 !bg-white px-3 text-sm !text-slate-900">
              All time
            </button>
            <button
              onClick={() => loadReport(dateFrom, dateTo)}
              disabled={loading}
              aria-label="Refresh report"
              title="Refresh report"
              className="flex h-10 w-10 items-center justify-center !border-slate-300 !bg-white !text-slate-900"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {message ? (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {message}
        </div>
      ) : null}

      {loading && !activeReport ? (
        <section className="p-8 text-center text-sm font-semibold text-slate-500">Preparing report...</section>
      ) : reportMode === "income-expenses" && report ? (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="m-0 text-lg font-bold text-slate-950">{reportPeriodLabel(report.period)}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {report.incomeRows.length} invoice(s) and {report.expenseRows.length} included expense(s)
              </p>
            </div>
            <div className="flex gap-2 text-xs font-semibold text-slate-500">
              <Download size={15} aria-hidden="true" />
              Exports use this exact report period
            </div>
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Income excl. VAT" value={report.summary.incomeExclVat} icon={TrendingUp} tone="green" />
            <Metric label="Expenses excl. VAT" value={report.summary.expensesExclVat} icon={TrendingDown} tone="red" />
            <Metric label="Net excl. VAT" value={report.summary.netExclVat} icon={WalletCards} tone={report.summary.netExclVat < 0 ? "red" : "green"} />
            <Metric label="Expenses incl. VAT" value={report.summary.expensesInclVat} icon={FileText} tone="slate" />
          </div>

          {report.summary.excludedExpenseCount > 0 ? (
            <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <strong>{report.summary.excludedExpenseCount} excluded expense(s)</strong> totalling {money(report.summary.excludedExpenseAmount)} remain visible in the exports but are not included in any totals.
            </div>
          ) : null}

          <div className="mb-5 grid gap-4 xl:grid-cols-2">
            <Breakdown title="Expenses by Category" rows={report.expensesByCategory} />
            <Breakdown title="Expenses by Supplier" rows={report.expensesBySupplier} />
          </div>

          <section className="mb-5 p-4 sm:p-5">
            <h2>Monthly Performance</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse">
                <thead>
                  <tr>
                    {['Month', 'Income excl. VAT', 'Expenses excl. VAT', 'Net excl. VAT'].map((heading) => (
                      <th key={heading} className={`border-b border-slate-200 px-3 py-3 text-xs uppercase tracking-[0.08em] text-slate-500 ${heading === 'Month' ? 'text-left' : 'text-right'}`}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.monthly.map((row) => (
                    <tr key={row.month}>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold">{row.month}</td>
                      <td className="border-b border-slate-100 px-3 py-3 text-right tabular-nums">{money(row.incomeExclVat)}</td>
                      <td className="border-b border-slate-100 px-3 py-3 text-right tabular-nums">{money(row.expensesExclVat)}</td>
                      <td className={`border-b border-slate-100 px-3 py-3 text-right font-bold tabular-nums ${row.netExclVat < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{money(row.netExclVat)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <DetailTable
            title="Income Detail"
            headings={["Date", "Invoice", "Client", "Status", "Excl. VAT", "VAT", "Incl. VAT"]}
            rows={report.incomeRows.map((row) => [row.date, row.invoiceNumber, row.client, row.status, money(row.amountExclVat), money(row.vatAmount), money(row.amountInclVat)])}
          />
          <DetailTable
            title="Expense Detail"
            headings={["Date", "Supplier", "Description", "Category", "Paid From", "Excl. VAT", "VAT", "Incl. VAT"]}
            rows={report.expenseRows.map((row) => [row.date, row.supplier, row.description, row.category, row.paidFrom, money(row.amountExclVat), money(row.vatAmount), money(row.amountInclVat)])}
          />
        </>
      ) : reportMode === "vat" && vatReport ? (
        <VatReportView report={vatReport} />
      ) : null}
    </AppPage>
  );
}

function VatReportView({ report }: { report: VatReport }) {
  const positionLabel = report.summary.vatPosition > 0 ? "VAT payable" : report.summary.vatPosition < 0 ? "VAT credit / overpaid" : "VAT settled";

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-lg font-bold text-slate-950">{reportPeriodLabel(report.period)}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {report.salesRows.length} sales invoice(s), {report.purchaseRows.length} purchase record(s), and {report.paymentRows.length} VAT payment(s)
          </p>
        </div>
        <div className="flex gap-2 text-xs font-semibold text-slate-500">
          <Download size={15} aria-hidden="true" />
          Exports use this exact report period
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Output VAT" value={report.summary.outputVat} icon={TrendingUp} tone="red" />
        <Metric label="Recoverable input VAT" value={report.summary.recoverableInputVat} icon={TrendingDown} tone="green" />
        <Metric label="VAT payments" value={report.summary.vatPayments} icon={Landmark} tone="slate" />
        <Metric label={positionLabel} value={report.summary.vatPosition} icon={WalletCards} tone={report.summary.vatPosition > 0 ? "red" : "green"} />
      </div>

      <div className={`mb-5 rounded-lg border p-4 text-sm ${report.summary.vatPosition > 0 ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
        <strong>{positionLabel}: {money(Math.abs(report.summary.vatPosition))}</strong>
        <span className="ml-2">Output VAT less recoverable input VAT and recorded VAT payments.</span>
      </div>

      {report.summary.dashboardHiddenExpenseCount > 0 ? (
        <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <strong>{report.summary.dashboardHiddenExpenseCount} dashboard-hidden expense(s)</strong> are included in this VAT calculation.
        </div>
      ) : null}

      <div className="mb-5 grid gap-4 xl:grid-cols-2">
        <VatRateBreakdown title="Sales by VAT Rate" rows={report.salesByVatRate} vatLabel="Output VAT" />
        <VatRateBreakdown title="Purchases by VAT Rate" rows={report.purchasesByVatRate} vatLabel="Input VAT" />
      </div>

      <DetailTable
        title="Sales VAT Detail"
        headings={["Date", "Invoice", "Client", "Status", "VAT Rate", "Taxable Amount", "Output VAT", "Incl. VAT"]}
        rows={report.salesRows.map((row) => [row.date, row.invoiceNumber, row.client, row.status, `${row.vatRate}%`, money(row.amountExclVat), money(row.vatAmount), money(row.amountInclVat)])}
      />
      <DetailTable
        title="Purchase VAT Detail"
        headings={["Date", "Supplier", "Description", "Category", "VAT Rate", "Taxable Amount", "Input VAT", "Incl. VAT"]}
        rows={report.purchaseRows.map((row) => [row.date, row.supplier, row.description, row.category, `${row.vatRate}%`, money(row.amountExclVat), money(row.vatAmount), money(row.amountInclVat)])}
      />
      {report.paymentRows.length > 0 ? (
        <DetailTable
          title="VAT Payments"
          headings={["Date", "Paid To", "Description", "Paid From", "Amount"]}
          rows={report.paymentRows.map((row) => [row.date, row.supplier, row.description, row.paidFrom, money(row.amountInclVat)])}
        />
      ) : null}
    </>
  );
}

function VatRateBreakdown({ title, rows, vatLabel }: { title: string; rows: VatRateBreakdownRow[]; vatLabel: string }) {
  return (
    <section className="min-w-0 p-4 sm:p-5">
      <h2>{title}</h2>
      {rows.length === 0 ? <p className="m-0 text-sm text-slate-500">No records in this period.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse">
            <thead>
              <tr>
                {['Rate', 'Records', 'Taxable Amount', vatLabel, 'Incl. VAT'].map((heading, index) => (
                  <th key={heading} className={`border-b border-slate-200 px-3 py-3 text-xs uppercase tracking-[0.08em] text-slate-500 ${index < 2 ? "text-left" : "text-right"}`}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.vatRate}>
                  <td className="border-b border-slate-100 px-3 py-3 font-bold">{row.vatRate}%</td>
                  <td className="border-b border-slate-100 px-3 py-3">{row.count}</td>
                  <td className="border-b border-slate-100 px-3 py-3 text-right tabular-nums">{money(row.taxableAmount)}</td>
                  <td className="border-b border-slate-100 px-3 py-3 text-right font-bold tabular-nums">{money(row.vatAmount)}</td>
                  <td className="border-b border-slate-100 px-3 py-3 text-right tabular-nums">{money(row.amountInclVat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof TrendingUp; tone: "green" | "red" | "slate" }) {
  const iconClass = tone === "green" ? "bg-emerald-50 text-emerald-700" : tone === "red" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-slate-600">{label}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-md ${iconClass}`}><Icon size={18} aria-hidden="true" /></span>
      </div>
      <strong className={`text-2xl tabular-nums ${value < 0 ? "text-red-700" : "text-slate-950"}`}>{money(value)}</strong>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: ReportBreakdownRow[] }) {
  return (
    <section className="min-w-0 p-4 sm:p-5">
      <h2>{title}</h2>
      {rows.length === 0 ? <p className="m-0 text-sm text-slate-500">No records in this period.</p> : (
        <div className="grid gap-2">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-slate-100 py-2 last:border-0">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-slate-800">{row.label}</div>
                <div className="mt-1 text-xs text-slate-500">{row.count} record(s) · {money(row.amountExclVat)} excl. VAT</div>
              </div>
              <strong className="text-sm tabular-nums">{money(row.amountInclVat)}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DetailTable({ title, headings, rows }: { title: string; headings: string[]; rows: string[][] }) {
  return (
    <section className="mb-5 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="!mb-0">{title}</h2>
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400">{rows.length} records</span>
      </div>
      {rows.length === 0 ? <p className="m-0 text-sm text-slate-500">No records in this period.</p> : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[920px] border-collapse">
            <thead><tr>{headings.map((heading, index) => <th key={heading} className={`border-b border-slate-200 px-3 py-3 text-xs uppercase tracking-[0.08em] text-slate-500 ${index >= headings.length - 3 ? "text-right" : "text-left"}`}>{heading}</th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => <tr key={`${row[0]}-${row[1]}-${rowIndex}`}>{row.map((value, index) => <td key={`${index}-${value}`} className={`border-b border-slate-100 px-3 py-3 text-sm ${index >= row.length - 3 ? "text-right tabular-nums" : "text-left"}`}>{value}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
