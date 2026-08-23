import { syncIssueRecipientFromSite } from './taxInvoiceIssueRecipient';
import type { TaxInvoiceIssue } from '../types/taxInvoiceList';

const makeIssue = (overrides: Partial<TaxInvoiceIssue> = {}): TaxInvoiceIssue => ({
    id: 'issue-1',
    yearMonth: '2026-07',
    no: 1,
    isNew: '',
    issueDate: '2026-07-31',
    recipient: '기존 공급받는자',
    item: '',
    supplyAmount: 0,
    note: '',
    manDays: 0,
    issueStatus: 'pending',
    scanCompleted: false,
    ...overrides,
});

describe('syncIssueRecipientFromSite', () => {
    it('사용자가 직접 수정한 공급받는자는 현장 마스터 값으로 덮어쓰지 않는다', () => {
        const issue = makeIssue({
            recipient: '직접 수정한 거래처',
            recipientManuallyEdited: true,
        });

        expect(syncIssueRecipientFromSite(issue, '현장 마스터 발주사')).toBe(issue);
        expect(syncIssueRecipientFromSite(issue, '현장 마스터 발주사').recipient).toBe('직접 수정한 거래처');
    });

    it('직접 수정하지 않은 항목은 현재 현장 마스터의 발주사명을 반영한다', () => {
        const issue = makeIssue();

        expect(syncIssueRecipientFromSite(issue, '현장 마스터 발주사')).toEqual({
            ...issue,
            recipient: '현장 마스터 발주사',
        });
    });
});
