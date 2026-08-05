import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AccommodationElectricityBillImportModal from './AccommodationElectricityBillImportModal';
import {
    accommodationElectricityBillService,
    accommodationGasBillService,
    accommodationWaterBillService,
} from '../../services/accommodationElectricityBillService';
import { Accommodation, UtilityRecord } from '../../types/accommodation';

jest.mock('../../services/accommodationElectricityBillService', () => ({
    accommodationElectricityBillService: {
        analyzeFiles: jest.fn(),
        validateFiles: jest.fn(),
    },
    accommodationGasBillService: {
        analyzeFiles: jest.fn(),
        validateFiles: jest.fn(),
    },
    accommodationWaterBillService: {
        analyzeFiles: jest.fn(),
        validateFiles: jest.fn(),
    },
}));

const mockedAnalyze = accommodationElectricityBillService.analyzeFiles as jest.MockedFunction<
    typeof accommodationElectricityBillService.analyzeFiles
>;
const mockedGasAnalyze = accommodationGasBillService.analyzeFiles as jest.MockedFunction<
    typeof accommodationGasBillService.analyzeFiles
>;
const mockedWaterAnalyze = accommodationWaterBillService.analyzeFiles as jest.MockedFunction<
    typeof accommodationWaterBillService.analyzeFiles
>;

const accommodation: Accommodation = {
    id: 'wa-204',
    name: '와동 729-5 204호',
    address: '경기도 안산시 단원구 와개길 62 (와동 729-5 204호)',
    type: 'OneRoom',
    status: 'active',
    ownership: 'Cheongyeon',
    contract: {
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        deposit: 0,
        monthlyRent: 480000,
        paymentDay: 1,
        landlordName: '',
        landlordContact: '',
        isReported: false,
    },
    costProfile: {
        electricity: 'variable',
        gas: 'included',
        water: 'included',
        internet: 'included',
        maintenance: 'included',
    },
};

const record: UtilityRecord = {
    id: 'utility-wa-204-2026-06',
    accommodationId: accommodation.id,
    accommodationName: accommodation.name,
    yearMonth: '2026-06',
    costs: {
        rent: 480000,
        electricity: 0,
        gas: 0,
        water: 0,
        internet: 0,
        maintenance: 0,
        other: 0,
        total: 480000,
    },
    paymentStatus: 'unpaid',
};

const analysis = {
    fileIndex: 0,
    originalFileName: '20260710111817_00001.jpg',
    provider: '한국전력공사',
    customerName: '(주)청연이엔지',
    customerNumber: '02-4284-4981',
    billingYearMonth: '2026-06',
    dueDate: '2026-06-30',
    usagePeriodStart: '2026-05-11',
    usagePeriodEnd: '2026-06-10',
    address: accommodation.address,
    housingName: '204호',
    electricityAmount: 19370,
    usageKwh: 105,
    confidence: 0.98,
    warnings: [],
};

const gasAccommodation: Accommodation = {
    ...accommodation,
    id: 'wa-203',
    name: '와동 729-5 203호',
    address: '경기도 안산시 단원구 와개길 62 (와동 729-5 203호)',
    costProfile: {
        ...accommodation.costProfile,
        gas: 'variable',
    },
};

const gasRecord: UtilityRecord = {
    ...record,
    id: 'utility-wa-203-2026-07',
    accommodationId: gasAccommodation.id,
    accommodationName: gasAccommodation.name,
    yearMonth: '2026-07',
};

const gasAnalysis = {
    fileIndex: 0,
    originalFileName: '20260710133829_00005.jpg',
    provider: '삼천리',
    customerName: '(*)청연이엔지',
    payerNumber: '307583958',
    billingYearMonth: '2026-07',
    dueDate: '2026-07-10',
    usagePeriodStart: '2026-05-24',
    usagePeriodEnd: '2026-06-25',
    address: '경기 안산시 단원구 와개길 62, (10)203 (와동 729-5)',
    housingName: '203호',
    gasAmount: 23500,
    usageCubicMeters: 21,
    confidence: 0.98,
    warnings: [],
};

const waterAccommodation: Accommodation = {
    ...accommodation,
    id: 'sadong-402',
    name: '사동 1393-3 402호',
    address: '경기도 안산시 상록구 초당4길 18 (사동 1393-3 402호)',
    costProfile: {
        ...accommodation.costProfile,
        water: 'variable',
    },
};

const waterRecord: UtilityRecord = {
    ...record,
    id: 'utility-sadong-402-2026-06',
    accommodationId: waterAccommodation.id,
    accommodationName: waterAccommodation.name,
};

