import { evidenceResult } from './settlementEvidenceFixtures';
import { strict as assert } from 'assert';
import { missingResult } from './missingBillingFixtures';
import { test } from 'node:test';
import ExcelJS = require('exceljs');
import { PDFParse } from 'pdf-parse';
import { buildResult } from './domain';
import { fixturePlan, fixtureCatalog, fixtureReports } from './fixtures';
import { generateWorkspaceExcel, generateWorkspacePdf } from './artifacts';
import { buildSettlementResult } from './settlements';
import { settlementPlan, settlementCatalog, settlementDocument } from './settlementFixtures';
import { auditResult } from './reconciliationFixtures';

test('Excel preserves numeric totals, includes all details and treats source text as text', async () => {
  const plan = fixturePlan(); plan.report.splitByGroup = true;
  const reports = fixtureReports(); reports[0].siteName = '=1+1';
  const result = buildResult('test-id', plan, reports, fixtureCatalog());
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await generateWorkspaceExcel(result) as any);
  assert.equal(workbook.getWorksheet('요약')!.getCell('B5').value, 320000);
  assert.equal(workbook.getWorksheet('상세')!.rowCount, 3);
  assert.equal(workbook.getWorksheet('분석 결과')!.getCell('A2').value, '=1+1');
  assert.equal(workbook.getWorksheet('분석 결과')!.getCell('A2').type, ExcelJS.ValueType.String);
  assert.ok(workbook.worksheets.length >= 5);
});
test('PDF contains searchable Korean text and the same deterministic totals', async () => {
  const result = buildResult('pdf-test', fixturePlan(), fixtureReports(), fixtureCatalog());
  const bytes = await generateWorkspacePdf(result);
  const parser = new PDFParse({ data: bytes });
  try {
    const parsed = await parser.getText(); assert.ok(parsed.text.includes('320,000')); assert.ok(parsed.text.includes('일보'));
    assert.equal(parsed.total, 2, 'footer must not create extra blank pages');
    assert.ok(parsed.pages[0].text.includes('1 / 2')); assert.ok(parsed.pages[1].text.includes('2 / 2'));
  }
  finally { await parser.destroy(); }
});
test('amount-excluded report removes numeric amounts from every worksheet and PDF summary', async () => {
  const plan = fixturePlan(); plan.report.includeAmount = false;
  const result = buildResult('without-amount', plan, fixtureReports(), fixtureCatalog());
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await generateWorkspaceExcel(result) as any);
  workbook.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => assert.notEqual(cell.value, 320000))));
  const parser = new PDFParse({ data: await generateWorkspacePdf(result) });
  try { assert.equal((await parser.getText()).text.includes('320,000'), false); } finally { await parser.destroy(); }
});

test('settlement Excel and PDF use saved financial totals and do not label them as daily report amounts', async () => {
  const plan = settlementPlan(); plan.report.splitByGroup = true;
  const result = buildSettlementResult('settlement-files', plan, [settlementDocument()], settlementCatalog());
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await generateWorkspaceExcel(result) as any);
  assert.equal(workbook.getWorksheet('분석 결과')!.getCell('C2').value, 610000);
  assert.equal(workbook.getWorksheet('차감 비용')!.getCell('B2').value, 50000);
  assert.ok(workbook.getWorksheet('검증 1팀')); assert.equal(workbook.getWorksheet('정산 상세')!.rowCount, 11);
  const parser = new PDFParse({ data: await generateWorkspacePdf(result) });
  try { const value = (await parser.getText()).text; assert.ok(value.includes('610,000')); assert.ok(value.includes('정산 계산액')); assert.equal(value.includes('일보 산출액'), false); }
  finally { await parser.destroy(); }
  result.plan.report.includeAmount = false;
  const hidden = new PDFParse({ data: await generateWorkspacePdf(result) });
  try { assert.equal((await hidden.getText()).text.includes('610,000'), false); } finally { await hidden.destroy(); }
});

