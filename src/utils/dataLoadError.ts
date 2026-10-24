export const getDataLoadErrorMessage = (error: unknown): string => {
    const code = String((error as { code?: unknown } | null)?.code || '');
    const message = error instanceof Error ? error.message : '';
    if (code === 'functions/failed-precondition' && [
        '연결된 작업자에게 소속 팀이 지정되지 않았습니다.',
        '연결된 소속 팀을 찾을 수 없습니다.',
    ].includes(message)) {
        return '계정에 연결된 작업자의 소속 팀을 확인할 수 없습니다. 관리자에게 기존 작업자와 계정 연결, 소속 팀 지정을 확인해 달라고 요청해 주세요.';
    }
    if (code === 'functions/permission-denied' && message === '팀장 계정의 작업자 연결을 확인해 주세요.') {
        return '팀장 계정의 작업자 연결을 확인할 수 없습니다. 관리자에게 기존 작업자와 계정 연결 상태를 확인해 달라고 요청해 주세요.';
    }
    if (code === 'functions/unauthenticated' || code === 'unauthenticated') {
        return '로그인 정보가 만료되었습니다. 다시 로그인한 후 데이터를 불러와 주세요.';
    }
    if (code === 'functions/permission-denied' || code === 'permission-denied') {
        return '데이터 조회 권한을 확인할 수 없습니다. 관리자에게 계정 상태와 연결 정보를 확인해 달라고 요청해 주세요.';
    }
    return '데이터를 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.';
};
