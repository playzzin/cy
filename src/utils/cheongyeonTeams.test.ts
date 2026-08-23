import { buildTeamIdsByAffiliation, classifyWorkerAffiliation, isCheongyeonEngCompanyName } from './cheongyeonTeams';

describe('classifyWorkerAffiliation', () => {
    it('청연 회사명과 회사 ID를 청연 소속으로 분류한다', () => {
        expect(classifyWorkerAffiliation({ companyName: '(주) 청연이엔지' })).toBe('cheongyeon');
        expect(classifyWorkerAffiliation(
            { companyId: 'company-cy' },
            new Set(['company-cy'])
        )).toBe('cheongyeon');
    });

    it('협력사와 외부 지원팀을 외부팀으로 분류한다', () => {
        expect(classifyWorkerAffiliation({ companyName: '한빛 협력사' })).toBe('external');
        expect(classifyWorkerAffiliation({ companyName: '외부팀', teamType: '지원팀' })).toBe('external');
        expect(classifyWorkerAffiliation({ teamType: '지원팀' })).toBe('external');
    });

    it('회사와 외부팀 정보가 없으면 소속 미지정으로 분류한다', () => {
        expect(classifyWorkerAffiliation({})).toBe('unassigned');
        expect(classifyWorkerAffiliation({ companyName: '미배정' })).toBe('unassigned');
    });
});

describe('isCheongyeonEngCompanyName', () => {
    it('법인 표기와 영문 회사명을 정규화한다', () => {
        expect(isCheongyeonEngCompanyName('주식회사 청연이엔지')).toBe(true);
        expect(isCheongyeonEngCompanyName('CYENG')).toBe(true);
        expect(isCheongyeonEngCompanyName('다른회사')).toBe(false);
    });
});

describe('buildTeamIdsByAffiliation', () => {
    const companies = [
        { id: 'company-cy', legacyId: 'legacy-company-cy', name: '(주) 청연이엔지', code: 'CYENG', type: '시공사' },
        { id: 'company-external-construction', name: '외부 시공사', type: '시공사' },
        { id: 'company-partner', name: '한빛 협력사', type: '협력사' }
    ] as any;
    const teams = [
        { id: 'team-cy', legacyId: 'legacy-team-cy', name: '청연팀', companyId: 'legacy-company-cy', type: '시공팀' },
        { id: 'team-external-construction', name: '외부 시공팀', companyId: 'company-external-construction', type: '시공팀' },
        { id: 'team-partner', legacyId: 'legacy-team-partner', name: '협력사팀', companyId: 'company-partner', type: '지원팀' },
        { id: 'team-support', name: '회사 미등록 지원팀', type: '지원팀' },
        { id: 'team-unassigned', name: '미배정팀', type: '시공팀' }
    ] as any;

    it('청연 회사 ID의 현재값과 레거시값을 청연팀으로 분류한다', () => {
        expect([...buildTeamIdsByAffiliation(teams, companies, 'cheongyeon')].sort()).toEqual([
            'legacy-team-cy',
            'team-cy'
        ]);
    });

    it('회사 유형과 무관하게 청연 외 회사 및 지원팀을 외부팀으로 분류한다', () => {
        expect([...buildTeamIdsByAffiliation(teams, companies, 'external')].sort()).toEqual([
            'legacy-team-partner',
            'team-external-construction',
            'team-partner',
            'team-support'
        ]);
    });
});
