import ExcelJS from "exceljs";
import {
  reportPeriodLabel,
  type IncomeExpenseReport,
  type ReportBreakdownRow,
  type ReportExpenseRow,
  type ReportIncomeRow,
} from "@/src/lib/financial-report";

const NAVY = "0F172A";
const SLATE = "475569";
const BORDER = "CBD5E1";
const GREEN = "047857";
const RED = "B91C1C";
const CURRENCY_FORMAT = '€#,##0.00;[Red]-€#,##0.00';

function styleTitle(sheet: ExcelJS.Worksheet, title: string, subtitle: string, endColumn: number) {
  sheet.mergeCells(1, 1, 1, endColumn);
  sheet.getCell(1, 1).value = title;
  sheet.getCell(1, 1).font = { size: 20, bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getCell(1, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  sheet.getCell(1, 1).alignment = { vertical: "middle" };
  sheet.getRow(1).height = 34;

  sheet.mergeCells(2, 1, 2, endColumn);
  sheet.getCell(2, 1).value = subtitle;
  sheet.getCell(2, 1).font = { size: 10, color: { argb: "FFCBD5E1" } };
  sheet.getCell(2, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  sheet.getRow(2).height = 22;
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SLATE } };
  row.alignment = { vertical: "middle" };
  row.height = 22;
  row.eachCell((cell) => {
    cell.border = { bottom: { style: "thin", color: { argb: BORDER } } };
  });
}

function styleBody(sheet: ExcelJS.Worksheet, startRow: number, endRow: number, currencyColumns: number[]) {
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    row.eachCell((cell) => {
      cell.border = { bottom: { style: "hair", color: { argb: "FFE2E8F0" } } };
      cell.alignment = { vertical: "top" };
    });
    currencyColumns.forEach((column) => {
      row.getCell(column).numFmt = CURRENCY_FORMAT;
      row.getCell(column).alignment = { horizontal: "right", vertical: "top" };
    });
  }
}

function configureSheet(sheet: ExcelJS.Worksheet, widths: number[]) {
  sheet.views = [{ state: "frozen", ySplit: 3, showGridLines: false }];
  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
}

function addBreakdownSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  title: string,
  subtitle: string,
  rows: ReportBreakdownRow[]
) {
  const sheet = workbook.addWorksheet(name);
  configureSheet(sheet, [30, 12, 18, 18, 18]);
  styleTitle(sheet, title, subtitle, 5);
  sheet.addRow(["Name", "Records", "Excl. VAT", "VAT", "Incl. VAT"]);
  styleHeader(sheet.getRow(3));
  rows.forEach((row) => {
    sheet.addRow([row.label, row.count, row.amountExclVat, row.vatAmount, row.amountInclVat]);
  });
  styleBody(sheet, 4, sheet.rowCount, [3, 4, 5]);
  sheet.autoFilter = { from: "A3", to: `E${Math.max(sheet.rowCount, 3)}` };
  return sheet;
}

function addIncomeSheet(
  workbook: ExcelJS.Workbook,
  subtitle: string,
  rows: ReportIncomeRow[]
) {
  const sheet = workbook.addWorksheet("Income Detail");
  configureSheet(sheet, [14, 20, 28, 18, 18, 18, 18]);
  styleTitle(sheet, "Income Detail", subtitle, 7);
  sheet.addRow(["Date", "Invoice", "Client", "Status", "Excl. VAT", "VAT", "Incl. VAT"]);
  styleHeader(sheet.getRow(3));
  rows.forEach((row) => {
    sheet.addRow([
      new Date(`${row.date}T00:00:00Z`),
      row.invoiceNumber,
      row.client,
      row.status,
      row.amountExclVat,
      row.vatAmount,
      row.amountInclVat,
    ]);
  });
  sheet.getColumn(1).numFmt = "dd/mm/yyyy";
  styleBody(sheet, 4, sheet.rowCount, [5, 6, 7]);
  sheet.autoFilter = { from: "A3", to: `G${Math.max(sheet.rowCount, 3)}` };
  return sheet;
}

function addExpenseSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  title: string,
  subtitle: string,
  rows: ReportExpenseRow[]
) {
  const sheet = workbook.addWorksheet(name);
  configureSheet(sheet, [14, 24, 38, 22, 16, 12, 18, 18, 18]);
  styleTitle(sheet, title, subtitle, 9);
  sheet.addRow([
    "Date",
    "Supplier",
    "Description",
    "Category",
    "Paid From",
    "VAT %",
    "Excl. VAT",
    "VAT",
    "Incl. VAT",
  ]);
  styleHeader(sheet.getRow(3));
  rows.forEach((row) => {
    sheet.addRow([
      new Date(`${row.date}T00:00:00Z`),
      row.supplier,
      row.description,
      row.category,
      row.paidFrom,
      row.vatRate / 100,
      row.amountExclVat,
      row.vatAmount,
      row.amountInclVat,
    ]);
  });
  sheet.getColumn(1).numFmt = "dd/mm/yyyy";
  sheet.getColumn(6).numFmt = "0%";
  styleBody(sheet, 4, sheet.rowCount, [7, 8, 9]);
  sheet.autoFilter = { from: "A3", to: `I${Math.max(sheet.rowCount, 3)}` };
  return sheet;
}

export async function buildFinancialReportWorkbook(report: IncomeExpenseReport) {
  const workbook = new ExcelJS.Workbook();
  const period = reportPeriodLabel(report.period);
  const subtitle = `${period} | Generated ${new Date(report.generatedAt).toLocaleString("en-GB")}`;

  workbook.creator = "Malta Gym Solutions";
  workbook.company = "Malta Gym Solutions";
  workbook.title = `Income and Expense Report - ${period}`;
  workbook.created = new Date(report.generatedAt);

  const summary = workbook.addWorksheet("Summary");
  configureSheet(summary, [30, 18, 18, 18]);
  styleTitle(summary, "MGS Income and Expense Report", subtitle, 4);
  summary.addRow(["Summary", "Excl. VAT", "VAT", "Incl. VAT"]);
  styleHeader(summary.getRow(3));
  summary.addRow([
    "Income",
    report.summary.incomeExclVat,
    report.summary.incomeVat,
    report.summary.incomeInclVat,
  ]);
  summary.addRow([
    "Expenses",
    report.summary.expensesExclVat,
    report.summary.recoverableVat,
    report.summary.expensesInclVat,
  ]);
  summary.addRow(["Net", report.summary.netExclVat, null, null]);
  summary.addRow(["VAT payments", null, null, report.summary.vatPayments]);
  summary.addRow([
    `Excluded expenses (${report.summary.excludedExpenseCount})`,
    null,
    null,
    report.summary.excludedExpenseAmount,
  ]);
  styleBody(summary, 4, 8, [2, 3, 4]);
  summary.getRow(6).font = { bold: true, color: { argb: report.summary.netExclVat < 0 ? RED : GREEN } };
  summary.getRow(8).font = { color: { argb: "FF92400E" } };

  summary.addRow([]);
  summary.addRow(["Monthly Performance", "Income excl. VAT", "Expenses excl. VAT", "Net excl. VAT"]);
  styleHeader(summary.getRow(10));
  report.monthly.forEach((row) => {
    summary.addRow([row.month, row.incomeExclVat, row.expensesExclVat, row.netExclVat]);
  });
  styleBody(summary, 11, summary.rowCount, [2, 3, 4]);
  summary.getColumn(4).eachCell({ includeEmpty: false }, (cell, rowNumber) => {
    if (rowNumber >= 11 && typeof cell.value === "number") {
      cell.font = { color: { argb: cell.value < 0 ? RED : GREEN } };
    }
  });

  addBreakdownSheet(workbook, "Expense Categories", "Expenses by Category", subtitle, report.expensesByCategory);
  addBreakdownSheet(workbook, "Suppliers", "Expenses by Supplier", subtitle, report.expensesBySupplier);
  addBreakdownSheet(workbook, "Income Status", "Income by Invoice Status", subtitle, report.incomeByStatus);
  addIncomeSheet(workbook, subtitle, report.incomeRows);
  addExpenseSheet(workbook, "Expense Detail", "Expense Detail", subtitle, report.expenseRows);

  if (report.excludedExpenseRows.length > 0) {
    const excluded = addExpenseSheet(
      workbook,
      "Excluded Expenses",
      "Expenses Excluded from Calculations",
      subtitle,
      report.excludedExpenseRows
    );
    excluded.getCell("A2").value = `${subtitle} | These records are not included in report totals.`;
    excluded.properties.tabColor = { argb: "FFF59E0B" };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
