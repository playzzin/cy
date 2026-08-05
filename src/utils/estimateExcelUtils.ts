import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { EstimateDraft, formatCurrency, numberToKorean, LOGO_FALLBACK } from './estimateUtils';

type ExcelImageExtension = 'png' | 'jpeg';

type DownloadEstimateExcelOptions = {
    freezePanes?: boolean;
};

const EMU_PER_PIXEL = 9525;
const REFERENCE_ESTIMATE_LOGO_URL = '/assets/estimate/cheongyeon-logo.png';
const REFERENCE_ESTIMATE_STAMP_URL = '/assets/estimate/cheongyeon-stamp-round.png';

/**
 * 브라우저 환경에서 ExcelJS가 안정적으로 처리할 수 있도록 이미지를 data URL로 변환합니다.
 */
const getImageDataUrl = async (url: string): Promise<{ base64: string; extension: ExcelImageExtension }> => {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Logo request failed: ${response.status}`);

        const contentType = response.headers.get('content-type') || '';
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        });

        return {
            base64,
            extension: contentType.includes('jpeg') || base64.startsWith('data:image/jpeg') ? 'jpeg' : 'png'
        };
    } catch (e) {
        console.error('Image fetch error:', e);
        throw e;
    }
};

const normalizeNumber = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value.replace(/,/g, '').trim());
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

const groupEstimateItems = (items: any[]): Array<{ category: string; items: any[] }> => {
    const groups: Array<{ category: string; items: any[] }> = [];
    const indexByCategory = new Map<string, number>();

    items.forEach((item) => {
        const category = String(item.category || '기타').trim() || '기타';
        const existingIndex = indexByCategory.get(category);
        if (existingIndex === undefined) {
            indexByCategory.set(category, groups.length);
            groups.push({ category, items: [item] });
            return;
        }
        groups[existingIndex].items.push(item);
    });

    return groups;
};

const getExportScopeNotes = (scopeNotes: string, includeVat: boolean): string => {
    if (!scopeNotes || !includeVat) return scopeNotes;

    return scopeNotes
        .replace(/V\.?\s*A\.?\s*T\s*별도(?:\s*\([^)\n]*\))?/gi, 'VAT 포함')
        .replace(/부가세\s*별도/g, 'VAT 포함');
};

const sanitizeExcelText = (value: unknown): string => {
    const text = String(value ?? '');
    let cleaned = '';

    for (const char of text) {
        const code = char.charCodeAt(0);
        if (code === 9 || code === 10 || code === 13 || code >= 32) {
            cleaned += char;
        }
    }

    return cleaned;
};

const setTextCellValue = (cell: ExcelJS.Cell, value: unknown) => {
    const text = sanitizeExcelText(value);
    if (!text) {
        cell.value = null;
        return;
    }
    cell.value = text;
    cell.numFmt = '@';
};

const setCellValue = (cell: ExcelJS.Cell, value: unknown) => {
    if (typeof value === 'string') {
        setTextCellValue(cell, value);
        return;
    }

    cell.value = value as ExcelJS.CellValue;
};

const splitBankAccount = (value: unknown): { bank: string; account: string } => {
    const text = sanitizeExcelText(value).trim();
    if (!text) return { bank: '', account: '' };

    const parts = text.split(/\s+/);
    if (parts.length > 1) {
        return { bank: parts[0], account: parts.slice(1).join(' ') };
    }

    return /은행|농협|수협|신협|금고|뱅크/i.test(text)
        ? { bank: text, account: '' }
        : { bank: '', account: text };
};

const formatReferenceScopeNotes = (scopeNotes: string, includeVat: boolean): string => {
    const normalized = getExportScopeNotes(scopeNotes, includeVat)
        .split(/\r?\n/)
        .map(line => line.trimEnd())
        .filter(line => line.trim().length > 0);

    return normalized.length > 0 ? `\n${normalized.join('\n\n')}` : '';
};

const downloadReferenceEstimateExcel = async (
    draft: EstimateDraft,
    items: any[],
    subtotal: number,
    total: number,
    options: DownloadEstimateExcelOptions
) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '청연ENG ERP';
    workbook.created = new Date();
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet('견적서');
    worksheet.properties.defaultRowHeight = 21.95;
    worksheet.columns = [
        { width: 3 },
        { width: 13.125 },
        { width: 20.625 },
        { width: 5.625 },
        { width: 13.125 },
        { width: 13.125 },
        { width: 13.125 },
        { width: 13.125 },
        { width: 13.125 },
        { width: 13.125 },
        { width: 13.125 },
        { width: 3.625 },
    ];

    const fontName = '맑은 고딕';
    const colorText = 'FF111827';
    const colorBorder = 'FF111827';
    const colorLabel = 'FFF4F2F8';
    const colorWhite = 'FFFFFFFF';
    const colorStripe = 'FFF2F2F2';
    const headerFill = {
        type: 'gradient',
        gradient: 'angle',
        degree: 90,
        stops: [
            { position: 0, color: { theme: 0 } },
            { position: 1, color: { theme: 7, tint: 0.5999938962981048 } }
        ]
    } as unknown as ExcelJS.Fill;
    const labelFill = {
        type: 'gradient',
        gradient: 'angle',
        degree: 0,
        stops: [
            { position: 0, color: { theme: 0 } },
            { position: 1, color: { theme: 7, tint: 0.8000122074037904 } }
        ]
    } as unknown as ExcelJS.Fill;
    const amountFill = {
        type: 'gradient',
        gradient: 'angle',
        degree: 90,
        stops: [
            { position: 0, color: { theme: 0 } },
            { position: 1, color: { theme: 0, tint: -0.1490218817712943 } }
        ]
    } as unknown as ExcelJS.Fill;
    const allCols = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
    const installRatio = draft.installRatio || 50;
    const removeRatio = 100 - installRatio;
    const isRental = draft.estimateMode === 'rental';
    const vatInclusionLabel = draft.includeVat === false ? 'VAT 별도' : 'VAT 포함';
    const { bank, account } = splitBankAccount(draft.supplierAccount);

    const border = (style: ExcelJS.BorderStyle = 'thin'): ExcelJS.Border => ({
        style,
        color: { argb: colorBorder }
    });

    const setCellBorder = (
        cell: ExcelJS.Cell,
        edges: Partial<Record<'top' | 'bottom' | 'left' | 'right', ExcelJS.BorderStyle>> = {}
    ) => {
        cell.border = {
            top: border(edges.top || 'thin'),
            bottom: border(edges.bottom || 'thin'),
            left: border(edges.left || 'thin'),
            right: border(edges.right || 'thin')
        };
    };

    const setTextStyle = (
        cell: ExcelJS.Cell,
        {
            size = 9,
            bold = false,
            horizontal = 'center',
            vertical = 'middle',
            wrapText = false,
            fill
        }: {
            size?: number;
            bold?: boolean;
            horizontal?: ExcelJS.Alignment['horizontal'];
            vertical?: ExcelJS.Alignment['vertical'];
            wrapText?: boolean;
            fill?: string | ExcelJS.Fill;
        } = {}
    ) => {
        cell.font = { name: fontName, size, bold, color: { argb: colorText } };
        cell.alignment = { horizontal, vertical, wrapText };
        if (fill) {
            cell.fill = typeof fill === 'string'
                ? { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
                : fill;
        }
    };

    const styleBlock = (
        startRow: number,
        endRow: number,
        startCol: number,
        endCol: number,
        fill?: string | ExcelJS.Fill
    ) => {
        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                const cell = worksheet.getCell(row, col);
                // The supplied reference uses one consistent thin rule.  A
                // medium outside border becomes noticeably heavier in Excel
                // and in printed output, especially on the left edge.
                setCellBorder(cell);
                if (fill) {
                    cell.fill = typeof fill === 'string'
                        ? { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
                        : fill;
                }
            }
        }
    };

    const styleTableRow = (
        row: number,
        {
            fill = colorWhite,
            bold = false,
            size = 9,
            bottomStyle = 'thin'
        }: {
            fill?: string | ExcelJS.Fill;
            bold?: boolean;
            size?: number;
            bottomStyle?: ExcelJS.BorderStyle;
        } = {}
    ) => {
        allCols.forEach((col, index) => {
            const cell = worksheet.getCell(`${col}${row}`);
            setTextStyle(cell, { size, bold, fill });
            setCellBorder(cell, {
                left: 'thin',
                right: 'thin',
                bottom: bottomStyle
            });
        });
    };

    // 제목 영역
    [1, 2, 3, 4].forEach(row => { worksheet.getRow(row).height = 30; });
    worksheet.mergeCells('B2:K3');
    const titleCell = worksheet.getCell('B2');
    titleCell.value = '견   적   서';
    setTextStyle(titleCell, { size: 28, bold: true });

    // 공급받는자 / 공급자 정보
    for (let row = 5; row <= 10; row++) worksheet.getRow(row).height = 30;
    worksheet.mergeCells('B5:D5');
    worksheet.mergeCells('F5:K5');
    worksheet.mergeCells('C6:D6');
    worksheet.mergeCells('G6:K6');
    worksheet.mergeCells('C7:D7');
    worksheet.mergeCells('G7:H7');
    worksheet.mergeCells('J7:K7');
    worksheet.mergeCells('C8:D8');
    worksheet.mergeCells('G8:K8');
    worksheet.mergeCells('C9:D9');
    worksheet.mergeCells('G9:H9');
    worksheet.mergeCells('J9:K9');
    worksheet.mergeCells('C10:D10');
    worksheet.mergeCells('G10:H10');
    worksheet.mergeCells('J10:K10');

    styleBlock(5, 10, 2, 4);
    styleBlock(5, 10, 6, 11);

    ['B5', 'F5'].forEach(address => {
        const cell = worksheet.getCell(address);
        setTextStyle(cell, { size: 10, bold: true, fill: headerFill });
    });
    worksheet.getCell('B5').value = '공 급 받 는 자';
    worksheet.getCell('F5').value = '공  급  자';

    const infoLabels: Array<[string, string, number]> = [
        ['B6', '업 체 명', 9],
        ['B7', '현 장 명', 9],
        ['B8', '결제조건', 9],
        ['B9', '비     고', 9],
        ['B10', '견적일자', 9],
        ['F6', '상     호', 10],
        ['F7', '등록번호', 10],
        ['F8', '주     소', 10],
        ['F9', '전     화', 10],
        ['F10', '은     행', 10],
        ['I7', '대     표', 10],
        ['I9', '팩     스', 10],
        ['I10', '계     좌', 10],
    ];
    infoLabels.forEach(([address, label, size]) => {
        const cell = worksheet.getCell(address);
        cell.value = label;
        setTextStyle(cell, { size, bold: true, fill: labelFill });
    });

    const infoValues: Array<[string, unknown]> = [
        ['C6', draft.clientCompany],
        ['C7', draft.projectName],
        ['C8', draft.paymentTerms],
        ['C9', draft.notes],
        ['C10', draft.issueDate],
        ['G7', draft.supplierBizNo],
        ['J7', draft.supplierName],
        ['G8', draft.supplierAddress],
        ['G9', draft.supplierContact],
        ['J9', draft.supplierFax],
        ['G10', bank],
        ['J10', account],
    ];
    infoValues.forEach(([address, value]) => {
        const cell = worksheet.getCell(address);
        setCellValue(cell, value);
        setTextStyle(cell, { size: 9 });
    });

    try {
        const [logo, stamp] = await Promise.all([
            getImageDataUrl(REFERENCE_ESTIMATE_LOGO_URL),
            getImageDataUrl(REFERENCE_ESTIMATE_STAMP_URL)
        ]);
        const logoId = workbook.addImage({ base64: logo.base64, extension: logo.extension });
        const stampId = workbook.addImage({ base64: stamp.base64, extension: stamp.extension });
        worksheet.addImage(logoId, {
            tl: {
                nativeCol: 6,
                nativeRow: 5,
                nativeColOff: 64350,
                nativeRowOff: 60000
            },
            ext: { width: 157, height: 28 }
        } as any);
        worksheet.addImage(stampId, {
            // ExcelJS normalizes fractional columns against a default width,
            // moving the stamp to the left of the representative's name.
            // Match the supplied template's stamp anchor at the right edge of K6.
            tl: {
                nativeCol: 10,
                nativeRow: 5,
                nativeColOff: 266700,
                nativeRowOff: 85725
            },
            ext: { width: 70, height: 63 }
        } as any);
    } catch (error) {
        console.warn('Reference estimate images could not be embedded.', error);
        const supplierCell = worksheet.getCell('G6');
        setCellValue(supplierCell, draft.supplierCompany);
        setTextStyle(supplierCell, { size: 10, bold: true });
    }

    // 합계 금액
    worksheet.getRow(11).height = 20.1;
    worksheet.getRow(12).height = 30;
    worksheet.getRow(13).height = 20.1;
    worksheet.mergeCells('B12:D12');
    worksheet.mergeCells('E12:K12');
    const amountLabel = worksheet.getCell('B12');
    amountLabel.value = `합계 금액 (${vatInclusionLabel})`;
    setTextStyle(amountLabel, { size: 10, bold: true, fill: headerFill });
    setCellBorder(amountLabel);
    const amountValue = worksheet.getCell('E12');
    setTextCellValue(amountValue, `일금 ${numberToKorean(total)}원 정  ( ￦ ${formatCurrency(total)} )`);
    setTextStyle(amountValue, { size: 11, bold: true, fill: amountFill });
    setCellBorder(amountValue);

    // 품목 헤더
    worksheet.getRow(14).height = 30;
    worksheet.getRow(15).height = 30;
    worksheet.mergeCells('B14:B15');
    worksheet.mergeCells('C14:C15');
    worksheet.mergeCells('D14:D15');
    worksheet.mergeCells('E14:E15');
    worksheet.mergeCells('F14:G14');
    worksheet.mergeCells('H14:I14');
    worksheet.mergeCells('J14:K15');
    styleBlock(14, 15, 2, 11, headerFill);
    [
        ['B14', '품 명'],
        ['C14', '설치 구간'],
        ['D14', '단위'],
        ['E14', '물 량'],
        ['F14', '인 건 비'],
        ['H14', isRental ? '임 대 료' : '청 구'],
        ['J14', '비 고'],
        ['F15', '단 가'],
        ['G15', '금 액'],
        ['H15', isRental ? '단 가' : `설치 ${installRatio}%`],
        ['I15', isRental ? '금 액' : `해체 ${removeRatio}%`],
    ].forEach(([address, value]) => {
        const cell = worksheet.getCell(address);
        cell.value = value;
        setTextStyle(cell, { size: 10, bold: true, fill: headerFill });
    });

    // 품목 본문: 첨부 양식처럼 그룹마다 최소 4행을 확보합니다.
    const groupedItems = groupEstimateItems(items);
    const groups = groupedItems.length > 0 ? groupedItems : [{ category: '기타', items: [] }];
    const subtotalRows: number[] = [];
    let currentRow = 16;
    let totalQuantity = 0;
    let totalLabor = 0;
    let totalRental = 0;
    let totalInstall = 0;
    let totalRemove = 0;

    groups.forEach(group => {
        const groupStartRow = currentRow;
        const slotCount = Math.max(4, group.items.length);
        const groupEndRow = groupStartRow + slotCount - 1;

        for (let index = 0; index < slotCount; index++) {
            const row = currentRow;
            const item = group.items[index];
            worksheet.getRow(row).height = 22.5;
            worksheet.mergeCells(`J${row}:K${row}`);
            styleTableRow(row, { fill: (row - groupStartRow) % 2 === 0 ? colorWhite : colorStripe });

            if (item) {
                const quantity = normalizeNumber(item.quantity);
                const laborUnitPrice = normalizeNumber(item.laborUnitPrice || item.finalUnitPrice);
                const standardUnitPrice = normalizeNumber(item.finalUnitPrice);
                const laborAmount = normalizeNumber(item.laborAmount || quantity * laborUnitPrice);
                const rentalUnitPrice = normalizeNumber(item.rentalUnitPrice);
                const rentalAmount = normalizeNumber(item.rentalAmount || quantity * rentalUnitPrice);
                const amount = normalizeNumber(item.amount || quantity * standardUnitPrice);
                const installAmount = normalizeNumber(item.install50 || Math.round(amount * installRatio / 100));
                const removeAmount = normalizeNumber(item.remove50 || amount - installAmount);

                setCellValue(worksheet.getCell(`C${row}`), item.section || item.label || '');
                setCellValue(worksheet.getCell(`D${row}`), item.unit || '');
                worksheet.getCell(`E${row}`).value = quantity || null;
                worksheet.getCell(`F${row}`).value = (isRental ? laborUnitPrice : standardUnitPrice) || null;
                worksheet.getCell(`G${row}`).value = quantity || (isRental ? laborUnitPrice : standardUnitPrice)
                    ? { formula: `F${row}*E${row}`, result: isRental ? laborAmount : amount }
                    : null;
                worksheet.getCell(`H${row}`).value = isRental
                    ? (rentalUnitPrice || null)
                    : (amount ? { formula: `G${row}*${installRatio / 100}`, result: installAmount } : null);
                worksheet.getCell(`I${row}`).value = isRental
                    ? (quantity || rentalUnitPrice ? { formula: `H${row}*E${row}`, result: rentalAmount } : null)
                    : (amount ? { formula: `G${row}*${removeRatio / 100}`, result: removeAmount } : null);
                setCellValue(worksheet.getCell(`J${row}`), item.note || '');

                totalQuantity += quantity;
                totalLabor += isRental ? laborAmount : amount;
                totalRental += rentalAmount;
                totalInstall += installAmount;
                totalRemove += removeAmount;
            }

            ['E', 'F', 'G', 'H', 'I'].forEach(col => {
                const cell = worksheet.getCell(`${col}${row}`);
                cell.numFmt = '#,##0';
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
            });
            ['B', 'C', 'D', 'J'].forEach(col => {
                worksheet.getCell(`${col}${row}`).alignment = {
                    horizontal: 'center',
                    vertical: 'middle',
                    wrapText: col === 'J'
                };
            });
            currentRow++;
        }

        worksheet.mergeCells(`B${groupStartRow}:B${groupEndRow}`);
        const categoryCell = worksheet.getCell(`B${groupStartRow}`);
        setTextCellValue(categoryCell, group.category);
        setTextStyle(categoryCell, { size: 9, bold: true, fill: colorWhite });

        const subtotalRow = currentRow;
        subtotalRows.push(subtotalRow);
        worksheet.getRow(subtotalRow).height = 30;
        worksheet.mergeCells(`B${subtotalRow}:D${subtotalRow}`);
        worksheet.mergeCells(`J${subtotalRow}:K${subtotalRow}`);
        styleTableRow(subtotalRow, { fill: colorLabel, bold: true });
        worksheet.getCell(`B${subtotalRow}`).value = `${group.category} 합계`;
        setTextStyle(worksheet.getCell(`B${subtotalRow}`), { size: 10, bold: true, fill: colorLabel });

        const groupQuantity = group.items.reduce((sum, item) => sum + normalizeNumber(item.quantity), 0);
        const groupLabor = group.items.reduce((sum, item) => {
            const quantity = normalizeNumber(item.quantity);
            return sum + (isRental
                ? normalizeNumber(item.laborAmount || quantity * normalizeNumber(item.laborUnitPrice || item.finalUnitPrice))
                : normalizeNumber(item.amount || quantity * normalizeNumber(item.finalUnitPrice)));
        }, 0);
        const groupRental = group.items.reduce((sum, item) => {
            const quantity = normalizeNumber(item.quantity);
            return sum + normalizeNumber(item.rentalAmount || quantity * normalizeNumber(item.rentalUnitPrice));
        }, 0);
        const groupInstall = group.items.reduce((sum, item) => {
            const amount = normalizeNumber(item.amount || normalizeNumber(item.quantity) * normalizeNumber(item.finalUnitPrice));
            return sum + normalizeNumber(item.install50 || Math.round(amount * installRatio / 100));
        }, 0);
        const groupRemove = group.items.reduce((sum, item) => {
            const amount = normalizeNumber(item.amount || normalizeNumber(item.quantity) * normalizeNumber(item.finalUnitPrice));
            const installAmount = normalizeNumber(item.install50 || Math.round(amount * installRatio / 100));
            return sum + normalizeNumber(item.remove50 || amount - installAmount);
        }, 0);

        worksheet.getCell(`E${subtotalRow}`).value = {
            formula: `SUM(E${groupStartRow}:E${groupEndRow})`,
            result: groupQuantity
        };
        worksheet.getCell(`G${subtotalRow}`).value = {
            formula: `SUM(G${groupStartRow}:G${groupEndRow})`,
            result: groupLabor
        };
        if (isRental) {
            worksheet.getCell(`I${subtotalRow}`).value = {
                formula: `SUM(I${groupStartRow}:I${groupEndRow})`,
                result: groupRental
            };
        } else {
            worksheet.getCell(`H${subtotalRow}`).value = {
                formula: `SUM(H${groupStartRow}:H${groupEndRow})`,
                result: groupInstall
            };
            worksheet.getCell(`I${subtotalRow}`).value = {
                formula: `SUM(I${groupStartRow}:I${groupEndRow})`,
                result: groupRemove
            };
        }
        ['E', 'F', 'G', 'H', 'I'].forEach(col => {
            const cell = worksheet.getCell(`${col}${subtotalRow}`);
            cell.numFmt = '#,##0';
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
        });
        currentRow++;
    });

    // 총 합계
    const grandTotalRow = currentRow;
    worksheet.getRow(grandTotalRow).height = 30;
    worksheet.mergeCells(`B${grandTotalRow}:D${grandTotalRow}`);
    worksheet.mergeCells(`J${grandTotalRow}:K${grandTotalRow}`);
    styleTableRow(grandTotalRow, {
        fill: headerFill,
        bold: true,
        size: 10,
        bottomStyle: 'thin'
    });
    worksheet.getCell(`B${grandTotalRow}`).value = '총 합계';
    const sumFormula = (col: string) => subtotalRows.length === 1
        ? `${col}${subtotalRows[0]}`
        : `SUM(${subtotalRows.map(row => `${col}${row}`).join(',')})`;
    worksheet.getCell(`E${grandTotalRow}`).value = {
        formula: sumFormula('E'),
        result: totalQuantity
    };
    worksheet.getCell(`G${grandTotalRow}`).value = {
        formula: sumFormula('G'),
        result: isRental ? totalLabor : subtotal
    };
    if (isRental) {
        worksheet.getCell(`I${grandTotalRow}`).value = {
            formula: sumFormula('I'),
            result: totalRental
        };
    } else {
        worksheet.getCell(`H${grandTotalRow}`).value = {
            formula: sumFormula('H'),
            result: totalInstall
        };
        worksheet.getCell(`I${grandTotalRow}`).value = {
            formula: sumFormula('I'),
            result: totalRemove
        };
    }
    ['E', 'F', 'G', 'H', 'I'].forEach(col => {
        const cell = worksheet.getCell(`${col}${grandTotalRow}`);
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
    });

    // 특약 사항
    const spacerRow = grandTotalRow + 1;
    const scopeTitleRow = grandTotalRow + 2;
    const scopeBodyRow = grandTotalRow + 3;
    worksheet.getRow(spacerRow).height = 20.1;
    worksheet.getRow(scopeTitleRow).height = 30;
    worksheet.mergeCells(`B${scopeTitleRow}:K${scopeTitleRow}`);
    const scopeTitleCell = worksheet.getCell(`B${scopeTitleRow}`);
    scopeTitleCell.value = '◈ 특 약 사 항 (Special Terms)';
    setTextStyle(scopeTitleCell, {
        size: 10,
        bold: true,
        horizontal: 'left',
        fill: headerFill
    });
    setCellBorder(scopeTitleCell);

    const scopeNotes = formatReferenceScopeNotes(draft.scopeNotes, draft.includeVat !== false);
    worksheet.mergeCells(`B${scopeBodyRow}:K${scopeBodyRow}`);
    const scopeCell = worksheet.getCell(`B${scopeBodyRow}`);
    setTextCellValue(scopeCell, scopeNotes);
    setTextStyle(scopeCell, {
        size: 9,
        horizontal: 'left',
        vertical: 'top',
        wrapText: true,
        fill: colorWhite
    });
    setCellBorder(scopeCell);
    const lineCount = Math.max(1, scopeNotes.split(/\r?\n/).length);
    const wrappedLineEstimate = Math.ceil(scopeNotes.length / 120);
    worksheet.getRow(scopeBodyRow).height = Math.max(80, lineCount * 13.35, wrappedLineEstimate * 15);

    worksheet.pageSetup.fitToPage = true;
    worksheet.pageSetup.fitToWidth = 1;
    worksheet.pageSetup.fitToHeight = 0;
    worksheet.pageSetup.horizontalCentered = true;
    worksheet.pageSetup.paperSize = 9;
    worksheet.pageSetup.orientation = 'landscape';
    worksheet.pageSetup.margins = {
        left: 0.25,
        right: 0.25,
        top: 0.35,
        bottom: 0.35,
        header: 0.15,
        footer: 0.15
    };
    worksheet.views = options.freezePanes !== false
        ? [{ state: 'frozen', ySplit: 15, showGridLines: false }]
        : [{ showGridLines: false }];

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(
        new Blob([buffer]),
        `${draft.clientCompany || '업체'}_견적서_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
};

