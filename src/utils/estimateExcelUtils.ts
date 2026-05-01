import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { EstimateDraft, formatCurrency, numberToKorean, LOGO_FALLBACK } from './estimateUtils';

/**
 * 이미지 URL을 ArrayBuffer로 변환합니다.
 */
const getImageBuffer = async (url: string): Promise<ArrayBuffer> => {
    try {
        const response = await fetch(url);
        return await response.arrayBuffer();
    } catch (e) {
        console.error('Image fetch error:', e);
        throw e;
    }
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
    type: 'estimate' | 'transaction' = 'estimate'
) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(type === 'estimate' ? '견적서' : '거래명세표');

    const isEstimate = type === 'estimate';
    
    // 고품격 모노톤 컬러 스키마
    const colorMain = 'FF333333';   // 다크 차콜 (헤더)
    const colorSub = 'FF666666';    // 미디움 그레이
    const colorBg = 'FFF5F5F5';     // 라이트 그레이 (라벨)
    const colorText = 'FFFFFFFF';   // 화이트 (헤더 텍스트)
    const colorBorder = 'FF000000'; // 블랙 (테두리)

    const installRatio = draft.installRatio || 50;
    const removeRatio = 100 - installRatio;
    const vatRate = draft.vatRate || 10;

    // 1. 컬럼 너비 및 마지막 열 설정
    const lastCol = isEstimate ? 'J' : 'I';
    if (isEstimate) {
        worksheet.columns = [
            { width: 4 }, { width: 14 }, { width: 24 }, { width: 8 }, { width: 10 }, 
            { width: 14 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 18 },
        ];
    } else {
        worksheet.columns = [
            { width: 4 }, { width: 14 }, { width: 26 }, { width: 10 }, { width: 10 },
            { width: 15 }, { width: 18 }, { width: 18 }, { width: 24 },
        ];
    }

    // 2. 로고 및 제목
    try {
        const logoBuffer = await getImageBuffer(LOGO_FALLBACK);
        const logoId = workbook.addImage({ buffer: logoBuffer, extension: 'png' });
        worksheet.addImage(logoId, {
            tl: { col: 1.1, row: 1.2 },
            ext: { width: 130, height: 48 }
        });
    } catch (e) {
        console.warn('Logo load failed');
    }

    const titleRow = worksheet.getRow(2);
    titleRow.height = 60;
    const titleCell = worksheet.getCell('B2');
    titleCell.value = isEstimate ? '견  적  서' : '거 래 명 세 표';
    titleCell.font = { name: '나눔고딕', size: 32, bold: true };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.mergeCells(`B2:${lastCol}2`);
    worksheet.getCell('B2').border = { bottom: { style: 'double', color: { argb: colorBorder } } };

    // 3. 상단 정보 테이블
    const infoStartRow = 5;
    const clientSpan = isEstimate ? 'D' : 'C';
    const supplierStart = isEstimate ? 'F' : 'E';

    const setHeadStyle = (cell: ExcelJS.Cell) => {
        cell.font = { name: '나눔고딕', size: 10, bold: true, color: { argb: colorText } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorMain } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    };

    worksheet.mergeCells(`B${infoStartRow}:${clientSpan}${infoStartRow}`);
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
        worksheet.getRow(rIdx).height = 28;

        const setStyle = (cell: ExcelJS.Cell, isLabel = false) => {
            cell.font = { name: '나눔고딕', size: 9, bold: isLabel };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { vertical: 'middle', horizontal: isLabel ? 'center' : 'left', indent: isLabel ? 0 : 1 };
            if (isLabel) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorBg } };
        };

        const lblL = worksheet.getCell(`B${rIdx}`);
        const valL = worksheet.getCell(`C${rIdx}`);
        lblL.value = rowData.left[0];
        valL.value = rowData.left[1];
        worksheet.mergeCells(`C${rIdx}:${clientSpan}${rIdx}`);
        setStyle(lblL, true);
        setStyle(valL);

        const lblR = worksheet.getCell(`${supplierStart}${rIdx}`);
        lblR.value = rowData.right[0];
        setStyle(lblR, true);

        if (rowData.right.length === 2) {
            const valR = worksheet.getCell(`${String.fromCharCode(supplierStart.charCodeAt(0) + 1)}${rIdx}`);
            valR.value = rowData.right[1];
            worksheet.mergeCells(`${String.fromCharCode(supplierStart.charCodeAt(0) + 1)}${rIdx}:${lastCol}${rIdx}`);
            setStyle(valR);
        } else {
            const vR1 = worksheet.getCell(`${String.fromCharCode(supplierStart.charCodeAt(0) + 1)}${rIdx}`);
            const lR2 = worksheet.getCell(`${String.fromCharCode(lastCol.charCodeAt(0) - 1)}${rIdx}`);
            const vR2 = worksheet.getCell(`${lastCol}${rIdx}`);
            vR1.value = rowData.right[1];
            lR2.value = rowData.right[2];
            vR2.value = rowData.right[3];
            worksheet.mergeCells(`${String.fromCharCode(supplierStart.charCodeAt(0) + 1)}${rIdx}:${String.fromCharCode(lastCol.charCodeAt(0) - 2)}${rIdx}`);
            setStyle(vR1);
            setStyle(lR2, true);
            setStyle(vR2);
        }
        for (let c = 'B'.charCodeAt(0); c <= lastCol.charCodeAt(0); c++) {
            const cell = worksheet.getCell(`${String.fromCharCode(c)}${rIdx}`);
            if (!cell.border) setStyle(cell);
        }
    });

    // 4. 합계 섹션
    const amountRowIdx = infoStartRow + infoRows.length + 2;
    worksheet.getRow(amountRowIdx).height = 42;
    worksheet.mergeCells(`B${amountRowIdx}:${clientSpan}${amountRowIdx}`);
    const amtLabel = worksheet.getCell(`B${amountRowIdx}`);
    amtLabel.value = isEstimate ? '견적 합계 금액' : '명세 합계 금액';
    
    worksheet.mergeCells(`${String.fromCharCode(clientSpan.charCodeAt(0) + 1)}${amountRowIdx}:${lastCol}${amountRowIdx}`);
    const amtValue = worksheet.getCell(`${String.fromCharCode(clientSpan.charCodeAt(0) + 1)}${amountRowIdx}`);
    amtValue.value = `일금 ${numberToKorean(total)}원 정  ( ￦ ${formatCurrency(total)} )`;

    [amtLabel, amtValue].forEach(cell => {
        cell.font = { name: '나눔고딕', size: 12, bold: true, color: { argb: cell === amtLabel ? colorText : colorMain } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cell === amtLabel ? colorMain : 'FFF2F2F2' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'medium' }, left: { style: 'medium' }, bottom: { style: 'medium' }, right: { style: 'medium' } };
    });

    // 5. 품목 테이블 헤더
    const tHead1 = amountRowIdx + 2;
    const setTableHeadStyle = (cell: ExcelJS.Cell, isDark = true) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isDark ? colorMain : colorSub } };
        cell.font = { name: '나눔고딕', size: 9, bold: true, color: { argb: colorText } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    };

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
        items.forEach((item, idx) => {
            const vals = isRental 
                ? [
                    item.category, 
                    item.section || item.label, 
                    item.unit, 
                    item.quantity, 
                    item.laborUnitPrice || item.finalUnitPrice, 
                    item.laborAmount || 0, 
                    item.rentalUnitPrice || 0, 
                    item.rentalAmount || 0, 
                    item.note
                  ]
                : [
                    item.category, 
                    item.section || item.label, 
                    item.unit, 
                    item.quantity, 
                    item.finalUnitPrice, 
                    item.amount, 
                    item.install50, 
                    item.remove50, 
                    item.note
                  ];

            ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].forEach((col, i) => {
                const cell = worksheet.getCell(`${col}${curr}`);
                cell.value = vals[i];
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cell.font = { name: '나눔고딕', size: 9 };
                if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
                if (i >= 3 && i <= 7) { cell.numFmt = '#,##0'; cell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 }; }
                else cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
            curr++;
        });
    } else {
        worksheet.getRow(tHead1).height = 36;
        const transH = ['날짜', '품목', '단위', '수량', '단가', '공급가액', '세액', '비고'];
        const transCols = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
        transH.forEach((h, i) => {
            const cell = worksheet.getCell(transCols[i] + tHead1);
            cell.value = h;
            setTableHeadStyle(cell);
        });

        let curr = tHead1 + 1;
        items.forEach((item, idx) => {
            const supplyAmt = item.amount || 0;
            const vatAmt = supplyAmt ? Math.round(supplyAmt * vatRate / 100) : 0;
            const vals = [item.itemDate || '', item.category, item.unit, item.quantity, item.finalUnitPrice, supplyAmt, vatAmt, item.note];
            transCols.forEach((col, i) => {
                const cell = worksheet.getCell(`${col}${curr}`);
                cell.value = vals[i];
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cell.font = { name: '나눔고딕', size: 9 };
                if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
                if (i >= 3 && i <= 6) { cell.numFmt = '#,##0'; cell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 }; }
                else cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
            curr++;
        });
    }

    // 6. 특약사항
    let lastRow = isEstimate ? tHead1 + 2 + items.length + 1 : tHead1 + 1 + items.length + 1;
    if (draft.scopeNotes) {
        worksheet.mergeCells(`B${lastRow}:${lastCol}${lastRow}`);
        const st = worksheet.getCell(`B${lastRow}`);
        st.value = '◈ 특 약 사 항 (Special Terms)';
        st.font = { bold: true, size: 10, color: { argb: colorMain } };
        
        lastRow += 1;
        worksheet.mergeCells(`B${lastRow}:${lastCol}${lastRow}`);
        const sc = worksheet.getCell(`B${lastRow}`);
        sc.value = draft.scopeNotes;
        sc.alignment = { vertical: 'top', horizontal: 'left', wrapText: true, indent: 1 };
        sc.font = { name: '나눔고딕', size: 9 };
        sc.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        const lines = (draft.scopeNotes.match(/\n/g) || []).length + 1;
        const chars = Math.ceil(draft.scopeNotes.length / 85);
        worksheet.getRow(lastRow).height = Math.max(lines, chars) * 16 + 30;
    }

    // 7. 인쇄 설정 최적화
    worksheet.pageSetup.printArea = `B1:${lastCol}${lastRow + 2}`;
    worksheet.pageSetup.fitToPage = true;
    worksheet.pageSetup.fitToWidth = 1;
    worksheet.pageSetup.fitToHeight = 0;
    worksheet.pageSetup.horizontalCentered = true;

    // 8. 저장
    const buf = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `${draft.clientCompany || '업체'}_${isEstimate ? '견적서' : '거래명세표'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
};
