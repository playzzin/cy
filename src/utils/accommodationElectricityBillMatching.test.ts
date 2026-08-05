import { Accommodation } from '../types/accommodation';
import {
    AccommodationElectricityBillAnalysis,
    AccommodationGasBillAnalysis,
    AccommodationWaterBillAnalysis,
} from '../types/accommodationElectricityBillImport';
import {
    findDuplicateAccommodationSelections,
    matchElectricityBillToAccommodation,
} from './accommodationElectricityBillMatching';

const accommodation = (id: string, name: string, address: string): Accommodation => ({
    id,
    name,
    address,
    type: 'OneRoom',
    status: 'active',
    ownership: 'Cheongyeon',
    contract: {
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        deposit: 0,
        monthlyRent: 0,
        paymentDay: 1,
        landlordName: '',
        landlordContact: '',
        isReported: false,
    },
    costProfile: {
        electricity: 'variable',
        gas: 'variable',
        water: 'variable',
        internet: 'variable',
        maintenance: 'variable',
    },
});

const bill = (housingName: string, address: string): AccommodationElectricityBillAnalysis => ({
    fileIndex: 0,
    originalFileName: 'bill.jpg',
    provider: '한국전력공사',
    customerName: '(주)청연이엔지',
    customerNumber: '02-1848-5422',
    billingYearMonth: '2026-06',
    dueDate: '2026-07-06',
    usagePeriodStart: '2026-05-16',
    usagePeriodEnd: '2026-06-15',
    address,
    housingName,
    electricityAmount: 35860,
    usageKwh: 215,
    confidence: 0.98,
    warnings: [],
});

const gasBill = (fileIndex: number, housingName: string, address: string, gasAmount: number): AccommodationGasBillAnalysis => ({
    fileIndex,
    originalFileName: `20260710133829_0000${fileIndex + 1}.jpg`,
    provider: '삼천리',
    customerName: '청연이엔지',
    payerNumber: `30700000${fileIndex}`,
    billingYearMonth: '2026-07',
    dueDate: '2026-07-10',
    usagePeriodStart: '2026-05-24',
    usagePeriodEnd: '2026-06-25',
    address,
    housingName,
    gasAmount,
    usageCubicMeters: 0,
    confidence: 0.98,
    warnings: [],
});

const waterBill = (
    fileIndex: number,
    housingName: string,
    address: string,
    waterAmount: number,
): AccommodationWaterBillAnalysis => ({
    fileIndex,
    originalFileName: `20260710133829_000${String(fileIndex + 6).padStart(2, '0')}.jpg`,
    provider: '안산시 상하수도사업소',
    customerName: `[${housingName.replace(/호$/, '')}]`,
    consumerNumber: `1271-003-393-0004-${String(fileIndex + 1).padStart(2, '0')}-1`,
    billingYearMonth: '2026-06',
    dueDate: '2026-06-20',
    usagePeriodStart: '2026-04-05',
    usagePeriodEnd: '2026-05-04',
    address,
    housingName,
    waterAmount,
    usageCubicMeters: 0,
    confidence: 0.98,
    warnings: [],
});

