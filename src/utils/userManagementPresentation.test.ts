import type { Position } from '../services/positionService';
import type { UserData } from '../services/userService';
import type { Worker } from '../services/manpowerService';
import type { OfficeStaff } from '../services/officeStaffService';
import type { Company } from '../services/companyService';
import type { AccountLink } from '../types/accountLink';
import { UserRole } from '../types/roles';
import { selectPositionAccess, summarizeAccountConnections } from './userManagementPresentation';

const user = { uid: 'sample-user', linkedWorkerIds: ['legacy-worker'], linkedOfficeStaffIds: ['office-1'] } as UserData;
const workers = [{ id: 'worker-1', legacyId: 'legacy-worker', uid: user.uid, name: '예시 작업자', role: '팀장', teamName: '예시팀' }] as Worker[];
const staff = [{ id: 'office-1', name: '예시 직원', role: '사무직', department: '관리부' }] as OfficeStaff[];
const company = [{ id: 'company-1', legacyId: 'legacy-company', name: '예시 회사', type: '협력사' }] as Company[];

it('직책 이름이 아닌 설정된 권한을 적용하고 중복 추가 직책을 제거한다', () => {
    const extras = ['사장', '지원담당', '지원담당'];
    expect(selectPositionAccess({ name: '사장', systemRole: UserRole.GENERAL } as Position, extras))
        .toEqual({ position: '사장', role: 'user', additionalPositions: ['지원담당'] });
    expect(extras).toEqual(['사장', '지원담당', '지원담당']);
    expect(selectPositionAccess({ name: '총괄', systemRole: UserRole.MANAGER } as Position, []).role).toBe('manager');
});

it('직책을 해제할 때 추가 메뉴 권한도 제거한다', () => {
    expect(selectPositionAccess(undefined, ['지원담당'])).toEqual({ position: '', role: 'user', additionalPositions: [] });
});

it('사용자 참조, 인원 uid, 연결 문서의 동일 대상을 한 번만 표시한다', () => {
    const links = [{ uid: user.uid, entityType: 'worker', entityId: 'worker-1', status: 'active' }] as AccountLink[];
    const summary = summarizeAccountConnections(user, workers, staff, [], links);
    expect(summary).toHaveLength(2);
    expect(summary[0]).toMatchObject({ key: 'worker:worker-1', name: '예시 작업자', detail: '예시팀 · 팀장', status: 'active', missing: false });
    expect(summary[1]).toMatchObject({ label: '사무실', name: '예시 직원' });
});

it('회사도 이전 ID와 현재 ID를 통합하고 승인 대기를 연결 완료와 구분한다', () => {
    const links = [{ uid: user.uid, entityType: 'company', entityId: 'legacy-company', entityName: '요청 회사', status: 'pending' }] as AccountLink[];
    expect(summarizeAccountConnections({ uid: user.uid } as UserData, [], [], company, links))
        .toEqual([expect.objectContaining({ key: 'company:company-1', name: '예시 회사', status: 'pending' })]);
    const activeUser = { uid: user.uid, linkedCompanyIds: ['company-1'] } as UserData;
    expect(summarizeAccountConnections(activeUser, [], [], company, links))
        .toEqual([expect.objectContaining({ status: 'active' })]);
});

it('연결 문서만 있는 인원도 표시하고 다른 계정과 종료된 연결은 제외한다', () => {
    const links = [
        { uid: 'another-user', entityType: 'worker', entityId: 'other', status: 'active' },
        { uid: user.uid, entityType: 'company', entityId: 'old-company', status: 'inactive' },
        { uid: user.uid, entityType: 'office', entityId: 'office-1', status: 'active' },
    ] as AccountLink[];
    expect(summarizeAccountConnections({ uid: user.uid } as UserData, [], staff, [], links))
        .toEqual([expect.objectContaining({ key: 'office:office-1', status: 'active' })]);
});

it('삭제되거나 조회되지 않는 연결 대상을 미연결로 숨기지 않는다', () => {
    expect(summarizeAccountConnections(user, [], [], [], []))
        .toEqual([expect.objectContaining({ missing: true }), expect.objectContaining({ missing: true })]);
});
