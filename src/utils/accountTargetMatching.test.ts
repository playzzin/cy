import { accountTargetType, rankAccountTargets, searchAccountTargets } from './accountTargetMatching';
import type { UserData } from '../services/userService';
import type { Worker } from '../services/manpowerService';
import type { AccountLink } from '../types/accountLink';
import type { Company } from '../services/companyService';

const user = { uid: 'requester', displayName: '가상 인원', email: 'sample@example.test', phoneNumber: '010-0000-1234' } as UserData;
const workers = [
    { id: 'same-name', name: '가상 인원' },
    { id: 'same-email', name: '다른 이름', email: 'SAMPLE@example.test', contact: '01000001234' },
    { id: 'taken', legacyId: 'old-id', name: '가상 인원', email: user.email },
] as Worker[];
const rank = (extra = {}) => rankAccountTargets({ user, type: 'worker', workers, staff: [], companies: [], users: [user], links: [], ...extra });

it('동명이인보다 이메일·전화 일치 후보를 먼저 추천하고 개인정보 원문을 근거 라벨에 넣지 않는다', () => {
    const rows = rank();
    expect(rows[0].id).toBe('same-email');
    expect(rows[0].reasons).toEqual(['이메일 일치', '연락처 일치']);
    expect(searchAccountTargets(rows, '가상 인원')).toHaveLength(2);
});
it('기존 ID로 다른 계정에 연결된 인원은 후보 선택을 막는다', () => {
    const rows = rank({ users: [user, { uid: 'other', linkedWorkerIds: ['old-id'] } as UserData] });
    expect(rows.find(row => row.id === 'taken')?.blocked).toBe(true);
    expect(rows[rows.length - 1].id).toBe('taken');
});
it('빈 값끼리 일치했다고 추천하지 않는다', () => {
    expect(rank({ user: { uid: 'empty' } as UserData }).every(row => row.score === 0)).toBe(true);
});
it('회사 요청의 유형을 지키고 사업자번호 형식을 정규화한다', () => {
    const request = { uid: user.uid, accountType: 'partner_company', entityType: 'company', entityId: 'new_company', requestedEntity: { businessNumber: '000-00-12345' } } as AccountLink;
    const companies = [{ id: 'partner', name: '가상 협력사', type: '협력사', businessNumber: '0000012345' }, { id: 'rental', name: '가상 임대사', type: '임대사', businessNumber: '0000012345' }] as Company[];
    const rows = rankAccountTargets({ user, request, type: 'company', workers: [], staff: [], companies, users: [user], links: [] });
    expect(rows.map(row => row.id)).toEqual(['partner']);
    expect(rows[0].reasons).toEqual(['사업자번호 일치']);
});
it('요청한 계정 유형에 맞는 연결 탭을 연다', () => {
    expect(accountTargetType({ ...user, requestedAccountType: 'office' })).toBe('office');
    expect(accountTargetType({ ...user, requestedAccountType: 'rental_company' })).toBe('company');
});
