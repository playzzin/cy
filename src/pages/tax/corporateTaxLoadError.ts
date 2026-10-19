/** 원본 값이나 개인정보를 오류 메시지에 노출하지 않는다. */
export class CorporateTaxSourceAmountError extends Error {
    readonly code = 'invalid-source-amount';
    constructor() {
        super('원본 금액을 숫자로 처리할 수 없습니다.');
        this.name = 'CorporateTaxSourceAmountError';
    }
}

export function describeCorporateTaxLoadError(error: unknown): string {
    const rawCode = error && typeof error === 'object' && 'code' in error
        ? String((error as { code: unknown }).code) : '';
    const code = rawCode.split('/').pop();
    switch (code) {
        case 'invalid-source-amount':
            return '원본 자료에 처리할 수 없는 금액이 있습니다. 원본 화면의 금액을 확인해 주세요. (invalid-source-amount)';
        case 'permission-denied':
            return '자료 조회 권한이 없습니다. 로그인 계정과 자료 접근 권한을 확인해 주세요. (permission-denied)';
        case 'unauthenticated':
            return '로그인 상태를 확인한 뒤 다시 불러와 주세요. (unauthenticated)';
        case 'unavailable':
        case 'deadline-exceeded':
            return '서버 연결이 원활하지 않습니다. 네트워크 연결을 확인하고 다시 불러와 주세요.';
        case 'resource-exhausted':
            return '서버 요청 한도를 초과했습니다. 잠시 후 다시 불러와 주세요. (resource-exhausted)';
        case 'failed-precondition':
            return '조회에 필요한 데이터베이스 설정을 확인해야 합니다. (failed-precondition)';
        default:
            return '자료 처리 중 오류가 발생했습니다. 다시 불러온 뒤에도 계속되면 원본 자료를 확인해 주세요.';
    }
}
