import { AI_EVIDENCE_METRICS, AI_EVIDENCE_STATUS_LABELS, AiEvidenceRow } from './contract';
import { readFileSync } from 'fs';
import PDFDocument = require('pdfkit');
import ExcelJS = require('exceljs');
import { AI_AUDIT_METRICS, AI_AUDIT_STATUS_LABELS, AI_GROUP_LABELS, AI_METRICS, AI_SETTLEMENT_METRICS, AiResult, AiAuditRow } from './contract';
import { detailGroup, WorkspaceError } from './domain';
import { AI_MISSING_METRICS, AI_MISSING_STATUS_LABELS, AiMissingBillingRow } from './contract';

export const resultMetadata = (result: AiResult): Array<[string, string | number]> => [
  ['보고서', result.plan.report.title || '일보 분석 보고서'], ['결과 ID', result.id], ['지표 버전', result.version],
  ['조회 시점', result.createdAt], ['조회 기간', result.plan.operation === 'search' ? '현재 마스터 기준 (기간 조건 미적용)' : `${result.plan.range.startDate} ~ ${result.plan.range.endDate}`],
  ['대상 조건', result.plan.filters.map(filter => `${filter.name} (${filter.id})`).join(', ') || '접근 가능한 전체'],
  ['추가 조건', [result.plan.status, result.plan.missingAccount ? '계좌 미등록' : ''].filter(Boolean).join(', ') || '없음'],
  ['비교 기간', result.plan.comparison ? `${result.plan.comparison.startDate} ~ ${result.plan.comparison.endDate}` : '비교 없음'],
  ['집계 기준', AI_GROUP_LABELS[result.plan.groupBy]], ['자료 상태', result.completeness === 'partial' ? '부분 결과' : '조회 완료'],
  ...[...(result.evidence ? AI_EVIDENCE_METRICS : result.missingBilling ? AI_MISSING_METRICS : result.reconciliation ? AI_AUDIT_METRICS : result.settlement ? AI_SETTLEMENT_METRICS : AI_METRICS)].filter(metric => result.plan.report.includeAmount || !['amount', 'net', 'costs'].includes(metric.id)).map(metric => [metric.label, metric.definition] as [string, string]),
  ...result.warnings.map(warning => ['참고', warning] as [string, string]),
];
type CellValue = string | number;
export const resultTable = (result: AiResult): { headers: string[]; rows: CellValue[][] } => {
  if (result.evidence) return evidenceTable(result, result.evidence.rows, false);
  if (result.missingBilling) return missingTable(result, result.missingBilling.rows, false);
  if (result.reconciliation) return auditTable(result, result.reconciliation.rows, false);
  if (result.settlement) return {
    headers: ['정산팀', '확정 건수', ...(result.plan.report.includeAmount ? ['정산 계산액(원)', '차감 합계(원)', ...(result.settlement.previousTotals ? ['전기 계산액(원)', '계산액 증감(원)'] : [])] : [])],
    rows: result.settlement.rows.map(row => [row.name, row.documents, ...(result.plan.report.includeAmount ? [row.net, row.deductions, ...(row.previous ? [row.previous.net, row.netChange || 0] : [])] : [])]),
  };
  if (result.plan.operation === 'search') return { headers: ['이름', '소속팀', '상태', '계좌 등록'], rows: result.records.map(row => [row.name, row.teamName, row.status, row.accountRegistered === null ? '확인 대상 아님' : row.accountRegistered ? '등록' : '미등록']) };
  const amount = result.plan.report.includeAmount;
  return { headers: [AI_GROUP_LABELS[result.plan.groupBy], '공수', '고유 작업자(명)', ...(amount ? ['일보 산출액(원)'] : []), ...(result.previousTotals ? ['전기 공수', '공수 증감률(%)', ...(amount ? ['전기 산출액(원)', '금액 증감률(%)'] : [])] : [])],
    rows: result.rows.map(row => [row.name, row.manDay, row.workers, ...(amount ? [row.amount] : []), ...(row.previous ? [row.previous.manDay, row.manDayChangePercent === null ? '기준값 0' : row.manDayChangePercent, ...(amount ? [row.previous.amount, row.amountChangePercent === null ? '기준값 0' : row.amountChangePercent] : [])] : [])]) };
};
const evidenceTable = (result: AiResult, rows: AiEvidenceRow[], details = true) => ({
  headers: ['정산팀', '항목', '상태', ...(result.plan.report.includeAmount ? ['정산 반영액(원)', '저장 근거액(원)', '차이(원)'] : []), '확인 사항', ...(details ? ['정산월', '근거 저장 시각', '근거 건수', '정산 문서 ID', '정산 항목 ID'] : [])],
  rows: rows.map(row => [row.teamName, row.category, AI_EVIDENCE_STATUS_LABELS[row.status], ...(result.plan.report.includeAmount ? [row.settledAmount ?? '비교 불가', row.evidenceAmount ?? '비교 불가', row.difference ?? '비교 불가'] : []), row.reason,
    ...(details ? [row.yearMonth, row.capturedAt || '확인 불가', row.evidenceCount ?? '확인 불가', row.settlementId || '확인 불가', row.lineIds.join(', ') || '개별 연결 없음'] : [])] as CellValue[]),
});
const evidenceSummary = (result: AiResult): CellValue[][] => [
  ['점검 항목', result.evidence!.rows.length], ...Object.entries(result.evidence!.counts).map(([key, count]) => [AI_EVIDENCE_STATUS_LABELS[key as keyof typeof AI_EVIDENCE_STATUS_LABELS], count] as CellValue[]),
  ...(result.plan.report.includeAmount ? [['비교 가능한 지원비 차이 절댓값 합계(원)', result.evidence!.absoluteDifference]] : []),
];
const auditTable = (result: AiResult, rows: AiAuditRow[], details = true) => ({
  headers: ['정산팀', '종류', '상태', ...(result.plan.report.includeAmount ? ['정산 반영액(원)', '현재 청구액(원)', '차이(원)'] : []), '확인 사항', ...(details ? ['정산월', '정산 문서 ID', '차감 항목 ID', '청구서 ID'] : [])],
  rows: rows.map(row => [row.teamName, row.category, AI_AUDIT_STATUS_LABELS[row.status], ...(result.plan.report.includeAmount ? [row.settledAmount, row.sourceAmount ?? '비교 불가', row.difference ?? '비교 불가'] : []), row.reason, ...(details ? [row.yearMonth, row.settlementId, row.lineId, row.sourceId || '확인 불가'] : [])] as CellValue[]),
});
const auditSummary = (result: AiResult): CellValue[][] => {
  const audit = result.reconciliation!;
  return [['대사 대상 차감 건수', audit.rows.length], ...Object.entries(audit.counts).map(([key, count]) => [AI_AUDIT_STATUS_LABELS[key as keyof typeof AI_AUDIT_STATUS_LABELS], count] as CellValue[]),
    ...(result.plan.report.includeAmount ? [['비교 가능한 정산 반영액', audit.comparedSettledAmount], ['비교 가능한 현재 청구액', audit.comparedSourceAmount], ['금액 차이 절댓값 합계', audit.absoluteDifference]] : [])];
};
const missingTable = (result: AiResult, rows: AiMissingBillingRow[], details = true) => ({
  headers: ['정산팀', '종류', '상태', ...(result.plan.report.includeAmount ? ['현재 청구액(원)'] : []), '확인 사항', ...(details ? ['정산월', '청구서 컬렉션', '청구서 ID', '정산 문서 ID', '차감 항목 ID'] : [])],
  rows: rows.map(row => [row.teamName, row.category, AI_MISSING_STATUS_LABELS[row.status], ...(result.plan.report.includeAmount ? [row.sourceAmount ?? '확인 불가'] : []), row.reason,
    ...(details ? [row.yearMonth, row.sourceCollection, row.sourceId, row.settlementId || '확인 불가', row.lineIds.join(', ') || '직접 연결 없음'] : [])] as CellValue[]),
});
const missingSummary = (result: AiResult): CellValue[][] => {
  const data = result.missingBilling!;
  return [['점검 팀', data.teams.length], ['확정 정산 확인 팀', data.teams.filter(team => team.confirmed).length], ['현재 확정 청구서', data.rows.length], ['미확정·취소 등 제외', data.excludedUnconfirmed],
    ...Object.entries(data.counts).map(([key, count]) => [AI_MISSING_STATUS_LABELS[key as keyof typeof AI_MISSING_STATUS_LABELS], count] as CellValue[]),
    ...(result.plan.report.includeAmount ? [['미연결 후보 현재 청구액 합계(원)', data.candidateAmount]] : [])];
};
const missingCoverage = (result: AiResult) => ({ headers: ['정산팀', '정산 확인', '대상 청구서 건수', '정산 문서 ID'],
  rows: result.missingBilling!.teams.map(team => [team.name, team.confirmed ? '확정 정산 확인' : '확정 정산 확인 불가', team.bills, team.settlementId || '확인 불가'] as CellValue[]),
});
const detailTable = (result: AiResult, rows = result.details) => ({
  headers: ['일자', '현장', '현장 담당팀', '작업자 소속팀', '작업자', '공수', ...(result.plan.report.includeAmount ? ['단가(원)', '산출액(원)'] : []), '일보 ID'],
  rows: rows.map(row => [row.date, row.siteName, row.responsibleTeamName, row.workerTeamName || '미지정', row.workerName, row.manDay,
    ...(result.plan.report.includeAmount ? [row.unitPrice, row.amount] : []), row.reportId] as CellValue[]),
});
const settlementDetails = (result: AiResult, rows = result.settlement!.details) => ({
  headers: ['정산팀', '정산월', '구분', '항목', ...(result.plan.report.includeAmount ? ['금액(원)'] : []), '확정 시각', '정산 문서 ID'],
  rows: rows.map(row => [row.teamName, row.yearMonth, row.section, row.category, ...(result.plan.report.includeAmount ? [row.amount] : []), row.confirmedAt, row.documentId] as CellValue[]),
});
const settlementSummary = (result: AiResult): CellValue[][] => {
  const totals = result.settlement!.totals;
  const names = { sales: '매출', purchases: '매입', deductions: '차감 합계', additions: '추가', prevCarryover: '전월 이월', deposit: '입금/정산조정', net: '정산 계산액', card: '카드 차감', accommodation: '숙소 차감', vehicle: '차량 차감', payroll: '급여 차감', other: '기타 차감' };
  return [['확정 정산 건수', totals.documents], ...(result.plan.report.includeAmount ? Object.entries(names).map(([key, label]) => [label, totals[key as keyof typeof totals]] as CellValue[]) : [])];
};
const settlementCosts = (result: AiResult) => ({ headers: ['정산팀', '카드', '숙소', '차량', '급여', '기타'],
  rows: result.settlement!.rows.map(row => [row.name, row.card, row.accommodation, row.vehicle, row.payroll, row.other] as CellValue[]),
});
const settlementComposition = (result: AiResult) => ({ headers: ['정산팀', '매출', '매입', '차감', '추가', '이월', '입금/정산조정'],
  rows: result.settlement!.rows.map(row => [row.name, row.sales, row.purchases, row.deductions, row.additions, row.prevCarryover, row.deposit] as CellValue[]),
});
export async function generateWorkspaceExcel(result: AiResult): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CY'; workbook.created = new Date(result.createdAt);
  const usedNames = new Set<string>();
  const sheet = (name: string, headers: string[], values: CellValue[][]) => {
    const base = name.replace(/[\\/?*[\]:]/g, '_').replace(/^'+|'+$/g, '').slice(0, 25) || '내역';
    let unique = base, count = 2;
    while (usedNames.has(unique.toLowerCase())) unique = `${base}_${count++}`;
    usedNames.add(unique.toLowerCase());
    const ws = workbook.addWorksheet(unique, { views: [{ state: 'frozen', ySplit: 1 }], pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    ws.addRow(headers); values.forEach(row => ws.addRow(row));
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF24496B' } };
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: values.length + 1, column: headers.length } };
    headers.forEach((header, index) => {
      ws.getColumn(index + 1).width = header.includes('ID') ? 34 : header.includes('일자') ? 14 : 23;
      ws.getColumn(index + 1).numFmt = header.includes('공수') || header.includes('증감률') ? '#,##0.0' : '#,##0';
    });
    ws.eachRow(row => { row.alignment = { vertical: 'top', wrapText: true }; });
    return ws;
  };
  const summary: CellValue[][] = result.evidence ? evidenceSummary(result) : result.missingBilling ? missingSummary(result) : result.reconciliation ? auditSummary(result) : result.settlement ? settlementSummary(result) : result.plan.operation === 'search' ? [['검색 건수', result.records.length]] : [
    ['공수', result.totals.manDay], ['고유 작업자', result.totals.workers], ['일보 건수', result.totals.reports],
    ...(result.plan.report.includeAmount ? [['일보 산출액', result.totals.amount]] : []),
  ];
  sheet('요약', ['항목', '값'], summary);
  const table = resultTable(result); sheet('분석 결과', table.headers, table.rows);
  if (result.evidence) {
    if (result.plan.report.includeDetails) { const detail = evidenceTable(result, result.evidence.rows); sheet('저장 근거 상세', detail.headers, detail.rows); }
    if (result.plan.report.splitByGroup) {
      const teams = [...new Map(result.evidence.rows.map(row => [row.teamId, row.teamName])).entries()];
      if (teams.length > 30) throw new WorkspaceError('resource-exhausted', '그룹별 시트는 최대 30개입니다. 대상을 좁혀 주세요.');
      for (const [id, name] of teams) { const detail = evidenceTable(result, result.evidence.rows.filter(row => row.teamId === id)); sheet(name, detail.headers, detail.rows); }
    }
  } else if (result.missingBilling) {
    const coverage = missingCoverage(result); sheet('점검 범위', coverage.headers, coverage.rows);
    if (result.plan.report.includeDetails) { const detail = missingTable(result, result.missingBilling.rows); sheet('연결 점검 상세', detail.headers, detail.rows); }
    if (result.plan.report.splitByGroup) {
      if (result.missingBilling.teams.length > 30) throw new WorkspaceError('resource-exhausted', '그룹별 시트는 최대 30개입니다. 대상을 좁혀 주세요.');
      for (const team of result.missingBilling.teams) { const detail = missingTable(result, result.missingBilling.rows.filter(row => row.teamId === team.id)); sheet(team.name, detail.headers, detail.rows); }
    }
  } else if (result.reconciliation) {
    if (result.plan.report.includeDetails) { const detail = auditTable(result, result.reconciliation.rows); sheet('대사 상세', detail.headers, detail.rows); }
    if (result.plan.report.splitByGroup) {
      const teams = [...new Map(result.reconciliation.rows.map(row => [row.teamId, row.teamName])).entries()];
      if (teams.length > 30) throw new WorkspaceError('resource-exhausted', '그룹별 시트는 최대 30개입니다. 대상을 좁혀 주세요.');
      for (const [id, name] of teams) { const detail = auditTable(result, result.reconciliation.rows.filter(row => row.teamId === id)); sheet(name, detail.headers, detail.rows); }
    }
  } else if (result.settlement) {
    if (result.plan.report.includeAmount) {
      const costs = settlementCosts(result), composition = settlementComposition(result);
      sheet('차감 비용', costs.headers, costs.rows); sheet('정산 구성', composition.headers, composition.rows);
    }
    if (result.plan.report.includeDetails) { const detail = settlementDetails(result); sheet('정산 상세', detail.headers, detail.rows); }
    if (result.plan.report.splitByGroup) {
      if (result.settlement.rows.length > 30) throw new WorkspaceError('resource-exhausted', '그룹별 시트는 최대 30개입니다. 대상을 좁혀 주세요.');
      for (const team of result.settlement.rows) {
        const detail = settlementDetails(result, result.settlement.details.filter(row => row.teamId === team.id));
        sheet(team.name, detail.headers, detail.rows);
      }
    }
  }
  if (result.plan.report.includeDetails && result.details.length) { const detail = detailTable(result); sheet('상세', detail.headers, detail.rows); }
  if (result.plan.report.splitByGroup && result.details.length) {
    if (result.rows.length > 30) throw new WorkspaceError('resource-exhausted', '그룹별 시트는 최대 30개입니다. 대상을 좁혀 주세요.');
    for (const group of result.rows) {
      const detail = detailTable(result, result.details.filter(row => detailGroup(row, result.plan).id === group.id));
      sheet(group.name, detail.headers, detail.rows);
    }
  }
  sheet('기준', ['항목', '내용'], resultMetadata(result));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function generateWorkspacePdf(result: AiResult): Promise<Buffer> {
  const detailCount = result.evidence?.rows.length ?? result.missingBilling?.rows.length ?? result.reconciliation?.rows.length ?? result.settlement?.details.length ?? result.details.length;
  if (result.plan.report.includeDetails && detailCount > 2000) throw new WorkspaceError('resource-exhausted', 'PDF 상세 내역은 2,000행까지 가능합니다. 엑셀을 이용하거나 기간을 좁혀 주세요.');
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true, info: { Title: result.plan.report.title || '일보 분석 보고서', Author: 'CY', CreationDate: new Date(result.createdAt) } });
  doc.registerFont('Korean', readFileSync(require.resolve('@fontsource/noto-sans-kr/files/noto-sans-kr-korean-400-normal.woff')));
  doc.font('Korean');
  const chunks: Buffer[] = [];
  const output = new Promise<Buffer>((resolve, reject) => { doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
  const width = 515, bottom = 770;
  const title = (value: string) => { doc.fontSize(15).fillColor('#153451').text(value, 40, doc.y, { width }); doc.moveDown(0.6); };
  const line = (value: string) => {
    doc.fontSize(9);
    const height = doc.heightOfString(value, { width });
    if (doc.y + height > bottom) doc.addPage();
    doc.fillColor('#25364A').text(value, 40, doc.y, { width }); doc.moveDown(0.3);
  };
  title(result.plan.report.title || '일보 분석 보고서');
  line(result.completeness === 'partial' ? '부분 결과 — 제외된 자료와 참고 사항을 확인해 주세요.' : '조회 결과');
  line(result.evidence ? '일보·지원비 저장 근거 점검' : result.missingBilling ? '정산 미연결 청구서 후보 점검' : result.reconciliation ? '확정 정산에 연결된 청구서 대사' : result.settlement ? `확정 정산 ${result.settlement.totals.documents}건` : result.plan.operation === 'search' ? result.summary : `일보 ${result.totals.reports}건 / 공수 ${result.totals.manDay} / 고유 작업자 ${result.totals.workers}명${result.plan.report.includeAmount ? ` / 일보 산출액 ${result.totals.amount.toLocaleString('ko-KR')}원` : ''}`);
  if (result.evidence) for (const [label, value] of evidenceSummary(result)) line(`${label}: ${typeof value === 'number' ? value.toLocaleString('ko-KR') : value}`);
  else if (result.missingBilling) for (const [label, value] of missingSummary(result)) line(`${label}: ${typeof value === 'number' ? value.toLocaleString('ko-KR') : value}`);
  else if (result.reconciliation) for (const [label, value] of auditSummary(result)) line(`${label}: ${typeof value === 'number' ? value.toLocaleString('ko-KR') : value}`);
  else if (result.settlement) for (const [label, value] of settlementSummary(result).slice(1)) line(`${label}: ${typeof value === 'number' ? value.toLocaleString('ko-KR') : value}원`);
  for (const [key, value] of resultMetadata(result).filter(([key]) => !['보고서', '지표 버전'].includes(key))) line(`${key}: ${value}`);
  line('PDF 표의 긴 텍스트는 240자까지 표시합니다. 전체 값은 엑셀에서 확인할 수 있습니다.');
  doc.moveDown();
  const chartRows = result.evidence ? Object.entries(result.evidence.counts).map(([key, count]) => ({ name: AI_EVIDENCE_STATUS_LABELS[key as keyof typeof AI_EVIDENCE_STATUS_LABELS], manDay: count })) : result.missingBilling ? Object.entries(result.missingBilling.counts).map(([key, count]) => ({ name: AI_MISSING_STATUS_LABELS[key as keyof typeof AI_MISSING_STATUS_LABELS], manDay: count })) : result.reconciliation ? Object.entries(result.reconciliation.counts).map(([key, count]) => ({ name: AI_AUDIT_STATUS_LABELS[key as keyof typeof AI_AUDIT_STATUS_LABELS], manDay: count })) : result.settlement ? (result.plan.report.includeAmount ? [
    { name: '카드', manDay: result.settlement.totals.card }, { name: '숙소', manDay: result.settlement.totals.accommodation },
    { name: '차량', manDay: result.settlement.totals.vehicle }, { name: '급여', manDay: result.settlement.totals.payroll }, { name: '기타', manDay: result.settlement.totals.other },
  ] : []) : result.rows;
  if (chartRows.length) {
    if (doc.y + 220 > bottom) doc.addPage();
    title(result.evidence ? '저장 근거 점검 상태 (건)' : result.missingBilling ? '청구서 연결 점검 상태 (건)' : result.reconciliation ? '청구서 대사 상태 (건)' : result.settlement ? '확정 정산 차감 비용 (원)' : '그룹별 공수');
    const maximum = Math.max(1, ...chartRows.map(row => row.manDay));
    chartRows.slice(0, 8).forEach(row => {
      if (doc.y + 35 > bottom) doc.addPage();
      const y = doc.y;
      doc.fontSize(8).fillColor('#25364A').text(row.name, 40, y, { width: 145, height: 25, ellipsis: true });
      doc.rect(190, y + 3, 280 * row.manDay / maximum, 8).fill('#537DAB');
      doc.fillColor('#25364A').text(String(row.manDay), 480, y, { width: 75, align: 'right' });
      doc.y = y + 30;
    });
    doc.moveDown();
  }
  const table = (headers: string[], rows: CellValue[][], widths: number[]) => {
    let y = doc.y;
    const draw = (values: CellValue[], heading = false) => {
      doc.fontSize(8);
      const cells = values.map(value => typeof value === 'number' ? value.toLocaleString('ko-KR') : value.length > 240 ? `${value.slice(0, 239)}…` : value);
      const height = Math.max(24, ...cells.map((value, index) => doc.heightOfString(value, { width: widths[index] - 10 }) + 12));
      if (y + height > bottom) { doc.addPage(); y = 40; if (!heading) draw(headers, true); }
      let x = 40;
      if (heading) doc.rect(x, y, width, height).fill('#EAF0F6');
      cells.forEach((value, index) => { doc.fillColor('#153451').text(value, x + 5, y + 6, { width: widths[index] - 10, lineBreak: true }); x += widths[index]; });
      doc.moveTo(40, y + height).lineTo(40 + width, y + height).strokeColor('#DAE1EA').stroke();
      y += height; doc.y = y;
    };
    draw(headers, true); rows.forEach(row => draw(row)); doc.y = y + 14;
  };
  const values = resultTable(result);
  const widths = values.headers.length === 4 ? [185, 110, 110, 110] : values.headers.map((_, index) => index === 0 ? 155 : 360 / (values.headers.length - 1));
  if (result.evidence) table(['정산팀 / 항목', '상태 / 확인 사항', ...(result.plan.report.includeAmount ? ['반영액(원)', '근거액(원)', '차이(원)'] : [])], result.evidence.rows.map(row => [
    `${row.teamName}\n${row.category}`, `${AI_EVIDENCE_STATUS_LABELS[row.status]}\n${row.reason}`, ...(result.plan.report.includeAmount ? [row.settledAmount ?? '비교 불가', row.evidenceAmount ?? '비교 불가', row.difference ?? '비교 불가'] : []),
  ]), result.plan.report.includeAmount ? [100, 205, 70, 70, 70] : [160, 355]);
  else if (result.missingBilling) table(['정산팀 / 종류', '상태 / 확인 사항', ...(result.plan.report.includeAmount ? ['현재 청구액(원)'] : [])], result.missingBilling.rows.map(row => [
    `${row.teamName}\n${row.category}`, `${AI_MISSING_STATUS_LABELS[row.status]}\n${row.reason}`, ...(result.plan.report.includeAmount ? [row.sourceAmount ?? '확인 불가'] : []),
  ]), result.plan.report.includeAmount ? [110, 305, 100] : [140, 375]);
  else if (result.reconciliation) table(['정산팀 / 종류', '상태 / 확인 사항', ...(result.plan.report.includeAmount ? ['반영액(원)', '청구액(원)', '차이(원)'] : [])], result.reconciliation.rows.map(row => [
    `${row.teamName}\n${row.category}`, `${AI_AUDIT_STATUS_LABELS[row.status]}\n${row.reason}`, ...(result.plan.report.includeAmount ? [row.settledAmount, row.sourceAmount ?? '비교 불가', row.difference ?? '비교 불가'] : []),
  ]), result.plan.report.includeAmount ? [90, 185, 80, 80, 80] : [160, 355]);
  else table(values.headers, values.rows, widths);
  if (result.settlement && !result.reconciliation && !result.missingBilling && !result.evidence && result.plan.report.includeAmount) {
    for (const [label, values] of [['팀별 정산 구성 (원)', settlementComposition(result)], ['팀별 차감 비용 (원)', settlementCosts(result)]] as const) {
      if (doc.y + 110 > bottom) doc.addPage();
      title(label);
      table(values.headers, values.rows, values.headers.map((_, index) => index === 0 ? 125 : 390 / (values.headers.length - 1)));
    }
  }
  if (result.evidence) {
    if (result.plan.report.includeDetails && result.evidence.rows.length) {
      doc.addPage(); title('저장 근거 출처');
      table(['정산팀 / 항목', '정산 문서 / 항목 ID', '근거 저장 시각 / 건수'], result.evidence.rows.map(row => [
        `${row.teamName}\n${row.category}`, `${row.settlementId || '확인 불가'}\n${row.lineIds.join(', ') || '개별 연결 없음'}`, `${row.capturedAt || '확인 불가'}\n${row.evidenceCount ?? '확인 불가'}`,
      ]), [130, 235, 150]);
    }
  } else if (result.missingBilling) {
    doc.addPage(); title('팀별 점검 범위');
    const coverage = missingCoverage(result); table(coverage.headers, coverage.rows, [110, 140, 65, 200]);
    if (result.plan.report.includeDetails && result.missingBilling.rows.length) {
      title('청구서 연결 근거');
      table(['정산팀 / 월 / 청구서', '정산 문서 / 차감 항목', '상태'], result.missingBilling.rows.map(row => [
        `${row.teamName}\n${row.yearMonth}\n${row.sourceCollection}/${row.sourceId}`, `${row.settlementId || '정산 확인 불가'}\n${row.lineIds.join(', ') || '직접 연결 없음'}`, AI_MISSING_STATUS_LABELS[row.status],
      ]), [195, 220, 100]);
    }
  } else if (result.reconciliation && result.plan.report.includeDetails && result.reconciliation.rows.length) {
    doc.addPage(); title('청구서 대사 근거');
    table(['정산팀 / 월 / 정산 문서', '차감 항목 / 현재 청구서', '상태'], result.reconciliation.rows.map(row => [
      `${row.teamName}\n${row.yearMonth}\n${row.settlementId}`, `${row.lineId}\n청구서: ${row.sourceId || '확인 불가'}`, AI_AUDIT_STATUS_LABELS[row.status],
    ]), [185, 235, 95]);
  } else if (result.settlement && result.plan.report.includeDetails && result.settlement.details.length) {
    doc.addPage(); title('확정 정산 상세');
    table(['정산월 / 팀 / 문서 ID', '구분 / 항목', ...(result.plan.report.includeAmount ? ['금액(원)'] : [])], result.settlement.details.map(row => [
      `${row.yearMonth}\n${row.teamName}\n${row.documentId}`, `${row.section}\n${row.category}`, ...(result.plan.report.includeAmount ? [row.amount] : []),
    ]), result.plan.report.includeAmount ? [205, 190, 120] : [260, 255]);
  }
  if (result.plan.report.includeDetails && result.details.length) {
    doc.addPage(); title('일보 상세 내역');
    table(['일자 / 현장 / 일보 ID', '작업자 / 팀', '공수', ...(result.plan.report.includeAmount ? ['산출액(원)'] : [])], result.details.map(row => [
      `${row.date}\n${row.siteName}\n${row.reportId}`, `${row.workerName}\n${row.workerTeamName || '미지정'}`, row.manDay, ...(result.plan.report.includeAmount ? [row.amount] : []),
    ]), result.plan.report.includeAmount ? [175, 170, 60, 110] : [220, 220, 75]);
  }
  const pages = doc.bufferedPageRange();
  for (let index = 0; index < pages.count; index++) {
    doc.switchToPage(index); doc.fontSize(8).fillColor('#526176').text(`${index + 1} / ${pages.count}`, 40, 778, { width, align: 'right', lineBreak: false });
  }
  doc.end();
  return output;
}
