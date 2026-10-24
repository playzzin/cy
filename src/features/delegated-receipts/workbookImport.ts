import * as XLSX from 'xlsx';
import { DelegatedClaim, DelegationType, PaymentMethod } from './model';
import { sourceImportMemo } from './sourceMemo';

const text = (value: unknown): string => value == null ? '' : String(value).replace(/\s+/g, ' ').trim();
const compact = (value: unknown): string => text(value).replace(/\s+/g, '');
const footer = (value: string): boolean => /^(합계|소계|총계|총액|총합계|합계금액|총금액)$/.test(compact(value)) || /^세금/.test(compact(value));
const cell = (sheet: XLSX.WorkSheet, row: number, col: number) => sheet[XLSX.utils.encode_cell({ r: row, c: col })] as XLSX.CellObject | undefined;

function parseAmount(value: unknown): number | null {
    if (value == null || text(value) === '') return null;
    const numericText = text(value).replace(/[,₩원\s]/g, '');
    if (!numericText) return null;
    const parsed = typeof value === 'number' ? value : Number(numericText);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseTitle(value: unknown): { month: string; siteName: string } | null {
    const match = text(value).match(/^(\d{4})\s*년\s*(\d{1,2})\s*월\s*(.+)$/);
    if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return null;
    const siteName = match[3].replace(/^\[(.*)\]$/, '$1').trim();
    return siteName ? { month: `${match[1]}-${match[2].padStart(2, '0')}`, siteName } : null;
}

function classifyDelegation(value: string): DelegationType {
    const normalized = compact(value);
    if (/(미위임|비위임|미직불|위임여부|직불여부|확인필요|미확인|위임받지|(?:위임|직불|직접입금)(?:안함|아님|없음|안|취소|불가|X|×))/i.test(normalized)) return 'unknown';
    const direct = /(^|[\s([:])(?:직불|직접\s*입금)(?=$|[\s)\]:]|입금|완료|처리)/.test(value);
    const delegate = /(^|[\s([:])위임(?=$|[\s)\]:]|입금|완료|처리)/.test(value);
    return direct === delegate ? 'unknown' : direct ? 'direct' : 'delegate';
}

function classifyPayment(value: string): PaymentMethod {
    const cash = /현금/.test(value);
    const transfer = /계좌|이체|통장/.test(value);
    return cash === transfer ? 'unknown' : cash ? 'cash' : 'transfer';
}

// 두 개의 독립적인 32비트 해시를 사용해 원문 이름이 ID에 노출되지 않게 한다.
function stableId(identity: string): string {
    let first = 2166136261;
    let second = 5381;
    for (let index = 0; index < identity.length; index += 1) {
        const code = identity.charCodeAt(index);
        first = Math.imul(first ^ code, 16777619);
        second = Math.imul(second, 33) ^ code;
    }
    return `import-${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}

interface Block { row: number; col: number }

export interface UnclassifiedSourceRow {
    id: string;
    sourceLabel: string;
    sourceTitle: string;
    workerName: string;
    grossAmount: number | null;
    sourceStatus: string;
    reason: string;
    rawCells: Array<{
        address: string;
        value: string | number | boolean | null;
        formula?: string;
        formattedText?: string;
        comment?: string;
    }>;
}

export interface WorkbookSheetSummary {
    name: string;
    populatedCells: number;
    claimCount: number;
    reviewRowCount: number;
}

export interface DelegatedWorkbookImport {
    claims: DelegatedClaim[];
    warnings: string[];
    unclassifiedRows: UnclassifiedSourceRow[];
    sheetSummaries: WorkbookSheetSummary[];
}

function hasSourceContent(sourceCell: XLSX.CellObject | undefined): boolean {
    return Boolean(sourceCell && ((sourceCell.v !== undefined && sourceCell.v !== null && sourceCell.v !== '') || sourceCell.f || sourceCell.c?.length));
}

function preserveCell(sheet: XLSX.WorkSheet, row: number, col: number): UnclassifiedSourceRow['rawCells'][number] {
    const sourceCell = cell(sheet, row, col);
    const originalValue = sourceCell?.v;
    const value = typeof originalValue === 'string' || typeof originalValue === 'number' || typeof originalValue === 'boolean'
        ? originalValue : originalValue instanceof Date ? originalValue.toISOString() : null;
    return {
        address: XLSX.utils.encode_cell({ r: row, c: col }),
        value,
        ...(sourceCell?.f ? { formula: sourceCell.f } : {}),
        ...(sourceCell?.w !== undefined ? { formattedText: String(sourceCell.w) } : {}),
        ...(sourceCell?.c?.length ? { comment: sourceCell.c.map(comment => comment.t).join('\n') } : {}),
    };
}

function sourceRowStatus(sheet: XLSX.WorkSheet, row: number, statusCol: number): {
    status: string;
    individualStatus: string;
    merge?: XLSX.Range;
} {
    const status = text(cell(sheet, row, statusCol)?.v);
    const merge = (sheet['!merges'] || []).find(range =>
        range.s.r <= row && range.e.r >= row && range.s.c <= statusCol && range.e.c >= statusCol
        && (range.e.r > range.s.r || range.e.c > range.s.c));
    if (!merge) return { status, individualStatus: status };
    const groupStatus = text(cell(sheet, merge.s.r, merge.s.c)?.v);
    return {
        status: `그룹 표시 ${XLSX.utils.encode_range(merge)}${groupStatus ? `: ${groupStatus}` : ''}`,
        individualStatus: groupStatus,
        merge,
    };
}

function sourceTitleCell(sheet: XLSX.WorkSheet, block: Block): { row: number; rawTitle: string } {
    for (let offset = 1; offset <= 3 && block.row - offset >= 0; offset += 1) {
        const candidate = cell(sheet, block.row - offset, block.col);
        if (hasSourceContent(candidate)) return { row: block.row - offset, rawTitle: String(candidate?.v ?? '') };
    }
    return { row: Math.max(0, block.row - 2), rawTitle: '' };
}

/** 원본의 반복 3열 블록을 읽는다. 색상·완료 문구·세전액으로 실제 입금액을 만들지 않는다. */
export function parseDelegatedWorkbook(workbook: XLSX.WorkBook): DelegatedWorkbookImport {
    const claims: DelegatedClaim[] = [];
    const warnings: string[] = [];
    const unclassifiedRows: UnclassifiedSourceRow[] = [];
    const sheetSummaries: WorkbookSheetSummary[] = [];
    const occurrences = new Map<string, number>();
    const now = new Date().toISOString();
    let invalidAmounts = 0;
    let mergedStatuses = 0;
    let duplicateIdentities = 0;

    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
            sheetSummaries.push({ name: sheetName, populatedCells: 0, claimCount: 0, reviewRowCount: 0 });
            continue;
        }
        const blocks: Block[] = [];
        const allBlocks: Block[] = [];
        let lastRow = 0;
        let populatedCells = 0;
        for (const address of Object.keys(sheet)) {
            if (!/^[A-Z]+[1-9]\d*$/.test(address)) continue;
            const position = XLSX.utils.decode_cell(address);
            lastRow = Math.max(lastRow, position.r);
            if (hasSourceContent(sheet[address])) populatedCells += 1;
            if (!/^(이름|성명)$/.test(compact(sheet[address]?.v))) continue;
            allBlocks.push({ row: position.r, col: position.c });
            if (compact(cell(sheet, position.r, position.c + 2)?.v) !== '입금여부') continue;
            if (compact(cell(sheet, position.r, position.c + 1)?.v) !== '세전금액') continue;
            blocks.push({ row: position.r, col: position.c });
        }
        blocks.sort((left, right) => left.row - right.row || left.col - right.col);
        let recognizedBlocks = 0;
        let missingTitleRows = 0;
        const initialCount = claims.length;
        for (const block of blocks) {
            let title: ReturnType<typeof parseTitle> = null;
            for (let offset = 1; offset <= 3 && block.row - offset >= 0; offset += 1) {
                title = parseTitle(cell(sheet, block.row - offset, block.col)?.v);
                if (title) break;
            }
            if (title) recognizedBlocks += 1;
            const nextBlock = blocks.find(candidate => candidate.col === block.col && candidate.row > block.row);
            const endRow = nextBlock ? nextBlock.row - 2 : lastRow + 1;
            for (let row = block.row + 1; row < endRow; row += 1) {
                const workerName = text(cell(sheet, row, block.col)?.v);
                if (footer(workerName)) break;
                if (!workerName || /^(이름|성명)$/.test(compact(workerName))) continue;
                if (parseTitle(workerName)) break;
                if (!title) {
                    missingTitleRows += 1;
                    continue;
                }
                const amountCell = cell(sheet, row, block.col + 1);
                const grossAmount = amountCell?.t === 'e' ? null : parseAmount(amountCell?.v);
                if (grossAmount === null) invalidAmounts += 1;
                const statusCol = block.col + 2;
                const statusMerge = (sheet['!merges'] || []).find(merge =>
                    merge.s.r <= row && merge.e.r >= row && merge.s.c <= statusCol && merge.e.c >= statusCol
                    && (merge.e.r > merge.s.r || merge.e.c > merge.s.c));
                let sourceStatus = text(cell(sheet, row, statusCol)?.v);
                let individualStatus = sourceStatus;
                if (statusMerge) {
                    const range = XLSX.utils.encode_range(statusMerge);
                    const groupStatus = text(cell(sheet, statusMerge.s.r, statusMerge.s.c)?.v);
                    sourceStatus = `그룹 표시 ${range}${groupStatus ? `: ${groupStatus}` : ''}`;
                    individualStatus = groupStatus;
                    mergedStatuses += 1;
                }
                const identity = JSON.stringify([title.month, title.siteName.normalize('NFKC'), workerName.normalize('NFKC')]);
                const occurrence = occurrences.get(identity) || 0;
                if (occurrence > 0) duplicateIdentities += 1;
                occurrences.set(identity, occurrence + 1);
                claims.push({
                    id: stableId(`${identity}:${occurrence}`),
                    month: title.month,
                    siteName: title.siteName,
                    workerName,
                    delegationType: classifyDelegation(individualStatus),
                    paymentMethod: classifyPayment(individualStatus),
                    grossAmount,
                    expectedAmount: null,
                    taxRate: null,
                    taxAmount: null,
                    receipts: [],
                    sourceStatus,
                    sourceLabel: `${sheetName}!${XLSX.utils.encode_cell({ r: row, c: block.col })}`,
                    memo: sourceImportMemo(sourceStatus),
                    updatedAt: now,
                });
            }
        }
        // 기존 세전 행의 ID를 먼저 확정한 뒤 추가 내역을 별도 ID로 처리한다.
        // 세후 머리글·중간 합계 뒤의 행도 검사하여 빠진 자료는 확인 대기로 보존한다.
        const coveredLabels = new Set(claims.map(claim => claim.sourceLabel));
        const initialReviewCount = unclassifiedRows.length;
        let netClaimCount = 0;
        const nameColumns = new Set(allBlocks.map(block => block.col));
        for (const mergedTitle of sheet['!merges'] || []) {
            if (!nameColumns.has(mergedTitle.s.c) || mergedTitle.e.c - mergedTitle.s.c !== 2 || mergedTitle.e.r - mergedTitle.s.r !== 1) continue;
            const headerRow = mergedTitle.e.r + 1;
            if (!allBlocks.some(block => block.row === headerRow && block.col === mergedTitle.s.c)) {
                allBlocks.push({ row: headerRow, col: mergedTitle.s.c });
            }
        }
        allBlocks.sort((left, right) => left.row - right.row || left.col - right.col);
        for (const block of allBlocks) {
            const sourceTitle = sourceTitleCell(sheet, block);
            const title = parseTitle(sourceTitle.rawTitle);
            const amountHeader = compact(cell(sheet, block.row, block.col + 1)?.v);
            const nextBlock = allBlocks.find(candidate => candidate.col === block.col && candidate.row > block.row);
            const endRow = nextBlock ? nextBlock.row - 2 : lastRow + 1;
            let afterFooter = false;
            for (let row = block.row + 1; row < endRow; row += 1) {
                const workerName = text(cell(sheet, row, block.col)?.v);
                if (footer(workerName)) {
                    afterFooter = true;
                    continue;
                }
                if (/^(이름|성명)$/.test(compact(workerName)) || parseTitle(workerName)) continue;
                if (![0, 1, 2].some(offset => hasSourceContent(cell(sheet, row, block.col + offset)))) continue;
                const sourceLabel = `${sheetName}!${XLSX.utils.encode_cell({ r: row, c: block.col })}`;
                if (coveredLabels.has(sourceLabel)) continue;
                const amountCell = cell(sheet, row, block.col + 1);
                const amount = amountCell?.t === 'e' ? null : parseAmount(amountCell?.v);
                const status = sourceRowStatus(sheet, row, block.col + 2);
                if (title && workerName && amountHeader === '세후금액' && amount !== null && !afterFooter) {
                    claims.push({
                        id: `net-${stableId(JSON.stringify([sheetName, sourceLabel, 'net'])).slice(7)}`,
                        month: title.month, siteName: title.siteName, workerName,
                        delegationType: classifyDelegation(status.individualStatus), paymentMethod: classifyPayment(status.individualStatus),
                        grossAmount: null, expectedAmount: amount, taxRate: null, taxAmount: null,
                        receipts: [], sourceStatus: status.status, sourceLabel,
                        memo: ['원본 금액 구분: 세후 금액. 원본 세후액을 받을 금액으로 가져왔습니다.', sourceImportMemo(status.status)].filter(Boolean).join('\n'), updatedAt: now,
                    });
                    netClaimCount += 1;
                } else {
                    const reasons = [
                        ...(!title ? ['월·현장 제목 확인 필요'] : []),
                        ...(!workerName ? ['작업자 이름 확인 필요'] : []),
                        ...(afterFooter ? ['중간 합계·세금 안내 뒤의 추가 행'] : []),
                        ...(amountHeader !== '세전금액' && amountHeader !== '세후금액' ? ['금액 머리글의 의미 확인 필요'] : []),
                        ...(compact(cell(sheet, block.row, block.col + 2)?.v) !== '입금여부' ? ['입금 여부 머리글 확인 필요'] : []),
                        ...(amountHeader === '세후금액' && amount === null ? ['세후 금액 확인 필요'] : []),
                    ];
                    const coordinates = [
                        { row: sourceTitle.row, col: block.col },
                        ...[0, 1, 2].map(offset => ({ row: block.row, col: block.col + offset })),
                        ...[0, 1, 2].map(offset => ({ row, col: block.col + offset })),
                        ...(status.merge ? [{ row: status.merge.s.r, col: status.merge.s.c }] : []),
                    ];
                    const rawCells = Array.from(new Map(coordinates.map(position => {
                        const rawCell = preserveCell(sheet, position.row, position.col);
                        return [rawCell.address, rawCell] as const;
                    })).values());
                    unclassifiedRows.push({
                        id: `review-${stableId(JSON.stringify([sheetName, sourceLabel])).slice(7)}`,
                        sourceLabel, sourceTitle: sourceTitle.rawTitle, workerName,
                        grossAmount: amountHeader === '세전금액' ? amount : null,
                        sourceStatus: status.status, reason: reasons.join(' · ') || '원본 행 구조 확인 필요', rawCells,
                    });
                }
                coveredLabels.add(sourceLabel);
            }
        }
        // 표 오른쪽·사이 공간에 따로 적힌 금액과 메모는 의미를 추정하지 않는다.
        // 월 구분 제목 및 문서 상단 안내는 보관한 원본 파일에서 확인한다.
        const occupiedColumns = new Set(allBlocks.flatMap(block => [block.col, block.col + 1, block.col + 2]));
        const firstColumn = Math.min(...allBlocks.map(block => block.col));
        const firstHeaderRow = Math.min(...allBlocks.map(block => block.row));
        let supplementalCount = 0;
        for (const address of Object.keys(sheet)) {
            if (!/^[A-Z]+[1-9]\d*$/.test(address) || !hasSourceContent(sheet[address])) continue;
            const position = XLSX.utils.decode_cell(address);
            if (position.c < firstColumn || position.r <= firstHeaderRow || occupiedColumns.has(position.c)) continue;
            const sourceLabel = `${sheetName}!${address}`;
            if (coveredLabels.has(sourceLabel)) continue;
            unclassifiedRows.push({
                id: `review-${stableId(JSON.stringify([sheetName, sourceLabel])).slice(7)}`,
                sourceLabel, sourceTitle: '', workerName: '', grossAmount: null, sourceStatus: '',
                reason: '표 밖에 기록된 숫자·메모의 의미 확인 필요',
                rawCells: [preserveCell(sheet, position.r, position.c)],
            });
            supplementalCount += 1;
            coveredLabels.add(sourceLabel);
        }
        const reviewRowCount = unclassifiedRows.length - initialReviewCount;
        if (claims.length === initialCount && reviewRowCount === 0) {
            warnings.push(recognizedBlocks
                ? `${sheetName}: 가져올 작업자 행이 없습니다. 빈 서식도 원본에 보관합니다.`
                : `${sheetName}: 가져올 작업자 행이 없는 시트입니다. 원본에 그대로 보관합니다.`);
        }
        if (missingTitleRows) warnings.push(`${sheetName}: 월·현장을 확인할 수 없는 ${missingTitleRows}개 행은 원문과 함께 확인 대기로 보관합니다.`);
        if (netClaimCount) warnings.push(`${sheetName}: 원본에 세후 금액으로 명시된 ${netClaimCount}건은 해당 금액을 받을 금액으로 가져왔습니다.`);
        if (supplementalCount) warnings.push(`${sheetName}: 표 밖의 숫자·메모 ${supplementalCount}개도 확인 대기로 보관합니다.`);
        if (reviewRowCount) warnings.push(`${sheetName}: 자동 확정할 수 없는 총 ${reviewRowCount}개 행을 확인 대기로 보관합니다.`);
        sheetSummaries.push({ name: sheetName, populatedCells, claimCount: claims.length - initialCount, reviewRowCount });
    }
    if (invalidAmounts) warnings.push(`세전 금액을 확인할 수 없는 ${invalidAmounts}건은 금액 미설정으로 가져왔습니다.`);
    if (mergedStatuses) warnings.push(`병합된 입금 표시 ${mergedStatuses}건은 공동 표시를 각 작업자의 입금여부에 반영합니다. 실제 입금액은 따로 기록합니다.`);
    if (duplicateIdentities) warnings.push(`같은 월·현장·이름이 반복된 ${duplicateIdentities}개 행을 각각 가져왔습니다. 동명이인·분할 내역인지 확인하고, 행 순서를 바꾼 파일의 재가져오기는 주의해 주세요.`);
    if (claims.length) warnings.push('세전 내역은 받을 금액·세율을 확인해 주세요. 세후 내역은 원본 세후액을 받을 금액으로 보존하며 실제 입금액은 따로 확인합니다.');
    return { claims, warnings, unclassifiedRows, sheetSummaries };
}
