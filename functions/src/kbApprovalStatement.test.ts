import { strict as assert } from 'assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { analyzeKbApprovalPdf, KbApprovalReconciliationError, parseKbApprovalStatement } from './kbApprovalStatement';

// Synthetic text follows PDFParse's date/time/main-row/detail-row reading order.
const header = (normal = 25000, cancelled = 11000, count = '2/1') => `
고객님께서 조회하신 기간의 총 정상이용금액은 [${normal.toLocaleString('en-US')}원, $0.0]입니다.
조회구분 선택카드 카드번호 1234-56**-****-1234
조회기간 2026.09.01~2026.09.30 국내/해외 전체(국내/해외)
정상/취소(건)
국내 ${count}
정상/취소(금액)
국내 ${normal.toLocaleString('en-US')}원 / ${cancelled.toLocaleString('en-US')}원
해외 0/0 해외 $0.0 / $0.0
-승인내역결과:2026.09.01~2026.09.30 조회기준일:2026.10.02
부서번호 카드번호 가맹점명 결제방법 승인금액 승인구분 승인번호 과세유형
부서명 이용자명 업종 할부개월수 부가세 승인방식 상태 가맹점상태`;

const row = (amount: number, status = '정상', card = '1234', date = '2026.09.08') => `
${date}
09:20:30
00000 KM${card} 테스트 식당 일시불 ${amount.toLocaleString('en-US')} 국내 11111111 일반과세자
검증회사 테스트사용자 음식점 0 1,000 IC ${status} 정상`;

test('all pages reconcile gross approvals minus cancellation, without adding informational VAT', () => {
    const parsed = parseKbApprovalStatement([header() + row(11000), row(14000), row(-11000, '승인취소')]);
    assert.ok(parsed);
    assert.equal(parsed.statementMonth, '2026-09', 'The lookup date in October is not the statement month');
    assert.equal(parsed.grandTotalAmount, 14000);
    assert.equal(parsed.cards[0].subtotalAmount, 14000);
    assert.equal(parsed.cards[0].cardLast4, '1234');
    assert.deepEqual(parsed.cards[0].transactions.map((t) => t.amount), [11000, 14000, -11000]);
    assert.ok(parsed.cards[0].transactions.every((t) => t.date === '2026-09-08' && t.merchant === '테스트 식당'));
    assert.equal(parsed.cards[0].transactions[2].memo, '승인취소');
});

test('cancellation status signs a positive amount once; no cancellation leaves the gross total unchanged', () => {
    assert.equal(parseKbApprovalStatement([header() + row(11000) + row(14000) + row(11000, '승인취소')])?.grandTotalAmount, 14000);
    assert.equal(parseKbApprovalStatement([header(25000, 0, '2/0') + row(11000), row(14000)])?.grandTotalAmount, 25000);
});

test('equal normal and cancelled approvals keep a genuine zero total', () => {
    const parsed = parseKbApprovalStatement([header(11000, 11000, '1/1') + row(11000) + row(-11000, '승인취소')]);
    assert.equal(parsed?.grandTotalAmount, 0);
    assert.equal(parsed?.cards[0].transactions.length, 2);
});

test('identical legitimate approval rows are retained, not heuristically deduplicated', () => {
    const parsed = parseKbApprovalStatement([header(22000, 0, '2/0') + row(11000) + row(11000)]);
    assert.equal(parsed?.cards[0].transactions.length, 2);
    assert.equal(parsed?.grandTotalAmount, 22000);
});

test('missing pages, duplicate pages, changed amounts, and count mismatches fail closed', () => {
    const first = header() + row(11000);
    for (const pages of [
        [first],
        [first, row(14000), row(-11000, '승인취소'), row(14000)],
        [first, row(15000), row(-11000, '승인취소')],
        [header(25000, 11000, '3/1') + row(11000), row(14000), row(-11000, '승인취소')],
    ]) assert.throws(() => parseKbApprovalStatement(pages), KbApprovalReconciliationError);
});

test('equal net totals cannot hide missing offsetting normal and cancellation rows', () => {
    assert.throws(() => parseKbApprovalStatement([header() + row(14000)]), KbApprovalReconciliationError);
});

test('invalid date, negative normal amount, unsupported status and malformed row fail closed', () => {
    const base = header(11000, 0, '1/0');
    for (const bad of [row(11000, '정상', '1234', '2026.09.31'), row(11000, '정상', '1234', '2026.10.01'),
        row(-11000), row(11000, '불명'), row(11000).replace('국내 11111111', '국내 ?'),
        row(11000).replace('09:20:30', '')]) {
        assert.throws(() => parseKbApprovalStatement([base + bad]), KbApprovalReconciliationError);
    }
});

test('mismatched selected card and headline totals fail closed', () => {
    assert.throws(() => parseKbApprovalStatement([header(11000, 0, '1/0') + row(11000, '정상', '5678')]), KbApprovalReconciliationError);
    assert.throws(() => parseKbApprovalStatement([header(11000, 0, '1/0').replace('[11,000원', '[12,000원') + row(11000)]), KbApprovalReconciliationError);
});

test('multiple cards are grouped using visible transaction card numbers', () => {
    const parsed = parseKbApprovalStatement([header(25000, 0, '2/0').replace('카드번호 1234-56**-****-1234', '카드번호 전체')
        + row(11000) + row(14000, '정상', '5678')]);
    assert.deepEqual(parsed?.cards.map((c) => [c.cardLast4, c.subtotalAmount]), [['1234', 11000], ['5678', 14000]]);
});

test('unrelated statements, overseas amounts, installments and cross-month exports use the existing analysis', () => {
    assert.equal(parseKbApprovalStatement(['다른 카드사 청구금액 25,000원']), null);
    const text = header(11000, 0, '1/0') + row(11000);
    for (const unsupported of [text.replace('해외 0/0', '해외 1/0'), text.replace('$0.0 / $0.0', '$10.0 / $0.0'),
        text.replace('일시불', '할부'), text.replace('조회기간 2026.09.01', '조회기간 2026.08.01')]) {
        assert.equal(parseKbApprovalStatement([unsupported]), null);
    }
});

test('blank PDF extraction returns no deterministic result', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    assert.equal(await analyzeKbApprovalPdf(Buffer.from(await pdf.save())), null);
});

test('real PDF text extraction reads every page and preserves cancellation without AI', async () => {
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(require('@pdf-lib/fontkit'));
    const font = await pdf.embedFont(readFileSync(require.resolve('@fontsource/noto-sans-kr/files/noto-sans-kr-korean-400-normal.woff')), { subset: true });
    for (const text of [header() + row(11000), row(14000), row(-11000, '승인취소')]) {
        const page = pdf.addPage([1000, 840]);
        text.trim().split('\n').forEach((line, i) => page.drawText(line, { x: 30, y: 800 - i * 20, size: 10, font }));
    }
    const parsed = await analyzeKbApprovalPdf(Buffer.from(await pdf.save()));
    assert.equal(parsed?.grandTotalAmount, 14000);
    assert.deepEqual(parsed?.cards[0].transactions.map((t) => t.amount), [11000, 14000, -11000]);
});
