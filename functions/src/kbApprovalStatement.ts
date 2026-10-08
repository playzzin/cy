// KB approval exports show VAT as part of the approval amount, not an extra charge.
// Only accept itemized domestic, single-payment exports whose counts and totals reconcile.
type Category = 'FUEL' | 'TOLL' | 'MEAL' | 'MATERIAL' | 'OTHER';

interface ApprovalTransaction {
    date: string;
    merchant: string;
    amount: number;
    category: Category;
    memo: string;
    confidence: number;
}

export interface KbApprovalStatement {
    bankName: string;
    statementMonth: string;
    grandTotalAmount: number;
    cards: Array<{
        cardLast4: string;
        cardName: string;
        holderName: string;
        subtotalAmount: number;
        transactions: ApprovalTransaction[];
        warnings: string[];
        confidence: number;
    }>;
    warnings: string[];
}

export class KbApprovalReconciliationError extends Error {
    constructor(reason: string) {
        super(`KB 승인내역 원본 대사 실패: ${reason} PDF 전체 페이지를 확인해 주세요.`);
        this.name = 'KbApprovalReconciliationError';
    }
}

const krw = (value: string): number => Number(value.replace(/,/g, ''));
const validDate = (value: string): boolean => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const categoryFor = (merchant: string): Category => {
    if (/주유|충전소/.test(merchant)) return 'FUEL';
    if (/하이패스|통행료|도로공사/.test(merchant)) return 'TOLL';
    if (/식당|음식|국밥|김밥|카페|커피|일레븐|편의점/.test(merchant)) return 'MEAL';
    if (/철물|건재|공구|자재/.test(merchant)) return 'MATERIAL';
    return 'OTHER';
};