/**
 * 거래명세표와 임대거래명세표를 첨부 샘플의 공통 B~K 양식으로 출력합니다.
 */
const downloadReferenceTransactionExcel = async (
    draft: EstimateDraft,
    items: any[],
    total: number,
    options: DownloadEstimateExcelOptions,
    mode: 'standard' | 'rental'
) => {
    const isRental = mode === 'rental';
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '청연ENG ERP';
    workbook.created = new Date();
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet(isRental ? '임대거래명세표' : '거래명세표');
    worksheet.properties.defaultRowHeight = 21.95;
    worksheet.columns = [
        { width: 3 },
        { width: 13.125 },
        { width: 20.625 },
        { width: 5.625 },
        { width: 13.125 },
        { width: 13.125 },
        { width: 13.125 },
        { width: 13.125 },
        { width: 13.125 },
        { width: 13.125 },
        { width: 13.125 },
        { width: 3.625 },
    ];

    const fontName = '맑은 고딕';
    const colorText = 'FF111827';
    const colorBorder = 'FF111827';
    const colorLabel = 'FFF4F2F8';
    const colorWhite = 'FFFFFFFF';
    const colorStripe = 'FFF2F2F2';
    const headerFill = {
        type: 'gradient',
        gradient: 'angle',
        degree: 90,
        stops: [
            { position: 0, color: { theme: 0 } },
            { position: 1, color: { theme: 7, tint: 0.5999938962981048 } }
        ]
    } as unknown as ExcelJS.Fill;
    const labelFill = {
        type: 'gradient',
        gradient: 'angle',
        degree: 0,
        stops: [
            { position: 0, color: { theme: 0 } },
            { position: 1, color: { theme: 7, tint: 0.8000122074037904 } }
        ]
    } as unknown as ExcelJS.Fill;
    const amountFill = {
        type: 'gradient',
        gradient: 'angle',
        degree: 90,
        stops: [
            { position: 0, color: { theme: 0 } },
            { position: 1, color: { theme: 0, tint: -0.1490218817712943 } }
        ]
    } as unknown as ExcelJS.Fill;
    const outputColumns = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
    const vatRate = draft.vatRate || 10;
    const vatInclusionLabel = draft.includeVat === false ? 'VAT 별도' : 'VAT 포함';
    const { bank, account } = splitBankAccount(draft.supplierAccount);

    const border = (style: ExcelJS.BorderStyle = 'thin'): ExcelJS.Border => ({
        style,
        color: { argb: colorBorder }
    });

    const setCellBorder = (cell: ExcelJS.Cell) => {
        cell.border = {
            top: border(),
            bottom: border(),
            left: border(),
            right: border()
        };
    };

    const setTextStyle = (
        cell: ExcelJS.Cell,
        {
            size = 9,
            bold = false,
            horizontal = 'center',
            vertical = 'middle',
            wrapText = false,
            shrinkToFit = false,
            fill
        }: {
            size?: number;
            bold?: boolean;
            horizontal?: ExcelJS.Alignment['horizontal'];
            vertical?: ExcelJS.Alignment['vertical'];
            wrapText?: boolean;
            shrinkToFit?: boolean;
            fill?: string | ExcelJS.Fill;
        } = {}
    ) => {
        cell.font = { name: fontName, size, bold, color: { argb: colorText } };
        cell.alignment = { horizontal, vertical, wrapText, shrinkToFit };
        if (fill) {
            cell.fill = typeof fill === 'string'
                ? { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
                : fill;
        }
    };

    const styleBlock = (startRow: number, endRow: number, startCol: number, endCol: number, fill?: string | ExcelJS.Fill) => {
        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                const cell = worksheet.getCell(row, col);
                setCellBorder(cell);
                if (fill) {
                    cell.fill = typeof fill === 'string'
                        ? { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
                        : fill;
                }
            }
        }
    };

    // 제목: 첨부 샘플과 동일한 B~K 전체 폭을 사용합니다.
    [1, 2, 3, 4].forEach(row => { worksheet.getRow(row).height = 30; });
    worksheet.mergeCells('B2:K3');
    const titleCell = worksheet.getCell('B2');
    titleCell.value = isRental ? '임 대 거 래 명 세 표' : '거 래 명 세 표';
    setTextStyle(titleCell, { size: 28, bold: true, shrinkToFit: true });

    // 공급받는자 / 공급자: 견적서 참고 양식과 같은 좌우 배치입니다.
    for (let row = 5; row <= 10; row++) worksheet.getRow(row).height = 30;
    worksheet.mergeCells('B5:D5');
    worksheet.mergeCells('F5:K5');
    for (let row = 6; row <= 10; row++) worksheet.mergeCells(`C${row}:D${row}`);
    worksheet.mergeCells('G6:K6');
    worksheet.mergeCells('G7:H7');
    worksheet.mergeCells('J7:K7');
    worksheet.mergeCells('G8:K8');
    worksheet.mergeCells('G9:H9');
    worksheet.mergeCells('J9:K9');
    worksheet.mergeCells('G10:H10');
    worksheet.mergeCells('J10:K10');

    styleBlock(5, 10, 2, 4);
    styleBlock(5, 10, 6, 11);

    worksheet.getCell('B5').value = '공 급 받 는 자';
    worksheet.getCell('F5').value = '공  급  자';
    ['B5', 'F5'].forEach(address => setTextStyle(worksheet.getCell(address), { size: 10, bold: true, fill: headerFill }));

    const infoLabels: Array<[string, string]> = [
        ['B6', '업 체 명'],
        ['B7', '현 장 명'],
        ['B8', '결제조건'],
        ['B9', '비     고'],
        ['B10', '견적일자'],
        ['F6', '상     호'],
        ['F7', '등록번호'],
        ['I7', '대     표'],
        ['F8', '주     소'],
        ['F9', '전     화'],
        ['I9', '팩     스'],
        ['F10', '은     행'],
        ['I10', '계     좌'],
    ];
    infoLabels.forEach(([address, value]) => {
        const cell = worksheet.getCell(address);
        cell.value = value;
        setTextStyle(cell, { bold: true, fill: labelFill, shrinkToFit: true });
    });

    const infoValues: Array<[string, unknown]> = [
        ['C6', draft.clientCompany],
        ['C7', draft.projectName],
        ['C8', draft.paymentTerms],
        ['C9', draft.notes],
        ['C10', draft.issueDate],
        ['G7', draft.supplierBizNo],
        ['J7', draft.supplierName],
        ['G8', draft.supplierAddress],
        ['G9', draft.supplierContact],
        ['J9', draft.supplierFax],
        ['G10', bank],
        ['J10', account],
    ];
    infoValues.forEach(([address, value]) => {
        const cell = worksheet.getCell(address);
        setCellValue(cell, value);
        setTextStyle(cell, { shrinkToFit: true });
    });

    try {
        const [logo, stamp] = await Promise.all([
            getImageDataUrl(REFERENCE_ESTIMATE_LOGO_URL),
            getImageDataUrl(REFERENCE_ESTIMATE_STAMP_URL)
        ]);
        const logoId = workbook.addImage({ base64: logo.base64, extension: logo.extension });
        const stampId = workbook.addImage({ base64: stamp.base64, extension: stamp.extension });
        worksheet.addImage(logoId, {
            tl: {
                nativeCol: 6,
                nativeRow: 5,
                nativeColOff: 64350,
                nativeRowOff: 60000
            },
            ext: { width: 157, height: 28 }
        } as any);
        worksheet.addImage(stampId, {
            tl: {
                nativeCol: 10,
                nativeRow: 5,
                nativeColOff: 266700,
                nativeRowOff: 85725
            },
            ext: { width: 70, height: 63 }
        } as any);
    } catch (error) {
        console.warn('Reference transaction images could not be embedded.', error);
        const supplierCell = worksheet.getCell('G6');
        setTextCellValue(supplierCell, draft.supplierCompany);
        setTextStyle(supplierCell, { size: 10, bold: true });
    }

    // 합계 금액
    worksheet.getRow(11).height = 20.1;
    worksheet.getRow(12).height = 30;
    worksheet.getRow(13).height = 20.1;
    worksheet.mergeCells('B12:D12');
    worksheet.mergeCells('E12:K12');
    const amountLabel = worksheet.getCell('B12');
    amountLabel.value = `합계 금액 (${vatInclusionLabel})`;
    setTextStyle(amountLabel, { size: 10, bold: true, fill: headerFill });
    setCellBorder(amountLabel);
    const amountValue = worksheet.getCell('E12');
    setTextCellValue(amountValue, `일금 ${numberToKorean(total)}원 정  ( ￦ ${formatCurrency(total)} )`);
    setTextStyle(amountValue, { size: 11, bold: true, fill: amountFill, shrinkToFit: true });
    setCellBorder(amountValue);

    // 거래 품목: 원본과 동일한 B~K 폭과 10개 기본 입력행을 만듭니다.
    worksheet.getRow(14).height = 30;
    styleBlock(14, 14, 2, 11, headerFill);
    if (isRental) {
        const headers = ['날     짜', '품     목', '단 위', '수     량', '기 본 료', '사용 일수', '단     가', '공급 가액', '부 가 세', '합     계'];
        outputColumns.forEach((column, index) => {
            const cell = worksheet.getCell(`${column}14`);
            cell.value = headers[index];
            setTextStyle(cell, { size: 10, bold: true, fill: headerFill, shrinkToFit: true });
            setCellBorder(cell);
        });
    } else {
        worksheet.mergeCells('J14:K14');
        const headers: Array<[string, string]> = [
            ['B', '날     짜'], ['C', '품     목'], ['D', '단 위'], ['E', '수     량'],
            ['F', '단     가'], ['G', '공급가액'], ['H', '부 가 세'], ['I', '합     계'], ['J', '비     고']
        ];
        headers.forEach(([column, value]) => {
            const cell = worksheet.getCell(`${column}14`);
            cell.value = value;
            setTextStyle(cell, { size: 10, bold: true, fill: headerFill, shrinkToFit: true });
            setCellBorder(cell);
        });
    }

    const firstItemRow = 15;
    const itemRowCount = Math.max(10, items.length);
    let totalSupply = 0;
    let totalTax = 0;
    let totalAmount = 0;

    for (let itemIndex = 0; itemIndex < itemRowCount; itemIndex++) {
        const item = items[itemIndex];
        const currentRow = firstItemRow + itemIndex;
        const hasItem = Boolean(item);
        const quantity = normalizeNumber(item?.quantity);
        const baseFee = normalizeNumber(item?.finalUnitPrice || item?.unitPrice);
        const usageDays = hasItem ? Math.max(1, normalizeNumber(item?.period || 1)) : 0;
        const dailyFee = normalizeNumber(item?.rentalUnitPrice);
        const supplyAmount = isRental
            ? Math.round(quantity * (baseFee + (usageDays * dailyFee)))
            : Math.round(normalizeNumber(item?.amount || quantity * baseFee));
        const taxAmount = draft.includeVat === false ? 0 : Math.round(supplyAmount * vatRate / 100);
        const lineTotal = supplyAmount + taxAmount;
        const rentalInputValues = [
            item?.itemDate || '',
            item?.section || item?.label || item?.category || '',
            item?.unit || '',
            hasItem ? (quantity || null) : null,
            hasItem ? (baseFee || null) : null,
            hasItem ? (usageDays || null) : null,
            hasItem ? (dailyFee || null) : null,
        ];

        worksheet.getRow(currentRow).height = 22.5;
        if (!isRental) worksheet.mergeCells(`J${currentRow}:K${currentRow}`);
        outputColumns.forEach((column, index) => {
            const cell = worksheet.getCell(`${column}${currentRow}`);
            if (isRental && index < rentalInputValues.length) {
                setCellValue(cell, rentalInputValues[index]);
            } else if (!isRental) {
                const standardValues = [
                    item?.itemDate || '',
                    item?.section || item?.label || item?.category || '',
                    item?.unit || '',
                    hasItem ? (quantity || null) : null,
                    hasItem ? (baseFee || null) : null,
                ];
                if (index < standardValues.length) setCellValue(cell, standardValues[index]);
                if (column === 'J') setCellValue(cell, item?.note || '');
            }
            setTextStyle(cell, {
                horizontal: index === 1 ? 'left' : ((!isRental && index >= 8) ? 'center' : (index >= 3 ? 'right' : 'center')),
                wrapText: !isRental && column === 'J',
                shrinkToFit: true,
                fill: (currentRow - firstItemRow) % 2 === 0 ? colorWhite : colorStripe
            });
            setCellBorder(cell);
            if (isRental && (index === 3 || index === 5)) cell.numFmt = '#,##0.##';
            if (isRental && [4, 6, 7, 8, 9].includes(index)) cell.numFmt = '#,##0';
            if (!isRental && [3, 4, 5, 6, 7].includes(index)) cell.numFmt = '#,##0';
        });

        if (isRental) {
            worksheet.getCell(`I${currentRow}`).value = {
                formula: `IF(COUNTA(E${currentRow}:H${currentRow})=0,"",ROUND(E${currentRow}*(F${currentRow}+(G${currentRow}*H${currentRow})),0))`,
                result: hasItem ? supplyAmount : undefined
            };
            worksheet.getCell(`J${currentRow}`).value = {
                formula: draft.includeVat === false
                    ? `IF(I${currentRow}="","",0)`
                    : `IF(I${currentRow}="","",ROUND(I${currentRow}*${vatRate / 100},0))`,
                result: hasItem ? taxAmount : undefined
            };
            worksheet.getCell(`K${currentRow}`).value = {
                formula: `IF(I${currentRow}="","",I${currentRow}+J${currentRow})`,
                result: hasItem ? lineTotal : undefined
            };
        } else {
            worksheet.getCell(`G${currentRow}`).value = {
                formula: `IF(COUNTA(E${currentRow}:F${currentRow})=0,"",ROUND(E${currentRow}*F${currentRow},0))`,
                result: hasItem ? supplyAmount : undefined
            };
            worksheet.getCell(`H${currentRow}`).value = {
                formula: draft.includeVat === false
                    ? `IF(G${currentRow}="","",0)`
                    : `IF(G${currentRow}="","",ROUND(G${currentRow}*${vatRate / 100},0))`,
                result: hasItem ? taxAmount : undefined
            };
            worksheet.getCell(`I${currentRow}`).value = {
                formula: `IF(G${currentRow}="","",G${currentRow}+H${currentRow})`,
                result: hasItem ? lineTotal : undefined
            };
        }

        if (hasItem) {
            totalSupply += supplyAmount;
            totalTax += taxAmount;
            totalAmount += lineTotal;
        }
    }

    const totalRow = firstItemRow + itemRowCount;
    worksheet.getRow(totalRow).height = 30;
    worksheet.mergeCells(isRental ? `B${totalRow}:H${totalRow}` : `B${totalRow}:F${totalRow}`);
    if (!isRental) worksheet.mergeCells(`J${totalRow}:K${totalRow}`);
    outputColumns.forEach(column => {
        const cell = worksheet.getCell(`${column}${totalRow}`);
        setTextStyle(cell, { size: 10, bold: true, fill: headerFill, shrinkToFit: true });
        setCellBorder(cell);
    });
    worksheet.getCell(`B${totalRow}`).value = '합     계';
    const totalColumns = isRental ? ['I', 'J', 'K'] : ['G', 'H', 'I'];
    worksheet.getCell(`${totalColumns[0]}${totalRow}`).value = { formula: `SUM(${totalColumns[0]}${firstItemRow}:${totalColumns[0]}${totalRow - 1})`, result: totalSupply };
    worksheet.getCell(`${totalColumns[1]}${totalRow}`).value = { formula: `SUM(${totalColumns[1]}${firstItemRow}:${totalColumns[1]}${totalRow - 1})`, result: totalTax };
    worksheet.getCell(`${totalColumns[2]}${totalRow}`).value = { formula: `SUM(${totalColumns[2]}${firstItemRow}:${totalColumns[2]}${totalRow - 1})`, result: totalAmount };
    totalColumns.forEach(column => {
        const cell = worksheet.getCell(`${column}${totalRow}`);
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right', vertical: 'middle', shrinkToFit: true };
    });

    worksheet.pageSetup.fitToPage = true;
    worksheet.pageSetup.fitToWidth = 1;
    worksheet.pageSetup.fitToHeight = 0;
    worksheet.pageSetup.horizontalCentered = true;
    worksheet.pageSetup.paperSize = 9;
    worksheet.pageSetup.orientation = 'landscape';
    worksheet.pageSetup.margins = {
        left: 0.25,
        right: 0.25,
        top: 0.35,
        bottom: 0.35,
        header: 0.15,
        footer: 0.15
    };
    worksheet.views = options.freezePanes !== false
        ? [{ state: 'frozen', ySplit: 14, showGridLines: false }]
        : [{ showGridLines: false }];

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(
        new Blob([buffer]),
        `${draft.clientCompany || '업체'}_${isRental ? '임대거래명세표' : '거래명세표'}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
};

/**
 * 견적서/거래명세표를 블랙/그레이 톤의 고품격 서식으로 다운로드합니다.
 */
export const downloadEstimateExcel = async (
    draft: EstimateDraft,
    items: any[],
    subtotal: number,
    tax: number,
    total: number,
    type: 'estimate' | 'transaction' = 'estimate',
    options: DownloadEstimateExcelOptions = {}
) => {
    if ((type as string) === 'estimate') {
        await downloadReferenceEstimateExcel(draft, items, subtotal, total, options);
        return;
    }

    if (type === 'transaction' && draft.estimateMode === 'rental') {
        await downloadReferenceTransactionExcel(draft, items, total, options, 'rental');
        return;
    }

    if (type === 'transaction') {
        await downloadReferenceTransactionExcel(draft, items, total, options, 'standard');
        return;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '청연ENG ERP';
    workbook.created = new Date();
    workbook.modified = new Date();

    const isEstimate = type === 'estimate';
    const isRentalTransaction = !isEstimate && draft.estimateMode === 'rental';
    const worksheet = workbook.addWorksheet(isEstimate ? '견적서' : (isRentalTransaction ? '임대 거래명세표' : '거래명세표'));
    worksheet.properties.defaultRowHeight = isEstimate ? 22 : 21.95;
    
    const colorMain = 'FF111827';
    const colorSub = 'FF374151';
    const colorAccent = 'FF111827';
    const colorAccentSoft = 'FFE5E7EB';
    const colorBg = 'FFF3F4F6';
    const colorText = 'FFFFFFFF';
    const colorBorder = 'FFCBD5E1';
    const colorDarkBorder = 'FF111827';
    const fontName = '맑은 고딕';
    const thinBorder: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: colorBorder } },
        left: { style: 'thin', color: { argb: colorBorder } },
        bottom: { style: 'thin', color: { argb: colorBorder } },
        right: { style: 'thin', color: { argb: colorBorder } }
    };

    const setBoxBorder = (cell: ExcelJS.Cell, style: ExcelJS.BorderStyle = 'thin', color = colorBorder) => {
        cell.border = {
            top: { style, color: { argb: color } },
            left: { style, color: { argb: color } },
            bottom: { style, color: { argb: color } },
            right: { style, color: { argb: color } }
        };
    };

    const setRangeBorder = (
        startCol: string,
        startRow: number,
        endCol: string,
        endRow: number,
        outerStyle: ExcelJS.BorderStyle = 'medium'
    ) => {
        const outerColor = outerStyle === 'thin' ? colorBorder : colorDarkBorder;
        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol.charCodeAt(0); col <= endCol.charCodeAt(0); col++) {
                const cell = worksheet.getCell(`${String.fromCharCode(col)}${row}`);
                cell.border = {
                    top: {
                        style: row === startRow ? outerStyle : 'thin',
                        color: { argb: row === startRow ? outerColor : colorBorder }
                    },
                    left: {
                        style: col === startCol.charCodeAt(0) ? outerStyle : 'thin',
                        color: { argb: col === startCol.charCodeAt(0) ? outerColor : colorBorder }
                    },
                    bottom: {
                        style: row === endRow ? outerStyle : 'thin',
                        color: { argb: row === endRow ? outerColor : colorBorder }
                    },
                    right: {
                        style: col === endCol.charCodeAt(0) ? outerStyle : 'thin',
                        color: { argb: col === endCol.charCodeAt(0) ? outerColor : colorBorder }
                    }
                };
            }
        }
    };

    const setMoneyFormat = (cell: ExcelJS.Cell) => {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
    };

    const setQuantityFormat = (cell: ExcelJS.Cell) => {
        const value = normalizeNumber(cell.value);
        cell.numFmt = Number.isInteger(value) ? '#,##0' : '#,##0.##';
        cell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
    };

    const installRatio = draft.installRatio || 50;
    const removeRatio = 100 - installRatio;
    const vatRate = draft.vatRate || 10;
    const vatInclusionLabel = draft.includeVat === false ? 'VAT 별도' : 'VAT 포함';

    // 1. 컬럼 너비 및 마지막 열 설정
    const lastCol = isEstimate ? 'J' : (isRentalTransaction ? 'L' : 'I');
    if (isEstimate) {
        worksheet.columns = [
            { width: 3 }, { width: 16 }, { width: 28 }, { width: 8 }, { width: 12 },
            { width: 14 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 22 },
        ];
    } else if (isRentalTransaction) {
        worksheet.columns = [
            { width: 3.625 }, { width: 11.5 }, { width: 28 }, { width: 8 }, { width: 10 },
            { width: 11 }, { width: 10 }, { width: 10 }, { width: 14 }, { width: 12 },
            { width: 14 }, { width: 18 }, { width: 3.625 },
        ];
    } else {
        worksheet.columns = [
            { width: 3.625 }, { width: 10.625 }, { width: 30.625 }, { width: 10.625 }, { width: 10.625 },
            { width: 10.625 }, { width: 15.625 }, { width: 10.625 }, { width: 20.625 }, { width: 3.625 },
        ];
    }

    // 2. 로고 및 제목
    worksheet.getRow(1).height = isEstimate ? 8 : 8.1;
    worksheet.getRow(2).height = isEstimate ? 38 : 38.1;
    worksheet.getRow(3).height = isEstimate ? 28 : 27.95;
    if (isEstimate) worksheet.getRow(4).height = 38;
    if (isEstimate) {
        worksheet.mergeCells('B2:D3');
        worksheet.mergeCells('E2:G3');
        worksheet.mergeCells('H2:J3');
    } else {
        worksheet.mergeCells('B2:C3');
        worksheet.mergeCells('D2:F3');
        worksheet.mergeCells('G2:I3');
    }

    try {
        const logo = await getImageDataUrl(LOGO_FALLBACK);
        const logoId = workbook.addImage({ base64: logo.base64, extension: logo.extension });
        const logoPosition: ExcelJS.ImagePosition | any = isEstimate
            ? {
                tl: { nativeCol: 8, nativeRow: 3, nativeColOff: 63 * EMU_PER_PIXEL, nativeRowOff: 3 * EMU_PER_PIXEL },
                ext: { width: 220, height: 39 }
            }
            : {
                tl: { nativeCol: 7, nativeRow: 2, nativeColOff: 291899, nativeRowOff: 151850 },
                ext: { width: 220, height: 39 }
            };
        worksheet.addImage(logoId, logoPosition);
    } catch (e) {
        console.warn('Logo load failed');
    }

    const titleCell = worksheet.getCell(isEstimate ? 'E2' : 'D2');
    titleCell.value = isEstimate ? '견  적  서' : (isRentalTransaction ? '임 대 거 래 명 세 표' : '거 래 명 세 표');
    titleCell.font = { name: fontName, size: 30, bold: true, color: { argb: colorMain } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // 3. 상단 정보 테이블
    const infoStartRow = 5;
    const clientSpan = isEstimate ? 'D' : 'C';
    const supplierStart = isEstimate ? 'F' : 'E';
    const infoSpacerCol = String.fromCharCode(clientSpan.charCodeAt(0) + 1);

    const setHeadStyle = (cell: ExcelJS.Cell) => {
        cell.font = { name: fontName, size: 10, bold: true, color: { argb: colorText } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorMain } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = thinBorder as ExcelJS.Borders;
    };

    worksheet.mergeCells(`B${infoStartRow}:${clientSpan}${infoStartRow}`);
    worksheet.getRow(infoStartRow).height = isEstimate ? 36 : 30;
    setHeadStyle(worksheet.getCell(`B${infoStartRow}`));
    worksheet.getCell(`B${infoStartRow}`).value = '공 급 받 는 자';

    worksheet.mergeCells(`${supplierStart}${infoStartRow}:${lastCol}${infoStartRow}`);
    setHeadStyle(worksheet.getCell(`${supplierStart}${infoStartRow}`));
    worksheet.getCell(`${supplierStart}${infoStartRow}`).value = '공  급  자';

    const infoRows = [
        { left: ['업 체 명', draft.clientCompany], right: ['상      호', draft.supplierCompany] },
        { left: ['현 장 명', draft.projectName], right: ['등록번호', draft.supplierBizNo, '대 표', draft.supplierName] },
        { left: ['결제조건', draft.paymentTerms], right: ['주      소', draft.supplierAddress] },
        { left: ['비      고', draft.notes], right: ['전      화', draft.supplierContact, '팩 스', draft.supplierFax] },
        { left: [isEstimate ? '견적일자' : '작성일자', draft.issueDate], right: ['계      좌', draft.supplierAccount] },
    ];

    infoRows.forEach((rowData, idx) => {
        const rIdx = infoStartRow + 1 + idx;
        worksheet.getRow(rIdx).height = isEstimate ? 32 : 24.95;

        const setStyle = (cell: ExcelJS.Cell, isLabel = false) => {
            cell.font = { name: fontName, size: 9, bold: isLabel, color: { argb: isLabel ? colorSub : colorMain } };
            cell.border = thinBorder as ExcelJS.Borders;
            cell.alignment = { vertical: 'middle', horizontal: isLabel ? 'center' : 'left', indent: isLabel ? 0 : 1 };
            if (isLabel) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorBg } };
        };

        const lblL = worksheet.getCell(`B${rIdx}`);
        const valL = worksheet.getCell(`C${rIdx}`);
        lblL.value = rowData.left[0];
        setCellValue(valL, rowData.left[1]);
        worksheet.mergeCells(`C${rIdx}:${clientSpan}${rIdx}`);
        setStyle(lblL, true);
        setStyle(valL);

        const lblR = worksheet.getCell(`${supplierStart}${rIdx}`);
        lblR.value = rowData.right[0];
        setStyle(lblR, true);

        if (rowData.right.length === 2) {
            const valR = worksheet.getCell(`${String.fromCharCode(supplierStart.charCodeAt(0) + 1)}${rIdx}`);
            setCellValue(valR, rowData.right[1]);
            worksheet.mergeCells(`${String.fromCharCode(supplierStart.charCodeAt(0) + 1)}${rIdx}:${lastCol}${rIdx}`);
            setStyle(valR);
        } else {
            const vR1 = worksheet.getCell(`${String.fromCharCode(supplierStart.charCodeAt(0) + 1)}${rIdx}`);
            const lR2 = worksheet.getCell(`${String.fromCharCode(lastCol.charCodeAt(0) - 1)}${rIdx}`);
            const vR2 = worksheet.getCell(`${lastCol}${rIdx}`);
            setCellValue(vR1, rowData.right[1]);
            lR2.value = rowData.right[2];
            setCellValue(vR2, rowData.right[3]);
            worksheet.mergeCells(`${String.fromCharCode(supplierStart.charCodeAt(0) + 1)}${rIdx}:${String.fromCharCode(lastCol.charCodeAt(0) - 2)}${rIdx}`);
            setStyle(vR1);
            setStyle(lR2, true);
            setStyle(vR2);
        }
        for (let c = 'B'.charCodeAt(0); c <= lastCol.charCodeAt(0); c++) {
            if (String.fromCharCode(c) === infoSpacerCol) continue;
            const cell = worksheet.getCell(`${String.fromCharCode(c)}${rIdx}`);
            if (!cell.border) setStyle(cell);
        }
    });
    const infoEndRow = infoStartRow + infoRows.length;
    setRangeBorder('B', infoStartRow, clientSpan, infoEndRow);
    setRangeBorder(supplierStart, infoStartRow, lastCol, infoEndRow);
    setBoxBorder(worksheet.getCell(`B${infoStartRow}`), 'medium', colorDarkBorder);
    setBoxBorder(worksheet.getCell(`${supplierStart}${infoStartRow}`), 'medium', colorDarkBorder);
    for (let row = infoStartRow; row <= infoEndRow; row++) {
        worksheet.getCell(`${infoSpacerCol}${row}`).border = {};
    }

    // 4. 합계 섹션
    const amountRowIdx = infoStartRow + infoRows.length + 2;
    worksheet.getRow(amountRowIdx).height = isEstimate ? 42 : 30;
    worksheet.mergeCells(`B${amountRowIdx}:${clientSpan}${amountRowIdx}`);
    const amtLabel = worksheet.getCell(`B${amountRowIdx}`);
    amtLabel.value = `${isEstimate ? '견적' : '명세'} 합계 금액 (${vatInclusionLabel})`;
    
    worksheet.mergeCells(`${String.fromCharCode(clientSpan.charCodeAt(0) + 1)}${amountRowIdx}:${lastCol}${amountRowIdx}`);
    const amtValue = worksheet.getCell(`${String.fromCharCode(clientSpan.charCodeAt(0) + 1)}${amountRowIdx}`);
    setTextCellValue(amtValue, `일금 ${numberToKorean(total)}원 정  ( ￦ ${formatCurrency(total)} )`);

    [amtLabel, amtValue].forEach(cell => {
        cell.font = { name: fontName, size: 12, bold: true, color: { argb: cell === amtLabel ? colorText : colorMain } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cell === amtLabel ? colorAccent : colorAccentSoft } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        setBoxBorder(cell, 'medium', colorAccent);
    });

    // 5. 품목 테이블 헤더
    const tHead1 = amountRowIdx + 2;
    const setTableHeadStyle = (cell: ExcelJS.Cell, isDark = true) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isDark ? colorMain : colorSub } };
        cell.font = { name: fontName, size: 9, bold: true, color: { argb: colorText } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = thinBorder as ExcelJS.Borders;
    };
    let tableEndRow = tHead1;

    if (isEstimate) {
        const isRental = draft.estimateMode === 'rental';
        const tHead2 = tHead1 + 1;
        worksheet.getRow(tHead1).height = 30;
        worksheet.getRow(tHead2).height = 26;
        const hConfigs = [
            { l: '품 명', m: `B${tHead1}:B${tHead2}` }, { l: '설치 구간', m: `C${tHead1}:C${tHead2}` },
            { l: '단위', m: `D${tHead1}:D${tHead2}` }, { l: '물 량', m: `E${tHead1}:E${tHead2}` },
            { l: '인 건 비', m: `F${tHead1}:G${tHead1}` }, 
            { l: isRental ? '임 대 료' : '청 구', m: `H${tHead1}:I${tHead1}` },
            { l: '비 고', m: `J${tHead1}:J${tHead2}` },
        ];
        hConfigs.forEach(h => {
            worksheet.mergeCells(h.m);
            const cell = worksheet.getCell(h.m.split(':')[0]);
            cell.value = h.l;
            const range = h.m.split(':');
            for(let row=tHead1; row<=tHead2; row++) {
                for(let c=range[0].charCodeAt(0); c<=range[1].charCodeAt(0); c++) {
                    setTableHeadStyle(worksheet.getCell(`${String.fromCharCode(c)}${row}`), h.l !== '인 건 비' && h.l !== '청 구' && h.l !== '임 대 료');
                }
            }
        });

        const subH = isRental 
            ? [{ v: '단 가', c: 'F' }, { v: '금 액', c: 'G' }, { v: '단 가', c: 'H' }, { v: '금 액', c: 'I' }]
            : [{ v: '단 가', c: 'F' }, { v: '금 액', c: 'G' }, { v: `설치 ${installRatio}%`, c: 'H' }, { v: `해체 ${removeRatio}%`, c: 'I' }];
        
        subH.forEach(sh => {
            const cell = worksheet.getCell(`${sh.c}${tHead2}`);
            cell.value = sh.v;
            setTableHeadStyle(cell, false);
        });

        let curr = tHead2 + 1;
        let totalQty = 0;
        let totalLabor = 0;
        let totalRental = 0;
        let totalInstall = 0;
        let totalRemove = 0;
        const groups = groupEstimateItems(items);

        groups.forEach((group, groupIdx) => {
            const groupStartRow = curr;

            group.items.forEach((item, itemIdx) => {
                const quantity = normalizeNumber(item.quantity);
                const laborUnitPrice = normalizeNumber(item.laborUnitPrice || item.finalUnitPrice);
                const finalUnitPrice = normalizeNumber(item.finalUnitPrice);
                const laborAmount = normalizeNumber(item.laborAmount);
                const rentalUnitPrice = normalizeNumber(item.rentalUnitPrice);
                const rentalAmount = normalizeNumber(item.rentalAmount);
                const amount = normalizeNumber(item.amount);
                const installAmount = normalizeNumber(item.install50);
                const removeAmount = normalizeNumber(item.remove50);

                const vals = isRental
                    ? [
                        itemIdx === 0 ? group.category : '',
                        item.section || item.label || '',
                        item.unit || '',
                        quantity || null,
                        laborUnitPrice || null,
                        laborAmount || null,
                        rentalUnitPrice || null,
                        rentalAmount || null,
                        item.note || ''
                    ]
                    : [
                        itemIdx === 0 ? group.category : '',
                        item.section || item.label || '',
                        item.unit || '',
                        quantity || null,
                        finalUnitPrice || null,
                        amount || null,
                        installAmount || null,
                        removeAmount || null,
                        item.note || ''
                    ];

                worksheet.getRow(curr).height = 23;
                ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].forEach((col, i) => {
                    const cell = worksheet.getCell(`${col}${curr}`);
                    setCellValue(cell, vals[i]);
                    cell.border = thinBorder as ExcelJS.Borders;
                    cell.font = { name: fontName, size: 9, color: { argb: colorMain } };
                    if ((groupIdx + itemIdx) % 2 === 1) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCFCFD' } };
                    }
                    if (i === 3) setQuantityFormat(cell);
                    else if (i >= 4 && i <= 7) setMoneyFormat(cell);
                    else cell.alignment = { horizontal: i === 1 || i === 8 ? 'left' : 'center', vertical: 'middle', wrapText: i === 8 };
                });
                curr++;
            });

            if (group.items.length > 1) {
                worksheet.mergeCells(`B${groupStartRow}:B${curr - 1}`);
            }
            const groupCell = worksheet.getCell(`B${groupStartRow}`);
            setTextCellValue(groupCell, group.category);
            groupCell.font = { name: fontName, size: 9, bold: true, color: { argb: colorMain } };
            groupCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorBg } };
            groupCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

            const groupQty = group.items.reduce((sum, item) => sum + normalizeNumber(item.quantity), 0);
            const groupLabor = group.items.reduce((sum, item) => sum + normalizeNumber(item.laborAmount), 0);
            const groupRental = group.items.reduce((sum, item) => sum + normalizeNumber(item.rentalAmount), 0);
            const groupAmount = group.items.reduce((sum, item) => sum + normalizeNumber(item.amount), 0);
            const groupInstall = group.items.reduce((sum, item) => sum + normalizeNumber(item.install50), 0);
            const groupRemove = group.items.reduce((sum, item) => sum + normalizeNumber(item.remove50), 0);

            totalQty += groupQty;
            totalLabor += groupLabor;
            totalRental += groupRental;
            totalInstall += groupInstall;
            totalRemove += groupRemove;

            worksheet.getRow(curr).height = 25;
            worksheet.mergeCells(`B${curr}:D${curr}`);
            const subtotalValues = isRental
                ? [null, `${group.category} 합계`, null, null, groupQty || null, null, groupLabor || null, null, groupRental || null, `총 ${formatCurrency(groupLabor + groupRental)}`]
                : [null, `${group.category} 합계`, null, null, groupQty || null, null, groupAmount || null, groupInstall || null, groupRemove || null, ''];

            ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].forEach((col, i) => {
                const cell = worksheet.getCell(`${col}${curr}`);
                if (col !== 'C' && col !== 'D') setCellValue(cell, subtotalValues[i + 1]);
                cell.font = { name: fontName, size: 9, bold: true, color: { argb: colorMain } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorAccentSoft } };
                setBoxBorder(cell, 'thin', colorSub);
                if (col === 'E') setQuantityFormat(cell);
                else if (['F', 'G', 'H', 'I'].includes(col)) setMoneyFormat(cell);
                else cell.alignment = { horizontal: col === 'J' ? 'right' : 'center', vertical: 'middle' };
            });
            curr++;
        });

        worksheet.getRow(curr).height = 30;
        worksheet.mergeCells(`B${curr}:D${curr}`);
        const grandValues = isRental
            ? [null, '총 합계', null, null, totalQty || null, null, totalLabor || null, null, totalRental || null, `전체 ${formatCurrency(subtotal)}`]
            : [null, '총 합계', null, null, totalQty || null, null, subtotal || null, totalInstall || null, totalRemove || null, ''];

        ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].forEach((col, i) => {
            const cell = worksheet.getCell(`${col}${curr}`);
            if (col !== 'C' && col !== 'D') setCellValue(cell, grandValues[i + 1]);
            cell.font = { name: fontName, size: 10, bold: true, color: { argb: colorText } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorMain } };
            setBoxBorder(cell, 'medium', colorDarkBorder);
            if (col === 'E') setQuantityFormat(cell);
            else if (['F', 'G', 'H', 'I'].includes(col)) setMoneyFormat(cell);
            else cell.alignment = { horizontal: col === 'J' ? 'right' : 'center', vertical: 'middle' };
        });
        tableEndRow = curr;
    } else {
        worksheet.getRow(tHead1).height = 30;
        const transH = isRentalTransaction
            ? ['날짜', '품목', '단위', '수량', '기본료', '사용일수', '단가', '공급가', '부가세', '합계', '비고']
            : ['날짜', '품목', '단위', '수량', '단가', '공급가액', '세액', '비고'];
        const transCols = isRentalTransaction
            ? ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
            : ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
        transH.forEach((h, i) => {
            const cell = worksheet.getCell(transCols[i] + tHead1);
            cell.value = h;
            setTableHeadStyle(cell);
        });

        let curr = tHead1 + 1;
        items.forEach((item, idx) => {
            const quantity = normalizeNumber(item.quantity);
            const baseFee = normalizeNumber(item.finalUnitPrice || item.unitPrice);
            const usageDays = Math.max(1, normalizeNumber(item.period || 1));
            const dailyFee = normalizeNumber(item.rentalUnitPrice);
            const supplyAmt = isRentalTransaction
                ? Math.round(quantity * (baseFee + (usageDays * dailyFee)))
                : (item.amount || 0);
            const vatAmt = draft.includeVat === false ? 0 : (supplyAmt ? Math.round(supplyAmt * vatRate / 100) : 0);
            const lineTotal = supplyAmt + vatAmt;
            const vals = isRentalTransaction
                ? [
                    item.itemDate || '',
                    item.section || item.label || item.category,
                    item.unit,
                    quantity || null,
                    baseFee || null,
                    usageDays || null,
                    dailyFee || null,
                    supplyAmt || null,
                    vatAmt || null,
                    lineTotal || null,
                    item.note || item.category || ''
                ]
                : [item.itemDate || '', item.category, item.unit, quantity, item.finalUnitPrice, supplyAmt, vatAmt, item.note];
            worksheet.getRow(curr).height = 23.1;
            transCols.forEach((col, i) => {
                const cell = worksheet.getCell(`${col}${curr}`);
                setCellValue(cell, vals[i]);
                cell.border = thinBorder as ExcelJS.Borders;
                cell.font = { name: fontName, size: 9, color: { argb: colorMain } };
                if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
                if (i === 3 || (isRentalTransaction && i === 5)) setQuantityFormat(cell);
                else if (isRentalTransaction ? (i === 4 || i === 6 || i === 7 || i === 8 || i === 9) : (i >= 4 && i <= 6)) setMoneyFormat(cell);
                else cell.alignment = { horizontal: i === 1 || i === transCols.length - 1 ? 'left' : 'center', vertical: 'middle', wrapText: i === transCols.length - 1 };
            });
            curr++;
        });

        if (isRentalTransaction) {
            worksheet.getRow(curr).height = 27;
            worksheet.mergeCells(`B${curr}:D${curr}`);
            const totalSupply = items.reduce((sum, item) => {
                const quantity = normalizeNumber(item.quantity);
                const baseFee = normalizeNumber(item.finalUnitPrice || item.unitPrice);
                const usageDays = Math.max(1, normalizeNumber(item.period || 1));
                const dailyFee = normalizeNumber(item.rentalUnitPrice);
                return sum + Math.round(quantity * (baseFee + (usageDays * dailyFee)));
            }, 0);
            const totalTax = draft.includeVat === false ? 0 : Math.round(totalSupply * vatRate / 100);
            const totalLine = totalSupply + totalTax;
            const totalVals = ['합계', null, null, null, null, null, null, totalSupply, totalTax, totalLine, ''];

            transCols.forEach((col, i) => {
                const cell = worksheet.getCell(`${col}${curr}`);
                if (col !== 'C' && col !== 'D') setCellValue(cell, totalVals[i]);
                cell.font = { name: fontName, size: 10, bold: true, color: { argb: colorText } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorMain } };
                setBoxBorder(cell, 'medium', colorDarkBorder);
                if (i >= 7 && i <= 9) setMoneyFormat(cell);
                else cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
            tableEndRow = curr;
        } else {
            tableEndRow = curr - 1;
        }
    }

    // 6. 특약사항
    let lastRow = tableEndRow + 2;
    if (isEstimate && draft.scopeNotes) {
        const exportScopeNotes = getExportScopeNotes(draft.scopeNotes, draft.includeVat !== false);

        worksheet.mergeCells(`B${lastRow}:${lastCol}${lastRow}`);
        const st = worksheet.getCell(`B${lastRow}`);
        st.value = '◈ 특 약 사 항 (Special Terms)';
        st.font = { name: fontName, bold: true, size: 10, color: { argb: colorMain } };
        st.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorBg } };
        st.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        setBoxBorder(st, 'thin', colorBorder);
        
        lastRow += 1;
        worksheet.mergeCells(`B${lastRow}:${lastCol}${lastRow}`);
        const sc = worksheet.getCell(`B${lastRow}`);
        setTextCellValue(sc, exportScopeNotes);
        sc.alignment = { vertical: 'top', horizontal: 'left', wrapText: true, indent: 1 };
        sc.font = { name: fontName, size: 9, color: { argb: colorMain } };
        setBoxBorder(sc, 'thin', colorBorder);
        const lines = (exportScopeNotes.match(/\n/g) || []).length + 1;
        const chars = Math.ceil(exportScopeNotes.length / 85);
        worksheet.getRow(lastRow).height = Math.max(lines, chars) * 16 + 30;
    }

    // 7. 인쇄 설정 최적화
    // ExcelJS emits printArea as an internal defined-name formula, which can
    // trigger Excel repair warnings when the variable note section changes.
    worksheet.pageSetup.fitToPage = true;
    worksheet.pageSetup.fitToWidth = 1;
    worksheet.pageSetup.fitToHeight = 0;
    worksheet.pageSetup.horizontalCentered = true;
    worksheet.pageSetup.paperSize = 9;
    worksheet.pageSetup.orientation = (isEstimate || isRentalTransaction) ? 'landscape' : 'portrait';
    worksheet.pageSetup.margins = {
        left: 0.25,
        right: 0.25,
        top: 0.35,
        bottom: 0.35,
        header: 0.15,
        footer: 0.15
    };
    worksheet.views = options.freezePanes !== false
        ? [{ state: 'frozen', ySplit: isEstimate ? tHead1 + 1 : tHead1, showGridLines: false }]
        : [{ showGridLines: false }];

    // 8. 저장
    const buf = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `${draft.clientCompany || '업체'}_${isEstimate ? '견적서' : (isRentalTransaction ? '임대거래명세표' : '거래명세표')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
};
