type ErrorLike = {
    code?: unknown;
    message?: unknown;
    details?: unknown;
};

const asErrorLike = (error: unknown): ErrorLike => (
    typeof error === 'object' && error !== null ? error as ErrorLike : {}
);

export const getErrorCode = (error: unknown): string => {
    const direct = asErrorLike(error).code;
    if (typeof direct === 'string') return direct;

    const details = asErrorLike(error).details;
    if (typeof details === 'object' && details !== null) {
        const nested = (details as ErrorLike).code;
        if (typeof nested === 'string') return nested;
    }

    return '';
};

export const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message) return error.message;
    const message = asErrorLike(error).message;
    if (typeof message === 'string') return message;
    if (typeof error === 'string') return error;
    return '';
};

export const isDeadlineExceededError = (error: unknown): boolean => {
    const code = getErrorCode(error).toLowerCase();
    const message = getErrorMessage(error).toLowerCase();
    return code.includes('deadline-exceeded') || message.includes('deadline-exceeded');
};

export const getFriendlyErrorMessage = (error: unknown, fallback = '처리에 실패했습니다.'): string => {
    if (isDeadlineExceededError(error)) {
        return '서버 응답 확인 시간이 초과되었습니다. 작업은 이미 처리 중이거나 완료됐을 수 있으니 잠시 후 목록을 새로고침해 확인해주세요.';
    }

    const message = getErrorMessage(error);
    return message || fallback;
};

export const getDeadlineExceededNotice = (actionLabel = '처리'): string =>
    `${actionLabel} 요청은 전달됐지만 완료 응답 확인이 지연되고 있습니다. 잠시 후 목록을 다시 불러와 완료 여부를 확인해주세요.`;
