export const getStorageErrorMessage = (error: unknown): string => {
    const code = typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : '';
    switch (code) {
        case 'storage/unauthorized':
            return '이 위치에 접근할 권한이 없습니다. 최상위 목록은 관리자 계정으로만 조회할 수 있습니다. 관리자도 접근할 수 없다면 다시 로그인하거나 저장소 권한 설정을 확인해 주세요.';
        case 'storage/unauthenticated':
            return '로그인이 만료되었습니다. 다시 로그인한 뒤 시도해 주세요.';
        case 'storage/retry-limit-exceeded':
            return '저장소 연결 시간이 초과되었습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.';
        case 'storage/object-not-found':
            return '파일이 없거나 다른 위치로 이동되었습니다. 목록을 새로고침해 주세요.';
        case 'storage/quota-exceeded':
            return '저장소 사용 한도를 초과했습니다. 관리자에게 문의해 주세요.';
        case 'storage/no-default-bucket':
        case 'storage/bucket-not-found':
        case 'storage/project-not-found':
            return '저장소 설정을 확인할 수 없습니다. 관리자에게 문의해 주세요.';
        case 'storage/canceled':
            return '작업이 취소되었습니다.';
        default:
            return '저장소에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.';
    }
};
