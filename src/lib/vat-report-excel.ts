import ExcelJS from "exceljs";
import { reportPeriodLabel, type ReportExpenseRow, type ReportIncomeRow } from "@/src/lib/financial-report";
import { type VatRateBreakdownRow, type VatReport } from "@/src/lib/vat-report";

const NAVY = "0F172A";
const SLATE = "475569";
const BORDER = "CBD5E1";
const GREEN = "047857";
const RED = "B91C1C";
const CURRENCY_FORMAT = '€#,##0.00;[Red]-€#,##0.00';

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

function addRateSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  title: string,
  subtitle: string,
  rows: VatRateBreakdownRow[]
) {
  const sheet = workbook.addWorksheet(name);
  configureSheet(sheet, [16, 14, 21, 21, 21]);
  styleTitle(sheet, title, subtitle, 5);
  sheet.addRow(["VAT Rate", "Records", "Taxable Amount", "VAT", "Incl. VAT"]);
  styleHeader(sheet.getRow(3));
  rows.forEach((row) => {
    sheet.addRow([row.vatRate / 100, row.count, row.taxableAmount, row.vatAmount, row.amountInclVat]);
  });
  sheet.getColumn(1).numFmt = "0%";
  styleBody(sheet, 4, sheet.rowCount, [3, 4, 5]);
  return sheet;
}

function addSalesDetail(
  workbook: ExcelJS.Workbook,
  subtitle: string,
  rows: ReportIncomeRow[]
) {
  const sheet = workbook.addWorksheet("Sales Detail");
  configureSheet(sheet, [14, 20, 28, 17, 12, 18, 18, 18]);
  styleTitle(sheet, "Sales VAT Detail", subtitle, 8);
  sheet.addRow(["Date", "Invoice", "Client", "Status", "VAT Rate", "Taxable Amount", "Output VAT", "Incl. VAT"]);
  styleHeader(sheet.getRow(3));
  rows.forEach((row) => {
    sheet.addRow([
      new Date(`${row.date}T00:00:00Z`),
      row.invoiceNumber,
      row.client,
      row.status,
      row.vatRate / 100,
      row.amountExclVat,
      row.vatAmount,
      row.amountInclVat,
    ]);
  });
  sheet.getColumn(1).numFmt = "dd/mm/yyyy";
  sheet.getColumn(5).numFmt = "0%";
  styleBody(sheet, 4, sheet.rowCount, [6, 7, 8]);
  sheet.autoFilter = { from: "A3", to: `H${Math.max(sheet.rowCount, 3)}` };
}

function addPurchaseDetail(
  workbook: ExcelJS.Workbook,
  name: string,
  title: string,
  subtitle: string,
  rows: ReportExpenseRow[]
) {
  const sheet = workbook.addWorksheet(name);
  configureSheet(sheet, [14, 24, 36, 22, 16, 12, 18, 18, 18]);
  styleTitle(sheet, title, subtitle, 9);
  sheet.addRow(["Date", "Supplier", "Description", "Category", "Paid From", "VAT Rate", "Taxable Amount", "Input VAT", "Incl. VAT"]);
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
}

export async function buildVatReportWorkbook(report: VatReport) {
  const workbook = new ExcelJS.Workbook();
  const period = reportPeriodLabel(report.period);
  const subtitle = `${period} | Generated ${new Date(report.generatedAt).toLocaleString("en-GB")}`;

  workbook.creator = "Malta Gym Solutions";
  workbook.company = "Malta Gym Solutions";
  workbook.title = `VAT Report - ${period}`;
  workbook.created = new Date(report.generatedAt);

  const summary = workbook.addWorksheet("VAT Summary");
  configureSheet(summary, [34, 21]);
  styleTitle(summary, "MGS VAT Report", subtitle, 2);
  summary.addRow(["VAT Summary", "Amount"]);
  styleHeader(summary.getRow(3));
  summary.addRow(["Taxable sales", report.summary.taxableSales]);
  summary.addRow(["Output VAT", report.summary.outputVat]);
  summary.addRow(["Taxable purchases", report.summary.taxablePurchases]);
  summary.addRow(["Recoverable input VAT", report.summary.recoverableInputVat]);
  summary.addRow(["VAT due before payments", { formula: "B5-B7", result: report.summary.vatDueBeforePayments }]);
  summary.addRow(["VAT payments", report.summary.vatPayments]);
  summary.addRow(["VAT position after payments", { formula: "B8-B9", result: report.summary.vatPosition }]);
  styleBody(summary, 4, 10, [2]);
  summary.getRow(10).font = {
    bold: true,
    color: { argb: report.summary.vatPosition > 0 ? RED : GREEN },
  };
  summary.addRow([]);
  summary.addRow(["Positive VAT position means VAT remains payable. Dashboard-hidden expenses remain included in VAT calculations."]);
  summary.mergeCells(12, 1, 12, 2);
  summary.getCell("A12").font = { italic: true, color: { argb: "FF64748B" } };

  addRateSheet(workbook, "Sales by VAT Rate", "Sales by VAT Rate", subtitle, report.salesByVatRate);
  addRateSheet(workbook, "Purchases by VAT Rate", "Purchases by VAT Rate", subtitle, report.purchasesByVatRate);
  addSalesDetail(workbook, subtitle, report.salesRows);
  addPurchaseDetail(workbook, "Purchase Detail", "Purchase VAT Detail", subtitle, report.purchaseRows);
  if (report.paymentRows.length > 0) {
    addPurchaseDetail(workbook, "VAT Payments", "VAT Payment Detail", subtitle, report.paymentRows);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
