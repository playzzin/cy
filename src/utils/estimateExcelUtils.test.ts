import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { createItem, getEmptyDraft } from './estimateUtils';
import { downloadEstimateExcel } from './estimateExcelUtils';

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));

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
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            headers: { get: () => 'image/png' },
            blob: async () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })
        });
    });

    afterEach(() => {
        global.fetch = originalFetch;
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
            section: '수직재 1900',
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
        expect(sheet!.getCell('I15').result).toBe(4000);
        expect(sheet!.getCell('J15').result).toBe(400);
        expect(sheet!.getCell('K15').result).toBe(4400);
        expect(sheet!.getCell('I25').formula).toBe('SUM(I15:I24)');
        expect(sheet!.pageSetup.orientation).toBe('landscape');
        expect(sheet!.pageSetup.fitToWidth).toBe(1);
    });

    it('includes the rental subtotal in the rental estimate grand total formula', async () => {
        const draft = {
            ...getEmptyDraft('estimate'),
            estimateMode: 'rental' as const,
            includeVat: false,
            clientCompany: '테스트 발주처',
            projectName: '테스트 현장',
            supplierCompany: '청연이엔지(주)',
            scopeNotes: ''
        };
        const item = {
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

        await downloadEstimateExcel(draft, [item], 3000, 0, 3000, 'estimate', { freezePanes: false });

        const output = mockedSaveAs.mock.calls[0]?.[0] as Blob;
        const outputBuffer = await blobToArrayBuffer(output);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(outputBuffer);
        const sheet = workbook.getWorksheet('견적서');

        expect(sheet).toBeDefined();
        expect(sheet!.getCell('G21').formula).toBe('SUM(G20,I20)');
        expect(sheet!.getCell('G21').result).toBe(3000);
        expect(sheet!.getCell('I21').result).toBe(1000);
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