test('audit exports retain non-comparable statuses and omit every amount when excluded', async () => {
  const result = auditResult(); result.plan.report.splitByGroup = true;
  const book = new ExcelJS.Workbook(); await book.xlsx.load(await generateWorkspaceExcel(result) as any);
  assert.equal(book.getWorksheet('분석 결과')!.getCell('F2').value, 20000);
  assert.equal(book.getWorksheet('분석 결과')!.getCell('E4').value, '비교 불가');
  assert.equal(book.getWorksheet('대사 상세')!.rowCount, 6); assert.ok(book.getWorksheet('검증 1팀'));
  const pdf = new PDFParse({ data: await generateWorkspacePdf(result) });
  try { const parsed = await pdf.getText(); assert.ok(parsed.text.includes('20,000')); assert.ok(parsed.text.includes('원본 확인 불가')); assert.ok(parsed.text.includes('card_billing:2026-08:card')); } finally { await pdf.destroy(); }
  result.plan.report.includeAmount = false;
  const hidden = new ExcelJS.Workbook(); await hidden.xlsx.load(await generateWorkspaceExcel(result) as any);
  hidden.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => assert.ok(![50000, 70000, 20000, 150000, 170000].includes(cell.value as number)))));
  const noAmount = new PDFParse({ data: await generateWorkspacePdf(result) });
  try { const parsed = await noAmount.getText(); assert.equal(parsed.text.includes('20,000'), false); assert.ok(parsed.text.includes('금액 차이')); } finally { await noAmount.destroy(); }
});

test('missing billing exports separate candidate totals and coverage and preserve amount exclusion', async () => {
  const result = missingResult(); result.plan.report.splitByGroup = true;
  const book = new ExcelJS.Workbook(); await book.xlsx.load(await generateWorkspaceExcel(result) as any);
  assert.equal(book.getWorksheet('요약')!.getCell('B12').value, 130000);
  assert.equal(book.getWorksheet('분석 결과')!.rowCount, 8); assert.equal(book.getWorksheet('점검 범위')!.rowCount, 3);
  assert.equal(book.getWorksheet('연결 점검 상세')!.rowCount, 8); assert.ok(book.getWorksheet('1팀'));
  assert.equal(book.getWorksheet('정산 구성'), undefined);
  const pdf = new PDFParse({ data: await generateWorkspacePdf(result) });
  try { const parsed = await pdf.getText(); assert.ok(parsed.text.includes('130,000')); assert.ok(parsed.text.includes('미연결 후보')); assert.ok(parsed.text.includes('확정 정산 확인 불가')); assert.ok(parsed.text.includes('new-card')); assert.equal(parsed.text.includes('정산 계산액'), false); }
  finally { await pdf.destroy(); }
  result.plan.report.includeAmount = false;
  const hidden = new ExcelJS.Workbook(); await hidden.xlsx.load(await generateWorkspaceExcel(result) as any);
  hidden.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => assert.ok(![130000, 90000, 40000, 70000, 60000].includes(cell.value as number)))));
  const noAmount = new PDFParse({ data: await generateWorkspacePdf(result) });
  try { const parsed = await noAmount.getText(); assert.equal(parsed.text.includes('130,000'), false); assert.equal(parsed.text.includes('90,000'), false); assert.ok(parsed.text.includes('미연결 후보')); }
  finally { await noAmount.destroy(); }
});

test('evidence exports preserve non-comparable values, source links and amount exclusion', async () => {
  const result = evidenceResult(); result.plan.report.splitByGroup = true;
  const book = new ExcelJS.Workbook(); await book.xlsx.load(await generateWorkspaceExcel(result) as any);
  assert.equal(book.getWorksheet('분석 결과')!.rowCount, 5); assert.equal(book.getWorksheet('저장 근거 상세')!.rowCount, 5);
  assert.ok(book.getWorksheet('1팀')); assert.equal(book.getWorksheet('정산 구성'), undefined);
  const json = JSON.stringify(book.model); assert.ok(json.includes('비교 불가')); assert.ok(json.includes('support-sales')); assert.ok(!json.includes('private-worker'));
  const pdf = new PDFParse({ data: await generateWorkspacePdf(result) });
  try { const parsed = await pdf.getText(); assert.ok(parsed.text.includes('30,000')); assert.ok(parsed.text.includes('비교 근거 부족')); assert.ok(parsed.text.includes('support-sales')); assert.ok(!parsed.text.includes('private-worker')); assert.ok(!parsed.text.includes('확정 정산 상세')); }
  finally { await pdf.destroy(); }
  result.plan.report.includeAmount = false;
  const hidden = new ExcelJS.Workbook(); await hidden.xlsx.load(await generateWorkspaceExcel(result) as any);
  hidden.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => assert.ok(![30000, 270000, 180000, 150000].includes(cell.value as number)))));
  const noAmount = new PDFParse({ data: await generateWorkspacePdf(result) });
  try { const parsed = await noAmount.getText(); assert.ok(!parsed.text.includes('30,000')); assert.ok(!parsed.text.includes('270,000')); assert.ok(parsed.text.includes('비교 근거 부족')); }
  finally { await noAmount.destroy(); }
});
