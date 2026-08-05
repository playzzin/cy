import { filterRowsByWorkerName, normalizeWorkerNameSearch } from './workerNameSearch';

describe('workerNameSearch', () => {
    const rows = [
        { workerId: '1', workerName: '홍 길동' },
        { workerId: '2', workerName: '김영희' },
        { workerId: '3', workerName: '홍길순' },
    ];

    it('선택된 작업자 ID가 없어도 입력한 이름으로 행을 찾는다', () => {
        expect(filterRowsByWorkerName(rows, '홍길동')).toEqual([
            { workerId: '1', workerName: '홍 길동' },
        ]);
    });

    it('부분 이름 검색과 공백 정규화를 지원한다', () => {
        expect(filterRowsByWorkerName(rows, ' 홍 길 ')).toEqual([
            { workerId: '1', workerName: '홍 길동' },
            { workerId: '3', workerName: '홍길순' },
        ]);
    });

    it('유니코드 한글 조합형을 동일하게 비교한다', () => {
        expect(normalizeWorkerNameSearch('홍길동')).toBe('홍길동');
    });
});
