import { getWorkerStatusGroup, workerStatusMatches } from './workerStatus';

test.each(['퇴사', '퇴사자', ' retired ', 'RESIGNED', 'inactive'])('%s를 퇴사자로 분류한다', status => {
    expect(getWorkerStatusGroup({ status })).toBe('retired');
    expect(workerStatusMatches({ status }, 'active')).toBe(false);
});
test('상태가 없는 비활성과 출입금지 구분 및 전체 조회', () => {
    expect(getWorkerStatusGroup({ isActive: false })).toBe('retired');
    expect(getWorkerStatusGroup({ status: '재직', isActive: false })).toBe('retired');
    expect(getWorkerStatusGroup({ status: '출입금지', isActive: false })).toBe('inactive');
    expect(getWorkerStatusGroup({ status: '재직', isActive: true })).toBe('active');
    expect(getWorkerStatusGroup({})).toBe('active');
    expect(workerStatusMatches({ status: '퇴사' }, 'all')).toBe(true);
});
