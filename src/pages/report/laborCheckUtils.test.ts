import {
    canOverrideInactiveLaborCheckCell,
    getFirstOutputDateByWorker,
    getManualReportedSiteName,
    getVisibleLaborCheckWorkers,
    isBeforeFirstOutputDate,
} from './laborCheckUtils';

describe('laborCheckUtils', () => {
    it('선택 월에 출역 기록이 있는 작업자만 표시한다', () => {
        const workers = [
            { workerKey: 'worked', retired: false, name: '근무자' },
            { workerKey: 'idle', retired: false, name: '미근무자' },
            { workerKey: 'retired', retired: true, name: '퇴사자' },
        ];
        const outputKeys = new Set(['worked', 'retired']);

        expect(getVisibleLaborCheckWorkers(workers, outputKeys, false, true).map((worker) => worker.workerKey))
            .toEqual(['worked']);
        expect(getVisibleLaborCheckWorkers(workers, outputKeys, true, true).map((worker) => worker.workerKey))
            .toEqual(['worked', 'retired']);
        expect(getVisibleLaborCheckWorkers(workers, outputKeys, false, false).map((worker) => worker.workerKey))
            .toEqual(['worked', 'idle']);
    });

    it('작업자별 첫 출역일 이전 날짜를 신고 대상에서 제외한다', () => {
        const firstDates = getFirstOutputDateByWorker([
            { workerKey: 'worker-1', date: '2026-08-25' },
            { workerKey: 'worker-1', date: '2026-08-21' },
            { workerKey: 'worker-2', date: '2026-08-03' },
        ]);

        expect(firstDates.get('worker-1')).toBe('2026-08-21');
        expect(isBeforeFirstOutputDate('2026-08-20', firstDates.get('worker-1'))).toBe(true);
        expect(isBeforeFirstOutputDate('2026-08-21', firstDates.get('worker-1'))).toBe(false);
    });

    it('직접 입력한 현장명을 정리하고 저장 길이와 동일하게 제한한다', () => {
        expect(getManualReportedSiteName('  직접 입력 현장  ')).toBe('직접 입력 현장');
        expect(getManualReportedSiteName('가'.repeat(121))).toHaveLength(120);
    });

    it('활성화 후 선택한 재직 작업자만 비활성 칸을 수정할 수 있다', () => {
        const selectedWorkerKeys = new Set(['selected']);

        expect(canOverrideInactiveLaborCheckCell(true, selectedWorkerKeys, { workerKey: 'selected', retired: false }))
            .toBe(true);
        expect(canOverrideInactiveLaborCheckCell(false, selectedWorkerKeys, { workerKey: 'selected', retired: false }))
            .toBe(false);
        expect(canOverrideInactiveLaborCheckCell(true, selectedWorkerKeys, { workerKey: 'other', retired: false }))
            .toBe(false);
        expect(canOverrideInactiveLaborCheckCell(true, selectedWorkerKeys, { workerKey: 'selected', retired: true }))
            .toBe(false);
    });
});
