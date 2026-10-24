import { getDocs } from 'firebase/firestore';
import { profileConnectionService } from './profileConnectionService';
import { accountLinkService } from './accountLinkService';
import { manpowerService } from './manpowerService';
import { officeStaffService } from './officeStaffService';
import type { UserData } from './userService';

jest.mock('firebase/firestore', () => ({
    getDocs: jest.fn(),
    query: (collection: string, ...filters: unknown[]) => ({ collection, filters }),
    where: (field: string, op: string, value: string) => ({ field, op, value }),
}));
jest.mock('./accountLinkService', () => ({ accountLinkService: { getLinksByUid: jest.fn() } }));
jest.mock('./manpowerService', () => ({ manpowerService: { getWorker: jest.fn(), getWorkers: jest.fn() } }));
jest.mock('./workerFirestoreService', () => ({ workerFirestoreService: { getCollection: () => 'workers' } }));
jest.mock('./officeStaffService', () => ({ officeStaffService: { getCollection: () => 'office_staff', getOfficeStaffMember: jest.fn(), getOfficeStaff: jest.fn() } }));
jest.mock('../utils/devAdminSession', () => ({ isDevAdminSessionEnabled: () => false }));
jest.mock('../utils/devAdminFixtures', () => ({ devWorkers: [], devOfficeStaff: [] }));
const snapshot = (rows: unknown[]) => ({ docs: rows.map(row => ({ data: () => row })) });
const user = { uid: 'self', accountType: 'worker', linkedWorkerIds: ['w1'] } as UserData;
const link = { uid: 'self', entityType: 'worker', entityId: 'w2', status: 'active' };

beforeEach(() => {
    jest.clearAllMocks();
    (getDocs as jest.Mock).mockResolvedValue(snapshot([]));
    (accountLinkService.getLinksByUid as jest.Mock).mockResolvedValue([]);
    (manpowerService.getWorker as jest.Mock).mockImplementation(async id => ({ id, name: id, uid: 'self' }));
    (officeStaffService.getOfficeStaffMember as jest.Mock).mockResolvedValue(null);
});

it('본인 UID와 연결된 ID만 조회하고 전체 직원 목록은 요청하지 않는다', async () => {
    (accountLinkService.getLinksByUid as jest.Mock).mockResolvedValue([link, { ...link, entityId: 'pending', status: 'pending' }, { ...link, uid: 'another-user', entityId: 'other' }]);
    const result = await profileConnectionService.load(user);
    expect(getDocs).toHaveBeenCalledWith({ collection: 'workers', filters: [{ field: 'uid', op: '==', value: 'self' }] });
    expect((manpowerService.getWorker as jest.Mock).mock.calls.map(call => call[0]).sort()).toEqual(['w1', 'w2']);
    expect(manpowerService.getWorkers).not.toHaveBeenCalled();
    expect(officeStaffService.getOfficeStaff).not.toHaveBeenCalled();
    expect(officeStaffService.getOfficeStaffMember).not.toHaveBeenCalled();
    expect(result.workers).toHaveLength(2);
    expect(result.links).toHaveLength(2);
});

it('UID로 찾은 직원과 기존 ID 연결을 중복 표시하지 않는다', async () => {
    (getDocs as jest.Mock).mockResolvedValue(snapshot([{ id: 'w1', legacyId: 'legacy-w1', name: '예시' }]));
    const result = await profileConnectionService.load({ ...user, linkedWorkerIds: ['w1', 'legacy-w1'] });
    expect(result.workers).toHaveLength(1);
    expect(manpowerService.getWorker).not.toHaveBeenCalled();
});

it('특정 연결 읽기가 실패해도 다른 연결을 유지하고 재시도할 항목을 반환한다', async () => {
    (accountLinkService.getLinksByUid as jest.Mock).mockRejectedValue(new Error('unavailable'));
    (manpowerService.getWorker as jest.Mock).mockImplementation(async id => {
        if (id === 'denied') throw new Error('permission-denied');
        return { id, name: '조회 가능' };
    });
    const result = await profileConnectionService.load({ ...user, linkedWorkerIds: ['w1', 'denied'] });
    expect(result.workers.map(row => row.id)).toEqual(['w1']);
    expect(result.unavailable).toEqual(['계정 연결 상태', '작업자 상세 정보']);
});

it('이전 ID는 해당 ID 조건으로만 복구하며 없는 대상은 부분 실패로 표시한다', async () => {
    (manpowerService.getWorker as jest.Mock).mockResolvedValue(null);
    (getDocs as jest.Mock).mockImplementation(async request => snapshot(request.filters[0].value === 'legacy' ? [{ id: 'new-id', name: '예시' }] : []));
    const result = await profileConnectionService.load({ ...user, linkedWorkerIds: ['legacy', 'missing'] });
    expect(result.workers.map(row => row.id)).toEqual(['new-id']);
    expect(result.unavailable).toContain('작업자 상세 정보');
    expect((getDocs as jest.Mock).mock.calls.every(([request]) => request.filters.length > 0)).toBe(true);
});
