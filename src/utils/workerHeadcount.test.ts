import { countWorkerHeadcount, isEmployedWorker, workerHeadcountBasis } from './workerHeadcount';
import { buildDatabaseStats } from '../pages/database/manpowerDatabaseOverview';

it('529명 중 한글 재직 129명과 기존 영문·근무 상태 60명을 같은 지표로 센다', () => {
    const workers = [
        ...Array.from({ length: 129 }, () => ({ status: '재직' })),
        ...Array.from({ length: 30 }, () => ({ status: 'active' })),
        ...Array.from({ length: 30 }, () => ({ status: '근무', teamType: '외부팀' })),
        ...Array.from({ length: 340 }, () => ({ status: '퇴사' })),
    ];
    expect(countWorkerHeadcount(workers)).toEqual({ total: 529, active: 189 });
    const database = buildDatabaseStats(workers as any, [], [], [], [], { total: 0, today: 0, thisMonth: 0 });
    expect(database.workers).toMatchObject(countWorkerHeadcount(workers));
});

it.each(['재직', ' 근무 ', ' ACTIVE '])('재직 상태와 별칭을 정규화한다: %s', status => {
    expect(isEmployedWorker({ status })).toBe(true);
    expect(isEmployedWorker({ status, isActive: false })).toBe(false);
});

it.each(['', undefined, null, '미배정', '휴직', '퇴사', '출입금지', 'unknown'])('상태가 확인되지 않거나 재직이 아니면 제외한다: %s', status => {
    expect(isEmployedWorker({ status })).toBe(false);
});

it('조회일과 전체·소속 팀 집계 범위를 구분한다', () => {
    expect(workerHeadcountBasis('2026-11-21')).toContain('2026-11-21 조회 기준(KST)');
    expect(workerHeadcountBasis('2026-11-21')).toContain('외부팀 포함');
    expect(workerHeadcountBasis('2026-11-21', '검증팀')).toContain('검증팀 소속만');
    expect(workerHeadcountBasis('2026-11-21', '검증팀')).not.toContain('전체');
});
