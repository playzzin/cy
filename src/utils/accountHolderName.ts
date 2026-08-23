const normalizeAccountHolderName = (value: unknown): string => String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .toLocaleLowerCase('ko-KR');

/**
 * 입금 전 재확인이 필요한 작업자 계좌인지 판정한다.
 * 공백과 전각/반각 차이는 같은 이름으로 보되, 값이 비어 있으면 별도의
 * 미등록 상태로 처리하므로 명의 불일치에는 포함하지 않는다.
 */
export const hasAccountHolderNameMismatch = (
    workerName: unknown,
    accountHolder: unknown
): boolean => {
    const normalizedWorkerName = normalizeAccountHolderName(workerName);
    const normalizedAccountHolder = normalizeAccountHolderName(accountHolder);

    return Boolean(
        normalizedWorkerName
        && normalizedAccountHolder
        && normalizedWorkerName !== normalizedAccountHolder
    );
};

