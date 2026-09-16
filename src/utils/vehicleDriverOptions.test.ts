import type { Worker } from '../services/manpowerService';
import type { Team } from '../services/teamService';
import type { Company } from '../services/companyService';
import { getEligibleVehicleDrivers } from './vehicleDriverOptions';

const companies: Company[] = [{ id: 'cy', legacyId: 'old-cy', name: '주식회사 청연이엔지', code: 'CYENG', type: '시공사' }];
const teams: Team[] = [{ id: 'cy-team', legacyId: 'old-team', name: '가상 청연팀', companyId: 'cy', type: '시공팀' }];
const ids = (workers: Worker[]) => getEligibleVehicleDrivers(workers, teams, companies).map(worker => worker.id);

test('청연 회사명·현재 회사 ID·이전 회사 ID를 모두 인식하고 이름순으로 표시한다', () => {
    expect(ids([
        { id: 'name', name: '다', companyName: '(주) 청연이엔지', status: '재직' },
        { id: 'current', name: '가', companyId: 'cy', status: '재직' },
        { id: 'legacy', name: '나', companyId: 'old-cy', status: '재직' },
        { id: 'external', name: '외부', companyName: '외부 협력사', status: '재직' },
        { id: 'unknown', name: '미지정', status: '재직' },
    ])).toEqual(['current', 'legacy', 'name']);
});

test.each(['퇴사', ' 퇴사 ', 'inactive', 'INACTIVE', 'retired', '출입금지'])('%s 상태는 청연 소속이어도 선택할 수 없다', status => {
    expect(ids([{ id: 'former', name: '가상 퇴사자', companyId: 'cy', status }])).toEqual([]);
});

test('비활성 청연 인원을 제외하고 상태가 없는 기존 활성 인원은 유지한다', () => {
    expect(ids([
        { id: 'disabled', name: '비활성', companyId: 'cy', status: '재직', isActive: false },
        { id: 'legacy-active', name: '기존 인원', companyId: 'cy' },
    ])).toEqual(['legacy-active']);
});

test('회사 정보가 없는 기존 인원은 청연 팀 ID로 확인하되 명시된 외부 소속은 포함하지 않는다', () => {
    expect(ids([
        { id: 'team', name: '가', teamId: 'cy-team', status: '재직' },
        { id: 'legacy-team', name: '나', teamId: 'old-team', status: '재직' },
        { id: 'external', name: '다', teamId: 'cy-team', companyName: '외부 협력사', status: '재직' },
        { id: 'support', name: '라', teamId: 'cy-team', teamType: '지원팀', status: '재직' },
    ])).toEqual(['team', 'legacy-team']);
});

test('선택 목록을 걸러도 기존 작업자와 배정 이력 조회용 목록은 변경하지 않는다', () => {
    const workers: Worker[] = [
        { id: 'former', name: '가상 퇴사자', companyId: 'cy', status: '퇴사' },
        { id: 'active', name: '가상 재직자', companyId: 'cy', status: '재직' },
    ];
    const before = JSON.stringify(workers);
    expect(ids(workers)).toEqual(['active']);
    expect(JSON.stringify(workers)).toBe(before);
});
