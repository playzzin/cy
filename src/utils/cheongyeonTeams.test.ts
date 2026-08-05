import { classifyWorkerAffiliation, isCheongyeonEngCompanyName } from './cheongyeonTeams';

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
