import { buildWorkerEmployment, getWorkerEmployment } from './workerEmployment';
import type { TransferCandidate } from './types';

it('퇴사·비활성 상태와 이전 ID를 반영하고 누락·중복 상태를 추측하지 않는다', () => {
    expect(buildWorkerEmployment([
        { id: 'a', legacyId: 'old-a', status: '재직' }, { id: 'b', status: '퇴사' },
        { id: 'c', status: '재직', isActive: false }, { id: 'd', status: 'resigned' },
        { id: 'e' }, { id: 'f', status: '재직', legacyId: 'shared' }, { id: 'g', status: '퇴사', legacyId: 'shared' },
    ])).toEqual({ a: 'active', 'old-a': 'active', b: 'retired', c: 'retired', d: 'retired', e: 'unknown', f: 'active', g: 'retired', shared: 'unknown' });
});

it('저장된 급여도 월과 작업자 ID로 연결하고 동명이인·대표계좌로 상태를 추측하지 않는다', () => {
    const row = { category: 'worker', source: 'payroll', sourceId: '2026-10__old-a__team__일급제', period: '2026-10' } as TransferCandidate;
    const directory = buildWorkerEmployment([{ id: 'a', legacyId: 'old-a', status: '퇴사' }]);
    expect(getWorkerEmployment(row, directory)).toBe('retired');
    expect(getWorkerEmployment({ ...row, period: '2026-09' }, directory)).toBe('unknown');
    expect(getWorkerEmployment({ ...row, sourceId: 'unrelated' }, directory)).toBe('unknown');
    expect(getWorkerEmployment({ ...row, category: 'team' }, directory)).toBeUndefined();
});