describe('accommodation electricity bill matching', () => {
    const accommodations = [
        accommodation('janghwa-202', '장화3길 202호', '경기도 안산시 상록구 장화3길 6 (사동 1421-3 202호)'),
        accommodation('pyeongan-202', '평안로 202호', '경기도 안산시 상록구 평안로1안길 4 (사동 1416-1 202호)'),
        accommodation('janghwa-401', '장화로 401호', '경기도 안산시 상록구 장화로 7 (사동 1415-2 401호)'),
    ];

    test('같은 호수가 있어도 전체 주소가 일치하는 숙소를 자동 선택한다', () => {
        const result = matchElectricityBillToAccommodation(
            bill('202호', '경기도 안산시 상록구 장화3길 6 (사동 1421-3 202호)'),
            accommodations,
        );

        expect(result.status).toBe('auto_matched');
        expect(result.selectedAccommodationId).toBe('janghwa-202');
    });

    test('호수만 있고 주소가 없으면 자동 선택하지 않는다', () => {
        const result = matchElectricityBillToAccommodation(bill('202호', ''), accommodations);

        expect(result.status).not.toBe('auto_matched');
        expect(result.selectedAccommodationId).toBe('');
        expect(result.warnings.join(' ')).toContain('호수만으로는');
    });

    test('도로명과 호수가 모두 다르면 잘못 자동 선택하지 않는다', () => {
        const result = matchElectricityBillToAccommodation(
            bill('303호', '경기도 안산시 상록구 초당5길 22 (사동 1394-5 303호)'),
            accommodations,
        );

        expect(result.status).toBe('no_match');
        expect(result.selectedAccommodationId).toBe('');
    });

    test('같은 숙소를 두 번 선택하면 중복으로 표시한다', () => {
        expect(Array.from(findDuplicateAccommodationSelections(['a', 'b', 'a']))).toEqual(['a']);
    });

    test('삼천리 가스 청구서 5장의 도로명과 호수를 각각 올바른 숙소에 매칭한다', () => {
        const gasAccommodations = [
            accommodation('wa-203', '와동 729-5 203호', '경기도 안산시 단원구 와개길 62 (와동 729-5 203호)'),
            accommodation('wa-202', '와동 730-5 202호', '경기도 안산시 단원구 와개길 53-1 (와동 730-5 202호)'),
            accommodation('wa-401', '와동 729-5 401호', '경기도 안산시 단원구 와개길 62 (와동 729-5 401호)'),
            accommodation('wa-103', '와동 730-5 103호', '경기도 안산시 단원구 와개길 53-1 (와동 730-5 103호)'),
            accommodation('wa-204', '와동 729-5 204호', '경기도 안산시 단원구 와개길 62 (와동 729-5 204호)'),
        ];
        const samples = [
            gasBill(0, '203호', '경기 안산시 단원구 와개길 62, (10)203 (와동 729-5)', 23500),
            gasBill(1, '202호', '경기 안산시 단원구 와개길 53-1, (10)202 (와동 730-5)', 14020),
            gasBill(2, '401호', '경기 안산시 단원구 와개길 62, (4)401 (와동 729-5)', 11910),
            gasBill(3, '103호', '경기 안산시 단원구 와개길 53-1, (7)103 (와동 730-5)', 1370),
            gasBill(4, '204호', '경기 안산시 단원구 와개길 62, (12)204 (와동 729-5)', 9800),
        ];

        expect(samples.map((sample) => (
            matchElectricityBillToAccommodation(sample, gasAccommodations).selectedAccommodationId
        ))).toEqual(['wa-203', 'wa-202', 'wa-401', 'wa-103', 'wa-204']);
    });

    test('대장 주소가 비어 있어도 숙소명의 지번과 호수가 추출 주소와 일치하면 자동 선택한다', () => {
        const accommodationsByName = [
            accommodation('wa-203', '와동 729-5 203호', ''),
            accommodation('wa-204', '와동 729-5 204호', ''),
            accommodation('wa-401', '와동 729-5 401호', ''),
        ];

        const result = matchElectricityBillToAccommodation(
            bill('401호', '경기도 안산시 단원구 와개2길 62 (와동 729-5 401호)'),
            accommodationsByName,
        );

        expect(result.status).toBe('auto_matched');
        expect(result.selectedAccommodationId).toBe('wa-401');
        expect(result.candidates[0].reasons).toContain('지번+호수 일치');
    });

    test('같은 지번과 호수가 중복된 대장 항목은 자동 선택하지 않는다', () => {
        const duplicateAccommodations = [
            accommodation('wa-401-a', '와동 729-5 401호', ''),
            accommodation('wa-401-b', '와동 729-5 401호', ''),
        ];

        const result = matchElectricityBillToAccommodation(
            bill('401호', '경기도 안산시 단원구 와개2길 62 (와동 729-5 401호)'),
            duplicateAccommodations,
        );

        expect(result.status).toBe('needs_review');
        expect(result.selectedAccommodationId).toBe('');
    });

    test('안산시 수도 청구서 7장의 호수를 초당4길 숙소에 각각 매칭한다', () => {
        const waterAccommodations = ['101', '103', '201', '203', '301', '303', '402'].map((room) => (
            accommodation(
                `sadong-${room}`,
                `사동 1393-3 ${room}호`,
                `경기도 안산시 상록구 초당4길 18 (사동 1393-3 ${room}호)`,
            )
        ));
        const samples = [
            waterBill(0, '402호', '초당4길 18[좌11]', 18920),
            waterBill(1, '203호', '초당4길 18[좌6]', 25340),
            waterBill(2, '301호', '초당4길 18[좌7]', 17950),
            waterBill(3, '303호', '초당4길 18[좌9]', 12170),
            waterBill(4, '103호', '초당4길 18[좌3]', 17990),
            waterBill(5, '201호', '초당4길 18[좌4]', 24010),
            waterBill(6, '101호', '초당4길 18[좌1]', 5390),
        ];

        expect(samples.map((sample) => (
            matchElectricityBillToAccommodation(sample, waterAccommodations).selectedAccommodationId
        ))).toEqual([
            'sadong-402',
            'sadong-203',
            'sadong-301',
            'sadong-303',
            'sadong-103',
            'sadong-201',
            'sadong-101',
        ]);
    });
});
