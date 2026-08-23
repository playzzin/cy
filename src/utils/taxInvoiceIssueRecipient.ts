import type { TaxInvoiceIssue } from '../types/taxInvoiceList';

/**
 * 현장 마스터의 발주사명을 발행리스트에 반영하되, 사용자가 직접 수정한
 * 공급받는자는 월 이동이나 새로고침 뒤에도 덮어쓰지 않는다.
 */
export const syncIssueRecipientFromSite = (
    issue: TaxInvoiceIssue,
    currentSiteRecipient: unknown
): TaxInvoiceIssue => {
    if (issue.recipientManuallyEdited === true) return issue;

    const recipient = String(currentSiteRecipient ?? '').trim();
    if (!recipient || recipient === issue.recipient) return issue;

    return { ...issue, recipient };
};