const waterAnalysis = {
    fileIndex: 0,
    originalFileName: '20260710133829_00006.jpg',
    provider: '안산시 상하수도사업소',
    customerName: '402호[402]',
    consumerNumber: '1271-003-393-0004-11-1',
    billingYearMonth: '2026-06',
    dueDate: '2026-06-20',
    usagePeriodStart: '2026-04-05',
    usagePeriodEnd: '2026-05-04',
    address: '초당4길 18[좌11]',
    housingName: '402호',
    waterAmount: 18920,
    usageCubicMeters: 19,
    confidence: 0.98,
    warnings: [],
};

describe('AccommodationElectricityBillImportModal', () => {
    beforeEach(() => {
        mockedAnalyze.mockResolvedValue([analysis]);
        mockedGasAnalyze.mockResolvedValue([gasAnalysis]);
        mockedWaterAnalyze.mockResolvedValue([waterAnalysis]);
        Object.defineProperty(URL, 'createObjectURL', {
            configurable: true,
            value: jest.fn(() => 'blob:electricity-bill-preview'),
        });
        Object.defineProperty(URL, 'revokeObjectURL', {
            configurable: true,
            value: jest.fn(),
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('빈 모달에서 청구서를 드롭한 뒤 분석을 시작한다', async () => {
        render(
            <AccommodationElectricityBillImportModal
                yearMonth="2026-06"
                files={[]}
                accommodations={[accommodation]}
                records={[record]}
                blockedAccommodationIds={new Set()}
                onClose={jest.fn()}
                onApply={jest.fn()}
            />,
        );

        const file = new File(['bill'], analysis.originalFileName, { type: 'image/jpeg', lastModified: 1 });
        fireEvent.drop(screen.getByTestId('ai-document-dropzone'), { dataTransfer: { files: [file] } });
        fireEvent.click(screen.getByRole('button', { name: '1건 업로드 후 분석' }));

        await waitFor(() => expect(mockedAnalyze).toHaveBeenCalledWith('2026-06', [file], expect.any(Function)));
        await waitFor(() => expect(screen.getByText('등록 가능')).toBeInTheDocument());
    });

    test('청구금액과 숙소 자동 매칭을 검수한 뒤 대장 반영 콜백으로 전달한다', async () => {
        const onApply = jest.fn();
        render(
            <AccommodationElectricityBillImportModal
                yearMonth="2026-06"
                files={[new File(['bill'], analysis.originalFileName, { type: 'image/jpeg' })]}
                accommodations={[accommodation]}
                records={[record]}
                blockedAccommodationIds={new Set()}
                onClose={jest.fn()}
                onApply={onApply}
            />,
        );

        await waitFor(() => expect(screen.getByDisplayValue('19,370')).toBeInTheDocument());
        expect(screen.getByRole('combobox')).toHaveValue(accommodation.id);
        expect(screen.getByText('주소 일치')).toBeInTheDocument();
        expect(screen.getByText('등록 가능')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '1건 대장 반영' }));
        expect(onApply).toHaveBeenCalledWith([
            expect.objectContaining({
                recordId: record.id,
                accommodationId: accommodation.id,
                electricityAmount: 19370,
                meta: expect.objectContaining({
                    customerNumber: '02-4284-4981',
                    billingYearMonth: '2026-06',
                    usageKwh: 105,
                }),
            }),
        ]);
    });

    test('추출 주소의 지번과 호수가 숙소명과 일치하면 대장 주소가 비어 있어도 숙소를 선택한다', async () => {
        const nameMatchedAccommodations: Accommodation[] = ['203', '204', '401'].map((room) => ({
            ...accommodation,
            id: `wa-${room}`,
            name: `와동 729-5 ${room}호`,
            address: '',
        }));
        const nameMatchedRecords: UtilityRecord[] = nameMatchedAccommodations.map((item) => ({
            ...record,
            id: `utility-${item.id}-2026-06`,
            accommodationId: item.id,
            accommodationName: item.name,
        }));
        mockedAnalyze.mockResolvedValueOnce([{
            ...analysis,
            address: '경기도 안산시 단원구 와개2길 62 (와동 729-5 401호)',
            housingName: '401호',
        }]);

        render(
            <AccommodationElectricityBillImportModal
                yearMonth="2026-06"
                files={[new File(['bill'], analysis.originalFileName, { type: 'image/jpeg' })]}
                accommodations={nameMatchedAccommodations}
                records={nameMatchedRecords}
                blockedAccommodationIds={new Set()}
                onClose={jest.fn()}
                onApply={jest.fn()}
            />,
        );

        await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('wa-401'));
        expect(screen.getByText('지번+호수 일치')).toBeInTheDocument();
        expect(screen.getByText('등록 가능')).toBeInTheDocument();
    });

    test('이미 청구 처리된 숙소는 AI 결과를 대장에 반영하지 못하게 막는다', async () => {
        render(
            <AccommodationElectricityBillImportModal
                yearMonth="2026-06"
                files={[new File(['bill'], analysis.originalFileName, { type: 'image/jpeg' })]}
                accommodations={[accommodation]}
                records={[record]}
                blockedAccommodationIds={new Set([accommodation.id])}
                onClose={jest.fn()}
                onApply={jest.fn()}
            />,
        );

        await waitFor(() => expect(screen.getByText('이미 청구 처리된 숙소입니다. 먼저 미청구로 변경해 주세요.')).toBeInTheDocument());
        expect(screen.getByRole('button', { name: '1건 대장 반영' })).toBeDisabled();
    });

    test('가스 청구서의 총 고지금액과 납부자번호를 검수해 가스비로 전달한다', async () => {
        const onApply = jest.fn();
        render(
            <AccommodationElectricityBillImportModal
                utilityType="gas"
                yearMonth="2026-07"
                files={[new File(['gas-bill'], gasAnalysis.originalFileName, { type: 'image/jpeg' })]}
                accommodations={[gasAccommodation]}
                records={[gasRecord]}
                blockedAccommodationIds={new Set()}
                onClose={jest.fn()}
                onApply={onApply}
            />,
        );

        await waitFor(() => expect(screen.getByDisplayValue('23,500')).toBeInTheDocument());
        expect(screen.getByText(/가스요금 청구서 일괄등록/)).toBeInTheDocument();
        expect(screen.getByText('납부자번호 307583958')).toBeInTheDocument();
        expect(screen.getByText(/사용량 21m³/)).toBeInTheDocument();
        expect(screen.queryByDisplayValue('30,970')).not.toBeInTheDocument();
        expect(screen.getByRole('combobox')).toHaveValue(gasAccommodation.id);

        fireEvent.click(screen.getByRole('button', { name: '1건 대장 반영' }));
        expect(onApply).toHaveBeenCalledWith([
            expect.objectContaining({
                utilityType: 'gas',
                recordId: gasRecord.id,
                accommodationId: gasAccommodation.id,
                gasAmount: 23500,
                meta: expect.objectContaining({
                    payerNumber: '307583958',
                    billingYearMonth: '2026-07',
                    usageCubicMeters: 21,
                }),
            }),
        ]);
    });

    test('수도 청구서의 현재 납부금액과 수용가번호를 검수해 수도료로 전달한다', async () => {
        const onApply = jest.fn();
        render(
            <AccommodationElectricityBillImportModal
                utilityType="water"
                yearMonth="2026-06"
                files={[new File(['water-bill'], waterAnalysis.originalFileName, { type: 'image/jpeg' })]}
                accommodations={[waterAccommodation]}
                records={[waterRecord]}
                blockedAccommodationIds={new Set()}
                onClose={jest.fn()}
                onApply={onApply}
            />,
        );

        await waitFor(() => expect(screen.getByDisplayValue('18,920')).toBeInTheDocument());
        expect(screen.getByText(/수도요금 청구서 일괄등록/)).toBeInTheDocument();
        expect(screen.getByText('수용가번호 1271-003-393-0004-11-1')).toBeInTheDocument();
        expect(screen.getByText(/사용량 19m³/)).toBeInTheDocument();
        expect(screen.queryByDisplayValue('15,030')).not.toBeInTheDocument();
        expect(screen.getByRole('combobox')).toHaveValue(waterAccommodation.id);

        fireEvent.click(screen.getByRole('button', { name: '1건 대장 반영' }));
        expect(onApply).toHaveBeenCalledWith([
            expect.objectContaining({
                utilityType: 'water',
                recordId: waterRecord.id,
                accommodationId: waterAccommodation.id,
                waterAmount: 18920,
                meta: expect.objectContaining({
                    consumerNumber: '1271-003-393-0004-11-1',
                    billingYearMonth: '2026-06',
                    usageCubicMeters: 19,
                }),
            }),
        ]);
    });

    test('수도료 포함 숙소는 검수 결과를 대장에 반영하지 못하게 막는다', async () => {
        const includedAccommodation: Accommodation = {
            ...waterAccommodation,
            costProfile: { ...waterAccommodation.costProfile, water: 'included' },
        };
        render(
            <AccommodationElectricityBillImportModal
                utilityType="water"
                yearMonth="2026-06"
                files={[new File(['water-bill'], waterAnalysis.originalFileName, { type: 'image/jpeg' })]}
                accommodations={[includedAccommodation]}
                records={[waterRecord]}
                blockedAccommodationIds={new Set()}
                onClose={jest.fn()}
                onApply={jest.fn()}
            />,
        );

        await waitFor(() => expect(screen.getByText('수도료 포함 숙소라 등록할 수 없습니다.')).toBeInTheDocument());
        expect(screen.getByRole('button', { name: '1건 대장 반영' })).toBeDisabled();
    });
});
