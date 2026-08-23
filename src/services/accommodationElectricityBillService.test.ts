import { httpsCallable } from 'firebase/functions';
import { accommodationElectricityBillService } from './accommodationElectricityBillService';

jest.mock('firebase/functions', () => ({
    httpsCallable: jest.fn(),
}));

jest.mock('../config/firebase', () => ({
    functions: {},
}));

jest.mock('./aiSettingsService', () => ({
    aiSettingsService: {
        assertPathEnabled: jest.fn(),
    },
}));

const mockedHttpsCallable = httpsCallable as jest.MockedFunction<typeof httpsCallable>;
const callable = jest.fn();
const expectedSha256 = '07'.repeat(32);
const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

const buildFile = (name: string): File => {
    const file = new File(['same-bill-bytes'], name, { type: 'image/jpeg' });
    Object.defineProperty(file, 'arrayBuffer', {
        configurable: true,
        value: jest.fn(async () => new Uint8Array([1, 2, 3]).buffer),
    });
    return file;
};

const analysis = {
    fileIndex: 0,
    originalFileName: 'bill.jpg',
    provider: '한국전력공사',
    customerName: '청연이엔지',
    customerNumber: '1234',
    billingYearMonth: '2026-06',
    dueDate: '2026-06-30',
    usagePeriodStart: '2026-05-01',
    usagePeriodEnd: '2026-05-31',
    address: '안산시',
    housingName: '204호',
    electricityAmount: 19370,
    usageKwh: 105,
    confidence: 0.98,
    warnings: [],
};

describe('accommodationElectricityBillService file identity', () => {
    beforeEach(() => {
        callable.mockReset();
        mockedHttpsCallable.mockReset();
        mockedHttpsCallable.mockReturnValue(callable as never);
        Object.defineProperty(globalThis, 'crypto', {
            configurable: true,
            value: {
                subtle: {
                    digest: jest.fn(async () => new Uint8Array(32).fill(7).buffer),
                },
            },
        });
    });

    afterAll(() => {
        if (originalCryptoDescriptor) {
            Object.defineProperty(globalThis, 'crypto', originalCryptoDescriptor);
        } else {
            delete (globalThis as { crypto?: Crypto }).crypto;
        }
    });

    it('stops byte-identical attachments before calling the analysis function', async () => {
        await expect(accommodationElectricityBillService.analyzeFiles(
            '2026-06',
            [buildFile('first.jpg'), buildFile('renamed.jpg')],
        )).rejects.toThrow('동일한 파일');

        expect(callable).not.toHaveBeenCalled();
    });

    it('sends SHA-256 to the function and preserves it when the response is from an older server', async () => {
        callable.mockResolvedValue({ data: { bills: [analysis] } });

        const result = await accommodationElectricityBillService.analyzeFiles(
            '2026-06',
            [buildFile('bill.jpg')],
        );

        expect(callable).toHaveBeenCalledWith(expect.objectContaining({
            files: [expect.objectContaining({ sourceFileSha256: expectedSha256 })],
        }));
        expect(result[0].sourceFileSha256).toBe(expectedSha256);
    });
});
