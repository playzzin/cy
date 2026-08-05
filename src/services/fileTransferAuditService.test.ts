jest.mock('../config/firebase', () => ({
    auth: { currentUser: null },
}));

jest.mock('./auditService', () => ({
    auditService: { log: jest.fn() },
}));

import { getFileTransferKindForDownload } from './fileTransferAuditService';

describe('getFileTransferKindForDownload', () => {
    it('classifies supported Excel download formats case-insensitively', () => {
        expect(getFileTransferKindForDownload('monthly-report.xlsx')).toBe('excel');
        expect(getFileTransferKindForDownload('MONTHLY.XLS')).toBe('excel');
        expect(getFileTransferKindForDownload('errors.CSV')).toBe('excel');
    });

    it('classifies PDF downloads and leaves unrelated files out of this audit stream', () => {
        expect(getFileTransferKindForDownload('invoice.pdf')).toBe('pdf');
        expect(getFileTransferKindForDownload('image.png')).toBeUndefined();
        expect(getFileTransferKindForDownload('')).toBeUndefined();
    });
});