export const parseKbApprovalStatement = (pages: readonly string[]): KbApprovalStatement | null => {
    const lines = pages.flatMap((page) => page.replace(/\u00a0/g, ' ').split(/\r?\n/)
        .map((line) => line.replace(/[\t ]+/g, ' ').trim()).filter(Boolean));
    const text = lines.join('\n');
    if (!/총\s*정상이용금액/.test(text) || !/승인내역결과/.test(text)
        || !/부서번호 카드번호 가맹점명 결제방법 승인금액 승인구분 승인번호/.test(text)
        || !/\bKM\d{4}\b/.test(text)) return null;

    // Foreign currency and installments need the issuer's payable amounts, not approval sums.
    const foreignCounts = /해외\s+(\d+)\s*\/\s*(\d+)/.exec(text);
    const foreignAmounts = /해외\s+\$([\d,.]+)\s*\/\s*\$([\d,.]+)/.exec(text);
    if (!foreignCounts || !foreignAmounts || [...foreignCounts.slice(1), ...foreignAmounts.slice(1)].some((v) => krw(v) !== 0)
        || lines.some((line) => /^\d{5}\s+KM\d{4}\s+/.test(line) && !/ 일시불 /.test(line))) return null;

    const period = /조회기간\s+(20\d{2}\.\d{2}\.\d{2})\s*~\s*(20\d{2}\.\d{2}\.\d{2})/.exec(text);
    if (!period) return null;
    const start = period[1].replace(/\./g, '-');
    const end = period[2].replace(/\./g, '-');
    if (!validDate(start) || !validDate(end) || start > end || start.slice(0, 7) !== end.slice(0, 7)) return null;

    const counts = /국내\s+(\d+)\s*\/\s*(\d+)/.exec(text);
    const totals = /국내\s+([\d,]+)원\s*\/\s*([\d,]+)원/.exec(text);
    const headline = /총\s*정상이용금액[^\d\n]*([\d,]+)원/.exec(text);
    if (!counts || !totals || !headline) throw new KbApprovalReconciliationError('정상·취소 요약을 읽을 수 없습니다.');
    const normalCount = Number(counts[1]);
    const cancelCount = Number(counts[2]);
    const normalTotal = krw(totals[1]);
    const cancelTotal = krw(totals[2]);
    if (![normalTotal, cancelTotal, normalCount, cancelCount].every(Number.isSafeInteger)
        || krw(headline[1]) !== normalTotal) throw new KbApprovalReconciliationError('요약 금액이 서로 다릅니다.');

    const cards = new Map<string, KbApprovalStatement['cards'][number]>();
    let observedNormalCount = 0;
    let observedCancelCount = 0;
    let observedNormalTotal = 0;
    let observedCancelTotal = 0;
    for (let i = 0; i < lines.length; i += 1) {
        if (!/^\d{5}\s+KM\d{4}\s+/.test(lines[i])) continue;
        const row = /^\d{5}\s+KM(\d{4})\s+(.+?)\s+일시불\s+(-?[\d,]+)\s+국내\s+\d+\s+\S+$/.exec(lines[i]);
        const date = (lines[i - 2] || '').replace(/\./g, '-');
        const detail = /\s(\d+)\s+(-?[\d,]+)\s+\S+\s+(정상|승인취소)\s+\S+$/.exec(lines[i + 1] || '');
        if (!row || !detail || detail[1] !== '0' || !validDate(date) || date < start || date > end
            || !/^\d{2}:\d{2}:\d{2}$/.test(lines[i - 1] || '')) {
            throw new KbApprovalReconciliationError('거래 행의 날짜·금액·상태를 확인할 수 없습니다.');
        }
        const cancelled = detail[3] === '승인취소';
        const rawAmount = krw(row[3]);
        if (!Number.isSafeInteger(rawAmount) || (!cancelled && rawAmount < 0)) {
            throw new KbApprovalReconciliationError('승인 금액과 취소 상태가 일치하지 않습니다.');
        }
        const amount = cancelled ? -Math.abs(rawAmount) : rawAmount;
        if (cancelled) {
            observedCancelCount += 1;
            observedCancelTotal += Math.abs(amount);
        } else {
            observedNormalCount += 1;
            observedNormalTotal += amount;
        }
        const card = cards.get(row[1]) || {
            cardLast4: row[1], cardName: 'KB국민카드', holderName: '', subtotalAmount: 0,
            transactions: [], warnings: [], confidence: 1,
        };
        card.transactions.push({ date, merchant: row[2], amount, category: categoryFor(row[2]),
            memo: cancelled ? '승인취소' : '', confidence: 1 });
        card.subtotalAmount += amount;
        cards.set(row[1], card);
    }
    if (!cards.size || observedNormalCount !== normalCount || observedCancelCount !== cancelCount
        || observedNormalTotal !== normalTotal || observedCancelTotal !== cancelTotal) {
        throw new KbApprovalReconciliationError('전체 거래의 정상·취소 건수 또는 금액이 요약과 일치하지 않습니다.');
    }
    const selectedCard = /카드번호\s+\d{4}-[\d*]{4}-[\d*]{4}-(\d{4})/.exec(text);
    if (selectedCard && (cards.size !== 1 || !cards.has(selectedCard[1]))) {
        throw new KbApprovalReconciliationError('선택 카드번호와 거래 카드번호가 일치하지 않습니다.');
    }
    return { bankName: 'KB국민카드', statementMonth: start.slice(0, 7),
        grandTotalAmount: normalTotal - cancelTotal, cards: [...cards.values()], warnings: [] };
};

export const analyzeKbApprovalPdf = async (buffer: Buffer): Promise<KbApprovalStatement | null> => {
    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    let pages: string[];
    try {
        // Every page is necessary: the first-page normal total excludes cancellation rows.
        const result = await parser.getText();
        pages = result.pages.map((page: { text: string }) => page.text);
    } catch {
        return null; // Image-only or unsupported PDFs retain the existing visual analysis path.
    } finally {
        await parser.destroy().catch(() => undefined);
    }
    // Reconciliation failures deliberately propagate; never let AI bypass a known mismatch.
    return parseKbApprovalStatement(pages);
};
