/** Firebase transport errors should never appear as bare English status codes. */
export function teamAccommodationErrorMessage(error: unknown, operation: 'load' | 'save'): string {
    const code = String((error as { code?: string })?.code || '');
    const message = error instanceof Error ? error.message.trim() : '';
    if (code === 'functions/unauthenticated') return '로그인이 만료되었습니다. 다시 로그인해 주세요.';
    if (['functions/internal', 'functions/unavailable', 'functions/not-found', 'functions/deadline-exceeded'].includes(code)
        || /^(internal|unavailable|not found|deadline exceeded)$/i.test(message)) {
        return operation === 'load'
            ? '숙소 배정 서비스에 연결하지 못했습니다. 잠시 후 다시 불러와 주세요.'
            : '숙소 배정 저장 결과를 확인하지 못했습니다. 다시 불러와 현재 배정을 확인해 주세요.';
    }
    return message || (operation === 'load' ? '배정 정보를 불러오지 못했습니다.' : '배정 정보를 저장하지 못했습니다.');
}
