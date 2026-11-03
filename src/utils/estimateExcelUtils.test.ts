import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { createItem, getEmptyDraft } from './estimateUtils';
import { downloadEstimateExcel } from './estimateExcelUtils';
import { documentStampService } from '../services/documentStampService';

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));
jest.mock('../services/documentStampService', () => ({ documentStampService: { getUrl: jest.fn() } }));

const mockedSaveAs = saveAs as jest.MockedFunction<typeof saveAs>;
const originalFetch = global.fetch;

const blobToArrayBuffer = (blob: Blob): Promise<ArrayBuffer> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
});

describe('downloadEstimateExcel', () => {
    beforeEach(() => {
        mockedSaveAs.mockReset();
        (documentStampService.getUrl as jest.Mock).mockReset().mockResolvedValue('/assets/estimate/cheongyeon-stamp-round.png');
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            headers: { get: () => 'image/png' },
            blob: async () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })
        });
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it.each(['estimate', 'transaction'] as const)('uses the managed %s stamp while retaining the original image anchor and size', async type => {
        (documentStampService.getUrl as jest.Mock).mockResolvedValue('/managed-seal.png');
        const draft = { ...getEmptyDraft(type), supplierCompany: '테스트 회사' };
        await downloadEstimateExcel(draft, [], 0, 0, 0, type);
        expect(documentStampService.getUrl).toHaveBeenCalledWith(type, '테스트 회사', 'excel');
        expect(global.fetch).toHaveBeenCalledWith('/managed-seal.png');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await blobToArrayBuffer(mockedSaveAs.mock.calls[0][0] as Blob));
        const stamp = workbook.worksheets[0].getImages()[1];
        expect(stamp.range.tl.nativeCol).toBe(10);
        expect(stamp.range.tl.nativeRow).toBe(5);
        expect(stamp.range.tl.nativeColOff).toBe(266700);
        expect(stamp.range).toMatchObject({ ext: { width: 70, height: 63 } });
    });

    it('exports the document and logo when the stamp was deleted without a replacement', async () => {
        (documentStampService.getUrl as jest.Mock).mockResolvedValue(null);
        await downloadEstimateExcel(getEmptyDraft('estimate'), [], 0, 0, 0, 'estimate');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await blobToArrayBuffer(mockedSaveAs.mock.calls[0][0] as Blob));
        expect(workbook.worksheets[0].getImages()).toHaveLength(1);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('keeps the reference estimate borders thin and anchors the stamp to the supplier cell right edge', async () => {
        const draft = {
            ...getEmptyDraft('estimate'),
            clientCompany: '테스트 발주처',
            projectName: '테스트 현장',
            supplierCompany: '청연ENG',
            supplierName: '이재욱',
            supplierBizNo: '123-45-67890',
            supplierAccount: '국민은행 123-456-7890',
            scopeNotes: ''
        };
        const item = createItem({
            category: '테스트 공종',
            section: '설치 구간',
            unit: 'm',
            quantity: 2,
            finalUnitPrice: 10000,
            amount: 20000
        });

        await downloadEstimateExcel(draft, [item], 20000, 2000, 22000, 'estimate', { freezePanes: false });

        const output = mockedSaveAs.mock.calls[0]?.[0] as Blob;
        expect(output).toBeInstanceOf(Blob);

        const outputBuffer = await blobToArrayBuffer(output);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(outputBuffer);
        const sheet = workbook.getWorksheet('견적서');

        expect(sheet).toBeDefined();
        const images = sheet!.getImages();
        expect(images).toHaveLength(2);
        expect(images[0].range.tl.nativeCol).toBe(6);
        expect(images[0].range.tl.nativeRow).toBe(5);
        expect(images[0].range.tl.nativeColOff).toBe(64350);
        expect(images[1].range.tl.nativeCol).toBe(10);
        expect(images[1].range.tl.nativeRow).toBe(5);
        expect(images[1].range.tl.nativeColOff).toBe(266700);
        expect(sheet!.getCell('K3').master.address).toBe('B2');
        expect(sheet!.getCell('K15').master.address).toBe('J14');
        expect(sheet!.getColumn(11).width).toBe(13.125);
        ['B5', 'B6', 'D6', 'F5', 'F6', 'J6', 'B12', 'E12'].forEach((address) => {
            const border = sheet!.getCell(address).border;
            expect(border.top?.style).toBe('thin');
            expect(border.bottom?.style).toBe('thin');
            expect(border.left?.style).toBe('thin');
            expect(border.right?.style).toBe('thin');
        });
    });

    it('exports rental transactions in the reference layout without clipping the title', async () => {
        const draft = {
            ...getEmptyDraft('transaction'),
            estimateMode: 'rental' as const,
            clientCompany: '테스트 발주처',
            projectName: '테스트 현장',
            supplierCompany: '청연이엔지(주)',
            supplierName: '이재욱',
            supplierBizNo: '123-45-67890',
            supplierAccount: '국민은행 123-456-7890'
        };
        const item = createItem({
            category: '시스템 동바리',
            section: '동바리 수직재',
            rentalSpec: 'P-17',
            unit: 'EA',
            quantity: 2,
            finalUnitPrice: 1000,
            rentalUnitPrice: 100,
            period: 10,
            note: '임대 자재'
        });

        await downloadEstimateExcel(draft, [item], 4000, 400, 4400, 'transaction', { freezePanes: false });

        const output = mockedSaveAs.mock.calls[0]?.[0] as Blob;
        expect(output).toBeInstanceOf(Blob);

        const outputBuffer = await blobToArrayBuffer(output);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(outputBuffer);
        const sheet = workbook.getWorksheet('임대거래명세표');

        expect(sheet).toBeDefined();
        expect(sheet!.getCell('B2').value).toBe('임 대 거 래 명 세 표');
        expect(sheet!.getCell('K3').master.address).toBe('B2');
        expect(sheet!.getCell('B2').alignment.shrinkToFit).toBe(true);
        expect(sheet!.getCell('F5').value).toBe('공  급  자');
        expect(sheet!.getCell('G6').master.address).toBe('G6');

        const images = sheet!.getImages();
        expect(images).toHaveLength(2);
        expect(images[0].range.tl.nativeCol).toBe(6);
        expect(images[0].range.tl.nativeRow).toBe(5);
        expect(images[0].range.tl.nativeColOff).toBe(64350);
        expect(images[1].range.tl.nativeCol).toBe(10);
        expect(images[1].range.tl.nativeColOff).toBe(266700);

        expect(sheet!.getCell('B14').value).toBe('날     짜');
        expect(sheet!.getCell('G14').value).toBe('사용 일수');
        expect(sheet!.getCell('K14').value).toBe('합     계');
        expect(sheet!.getRow(15).height).toBe(22.5);
        expect(sheet!.getCell('C15').value).toBe('동바리 수직재 P-17');
        expect(sheet!.getCell('E15').value).toBe(2);
        expect(sheet!.getCell('E15').numFmt).toBe('#,##0');
        expect(sheet!.getCell('G15').numFmt).toBe('#,##0');
        expect(sheet).toMatchObject({ conditionalFormattings: ['E', 'G'].map(column => ({
            ref: `${column}15:${column}24`,
            rules: [{ type: 'expression', formulae: [`MOD(ROUND(${column}15,2),1)<>0`], style: { numFmt: { formatCode: '#,##0.0#' } } }],
        })) });
        expect(sheet!.getCell('F15').value).toBe(1000);
        expect(sheet!.getCell('H15').value).toBe(100);
        expect(sheet!.getCell('I15').result).toBe(4000);
        expect(sheet!.getCell('J15').result).toBe(400);
        expect(sheet!.getCell('K15').result).toBe(4400);
        expect(sheet!.getCell('I25').formula).toBe('SUM(I15:I24)');
        expect(sheet!.pageSetup.orientation).toBe('landscape');
        expect(sheet!.pageSetup.fitToWidth).toBe(1);
    });

    it.each([22, 23, 24, 25])('matches the document VAT-inclusive total across %i rental rows', async rowCount => {
        const supply = 27272727;
        const amounts = [16, 16, ...Array<number>(rowCount - 3).fill(1000), supply - 32 - (rowCount - 3) * 1000];
        const items = amounts.map(amount => createItem({ quantity: 1, finalUnitPrice: amount }));
        const draft = { ...getEmptyDraft('transaction'), estimateMode: 'rental' as const };
        const tax = Math.round(supply * 0.1);
        expect(amounts.reduce((sum, amount) => sum + amount + Math.round(amount * 0.1), 0)).toBe(30000001);

        await downloadEstimateExcel(draft, items, supply, tax, supply + tax, 'transaction');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await blobToArrayBuffer(mockedSaveAs.mock.calls[0][0] as Blob));
        const sheet = workbook.getWorksheet('임대거래명세표')!;
        const totalRow = 15 + rowCount;
        expect(sheet.getCell('E12').value).toContain('30,000,000');
        expect(sheet.getCell('J16').formula).toBe('IF(I16="","",ROUND(SUM(I$15:I16)*10/100,0)-SUM(J$14:J15))');
        expect(sheet.getCell('J16').result).toBe(1);
        const sumCells = (column: string) => items.reduce((sum, _, index) => sum + Number(sheet.getCell(column + (15 + index)).result), 0);
        expect(sumCells('J')).toBe(tax);
        expect(sumCells('K')).toBe(30000000);
        expect(sheet.getCell('J' + totalRow).result).toBe(tax);
        expect(sheet.getCell('K' + totalRow).result).toBe(30000000);
    });

    it('keeps labor and rental grand totals separate across estimate categories', async () => {
        const draft = {
            ...getEmptyDraft('estimate'),
            estimateMode: 'rental' as const,
            includeVat: false,
            clientCompany: '테스트 발주처',
            projectName: '테스트 현장',
            supplierCompany: '청연이엔지(주)',
            scopeNotes: ''
        };
        const shoringItem = {
            ...createItem({
                category: '시스템 동바리',
                section: '설치/해체',
                unit: '㎥',
                quantity: 2,
                laborUnitPrice: 1000,
                rentalUnitPrice: 500
            }),
            laborAmount: 2000,
            rentalAmount: 1000,
            amount: 3000
        };
        const scaffoldItem = {
            ...createItem({
                category: '시스템 비계',
                section: '설치/해체',
                unit: '㎡',
                quantity: 1,
                laborUnitPrice: 3000,
                rentalUnitPrice: 2000
            }),
            laborAmount: 3000,
            rentalAmount: 2000,
            amount: 5000
        };

        await downloadEstimateExcel(draft, [shoringItem, scaffoldItem], 8000, 0, 8000, 'estimate', { freezePanes: false });

        const output = mockedSaveAs.mock.calls[0]?.[0] as Blob;
        const outputBuffer = await blobToArrayBuffer(output);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(outputBuffer);
        const sheet = workbook.getWorksheet('견적서');

        expect(sheet).toBeDefined();
        expect(sheet!.getCell('G26').formula).toBe('SUM(G20,G25)');
        expect(sheet!.getCell('G26').result).toBe(5000);
        expect(sheet!.getCell('I26').formula).toBe('SUM(I20,I25)');
        expect(sheet!.getCell('I26').result).toBe(3000);
    });

    it('exports standard transactions in the attached B-to-K layout with a visible note column', async () => {
        const draft = {
            ...getEmptyDraft('transaction'),
            estimateMode: 'standard' as const,
            clientCompany: '테스트 발주처',
            projectName: '테스트 현장',
            supplierCompany: '청연이엔지(주)',
            supplierName: '이재욱',
            supplierBizNo: '123-45-67890',
            supplierAccount: '국민은행 123-456-7890'
        };
        const item = createItem({
            section: '안전발판',
            unit: 'EA',
            quantity: 3,
            finalUnitPrice: 10000,
            amount: 30000,
            note: '중앙 비고'
        });

        await downloadEstimateExcel(draft, [item], 30000, 3000, 33000, 'transaction', { freezePanes: false });

        const output = mockedSaveAs.mock.calls[0]?.[0] as Blob;
        const outputBuffer = await blobToArrayBuffer(output);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(outputBuffer);
        const sheet = workbook.getWorksheet('거래명세표');

        expect(sheet).toBeDefined();
        expect(sheet!.getCell('B2').value).toBe('거 래 명 세 표');
        expect(sheet!.getCell('K3').master.address).toBe('B2');
        expect(sheet!.getCell('K14').master.address).toBe('J14');
        expect(sheet!.getCell('K15').master.address).toBe('J15');
        expect(sheet!.getCell('J15').value).toBe('중앙 비고');
        expect(sheet!.getCell('G15').result).toBe(30000);
        expect(sheet!.getCell('H15').result).toBe(3000);
        expect(sheet!.getCell('I15').result).toBe(33000);
        expect(sheet!.getCell('G25').formula).toBe('SUM(G15:G24)');
        expect(sheet!.getRow(15).height).toBe(22.5);
        expect(sheet!.views[0].showGridLines).toBe(false);
    });
});
