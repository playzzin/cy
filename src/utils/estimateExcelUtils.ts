import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { EstimateDraft, formatCurrency, numberToKorean, LOGO_FALLBACK } from './estimateUtils';

type ExcelImageExtension = 'png' | 'jpeg';

type DownloadEstimateExcelOptions = {
    freezePanes?: boolean;
};

const EMU_PER_PIXEL = 9525;

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
    cell.value = sanitizeExcelText(value);
    cell.numFmt = '@';
};

const setCellValue = (cell: ExcelJS.Cell, value: unknown) => {
    if (typeof value === 'string') {
        setTextCellValue(cell, value);
        return;
    }

    cell.value = value as ExcelJS.CellValue;
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
