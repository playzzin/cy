const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ExcelJS = require('exceljs');
const { root, createClient, close, firestore: f } = require('./runtime.cjs');

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Pass the XLSX downloaded from the filtered browser view.');
  const client = createClient('ui-verify');
  const a = await f.getDocFromServer(f.doc(client.db, 'tax_invoice_issues', 'browser-a'));
  const b = await f.getDocFromServer(f.doc(client.db, 'tax_invoice_issues', 'browser-b'));
  assert.equal(a.data().supplyAmount, 350);
  assert.equal(b.exists(), false);
  const rows = await client.service.getIssuesByMonth(a.data().yearMonth);
  assert.equal(rows.length, 2);
  assert.equal(rows.filter(row => row.carriedFromIssueId === 'browser-deferred').length, 1);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const sheet = workbook.getWorksheet('발행리스트');
  assert.equal(sheet.rowCount, 2, 'Export contains the header and exactly one filtered row.');
  assert.equal(sheet.getCell('D2').value, '통합검증 이월업체');
  assert.equal(sheet.getCell('F2').value, 500);
  const output = path.join(root, 'artifacts/audits/taxinvoice-emulator-browser-results.json');
  fs.writeFileSync(output, JSON.stringify({ checkedAt: new Date().toISOString(), productionWrites: 0,
    persistedAmount: a.data().supplyAmount, deletedRowAbsent: !b.exists(), currentMonthCount: rows.length,
    carryoverCount: 1, exportedFilteredRowCount: sheet.rowCount - 1, exportedAmount: sheet.getCell('F2').value,
    screenshot: 'taxinvoice-emulator-delete-conflict.jpg' }, null, 2));
  fs.copyFileSync(file, path.join(root, 'artifacts/audits/taxinvoice-emulator-filtered.xlsx'));
  console.log('PASS browser persistence, deletion, duplicate carryover prevention and actual filtered XLSX contents');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(close);
