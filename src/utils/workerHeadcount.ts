import { getKoreanDateKey } from './koreanBusinessDate';

type HeadcountWorker = { status?: unknown; isActive?: boolean };

/** 등록 현황 지표용. 신규 일보 입력 후보(상태 미입력 포함)와 구분합니다. */
export const isEmployedWorker = (worker: HeadcountWorker): boolean => {
    const status = String(worker.status ?? '').trim().toLowerCase();
    return worker.isActive !== false && ['재직', 'active', '근무'].includes(status);
};

export const countWorkerHeadcount = (workers: readonly HeadcountWorker[]) => ({
    total: workers.length,
    active: workers.filter(isEmployedWorker).length,
});

export const workerHeadcountBasis = (asOf: string = getKoreanDateKey(), teamName?: string): string =>
    `${asOf} 조회 기준(KST) · ${teamName ? `${teamName} 소속만` : '조회 권한 내 전체 · 외부팀 포함'} · 재직·근무 상태(영문 active 포함), 비활성·상태 미입력 제외`;
