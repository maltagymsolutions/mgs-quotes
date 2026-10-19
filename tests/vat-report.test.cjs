/* eslint-disable @typescript-eslint/no-require-imports */
// Run with: node --test tests/vat-report.test.cjs
// Transpile the existing TypeScript modules without introducing a test dependency.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const test = require('node:test');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
  return resolveFilename.call(this, name.startsWith('@/') ? path.join(root, name.slice(2)) : name, ...args);
};
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText, filename);
const { buildIncomeExpenseReport, buildExpenseRow } = require('../src/lib/financial-report.ts');
const { buildVatReport } = require('../src/lib/vat-report.ts');
const { isValidVatPeriod, vatPaymentPeriodStatus } = require('../src/lib/vat-period.ts');
const { loadVatPayments } = require('../src/lib/vat-report-server.ts');
const { buildVatReportWorkbook } = require('../src/lib/vat-report-excel.ts');
const ExcelJS = require('exceljs');
const q2 = { from: '2026-04-01', to: '2026-06-30' };
const q3 = { from: '2026-07-01', to: '2026-09-30' };
function expense(overrides = {}) {
  return { id: 'payment', expense_date: '2026-07-22', category: 'VAT', supplier: 'MTCA', description: 'VAT Q2 2026', vat_rate: 0, amount_incl_vat: 1000, bank_account: 'APS', vat_period_start: q2.from, vat_period_end: q2.to, ...overrides };
}
function financial(period, expenses = []) {
  return buildIncomeExpenseReport({ invoices: [], invoiceItems: [], clients: [], expenses }, period);
}
function report(period, expenses = [expense()]) {
  return buildVatReport(financial(period), expenses.map(buildExpenseRow));
}

test('a Q2 payment made in Q3 settles Q2 only; cash reporting keeps the July date', () => {
  assert.equal(report(q2).summary.vatPayments, 1000);
  assert.equal(report(q2).summary.vatPosition, -1000);
  assert.equal(report(q3).summary.vatPayments, 0);
  assert.equal(report(q3).paymentRows.length, 0);
  const cash = financial(q3, [expense()]);
  assert.equal(cash.summary.vatPayments, 1000);
  assert.equal(cash.expenseRows[0].date, '2026-07-22');
  assert.equal(cash.summary.netExclVat, 0);
});

test('payments in a later year and multiple instalments are allocated by VAT period', () => {
  const r = report(q2, [expense({ expense_date: '2027-01-01', amount_incl_vat: 500 }), expense({ id: 'second', expense_date: '2027-02-01', amount_incl_vat: 500 })]);
  assert.equal(r.summary.vatPayments, 1000);
  assert.equal(r.paymentRows.length, 2);
});

test('unassigned or invalid legacy periods are flagged, never deducted', () => {
  const payments = [expense({ vat_period_start: null, vat_period_end: null }), expense({ id: 'incomplete', vat_period_end: null }), expense({ id: 'reversed', vat_period_end: '2026-01-01' })];
  for (const period of [q2, q3, { from: '', to: '' }]) {
    const r = report(period, payments);
    assert.equal(r.summary.vatPayments, 0);
    assert.equal(r.unassignedPaymentRows.length, 3);
  }
});

test('partial ranges do not deduct a whole quarter payment; inclusive and open bounds work', () => {
  const r = report({ from: '2026-04-01', to: '2026-04-30' });
  assert.equal(r.summary.vatPayments, 0);
  assert.equal(r.partialPeriodPaymentRows.length, 1);
  assert.equal(vatPaymentPeriodStatus(q2.from, q2.to, { from: '', to: q2.to }), 'included');
  assert.equal(vatPaymentPeriodStatus(q2.from, q2.to, { from: q2.from, to: '' }), 'included');
  assert.equal(vatPaymentPeriodStatus(q2.from, q2.to, { from: '2026-05-01', to: '' }), 'partial');
  assert.equal(report({ from: '', to: '' }).summary.vatPayments, 1000);
  assert.equal(report({ from: '2026-01-01', to: '2026-12-31' }).summary.vatPayments, 1000);
});

test('date validation rejects impossible dates and accepts leap days', () => {
  assert.equal(isValidVatPeriod('2026-02-29', '2026-03-31'), false);
  assert.equal(isValidVatPeriod('2024-02-29', '2024-03-31'), true);
  assert.equal(isValidVatPeriod('', ''), false);
  assert.equal(isValidVatPeriod('2026-07-01', '2026-06-30'), false);
});

test('hidden purchases still contribute input VAT and VAT settlements are not purchases', () => {
  const purchase = expense({ id: 'fuel', category: 'Fuel', vat_rate: 18, amount_incl_vat: 118, hidden_from_dashboard: true, vat_period_start: null, vat_period_end: null });
  const r = buildVatReport(financial(q3, [purchase, expense()]), [buildExpenseRow(expense())]);
  assert.equal(r.summary.recoverableInputVat, 18);
  assert.equal(r.purchaseRows.length, 1);
  assert.equal(r.summary.vatPayments, 0);
  assert.equal(r.summary.vatPosition, -18);
});

test('payment loader reads beyond 1000 rows without filtering on payment date', async () => {
  const ranges = [];
  const client = { from(table) {
    assert.equal(table, 'expenses');
    return { select(columns) {
      assert.ok(columns.includes('vat_period_start'));
      return { eq(key, value) {
        assert.equal(key, 'category'); assert.equal(value, 'VAT');
        return { order(key) {
          assert.equal(key, 'id');
          return { range(start, end) {
            ranges.push([start, end]);
            return Promise.resolve({ data: start === 0 ? Array.from({ length: 1000 }, (_, i) => expense({ id: String(i) })) : [expense({ id: 'last' })], error: null });
          } };
        } };
      } };
    } };
  } };
  const rows = await loadVatPayments(client);
  assert.equal(rows.length, 1001);
  assert.deepEqual(ranges, [[0, 999], [1000, 1999]]);
  assert.equal(rows[1000].vatPeriodStart, q2.from);
});

test('Excel totals and payment dates agree with the report; review sheets exclude unassigned amounts', async () => {
  const r = report(q2, [expense(), expense({ id: 'old', vat_period_start: null, vat_period_end: null })]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await buildVatReportWorkbook(r));
  assert.equal(workbook.getWorksheet('VAT Summary').getCell('B9').value, 1000);
  assert.equal(workbook.getWorksheet('VAT Summary').getCell('B10').value.result, -1000);
  const sheet = workbook.getWorksheet('VAT Payments');
  assert.equal(sheet.getCell('A4').value.toISOString().slice(0, 10), '2026-07-22');
  assert.equal(sheet.getCell('B4').value.toISOString().slice(0, 10), q2.from);
  assert.equal(sheet.getCell('C4').value.toISOString().slice(0, 10), q2.to);
  assert.equal(workbook.getWorksheet('Unassigned Payments').getCell('B4').value, 'Unassigned');
});
