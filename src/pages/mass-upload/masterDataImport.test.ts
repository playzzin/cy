import { emptyMasterSnapshot, executeMasterImport, MASTER_DEFINITIONS, MASTER_TYPES, MasterSnapshot, parseMasterRow, planMasterImport } from './masterDataImport';

const dataWith = (data: Partial<MasterSnapshot>): MasterSnapshot => ({ ...emptyMasterSnapshot(), ...data });
const writer = () => {
    let count = 0;
    return { create: jest.fn(async () => `saved-${++count}`), update: jest.fn(async () => undefined) };
};
const fullImport = (): MasterSnapshot => dataWith({
    Company: [{ 회사명: '예시회사', 구분: '발주사', 회사코드: 'C-01', 이메일: 'office@example.com', 팩스: '02-000-0000', 은행명: '테스트은행', 계좌번호: '001234567890123456', 예금주: '예시회사', 우리회사: '아니오' }],
    Team: [{ 팀명: '예시팀', 회사명: '예시회사', 팀장명: '예시반장', 직종: '철근', 팀구분: '시공팀', 상태: '대기', 기본급여방식: '월급제', 지원단가: '0', 용역단가: '120,000', 지원정산방식: '공수', 용역정산방식: '고정', 은행명: '팀은행', 계좌번호: '00001234', 예금주: '예시팀', 담당현장: '예시현장' }],
    Site: [{ 현장명: '예시현장', 현장코드: 'S-01', 발주사: '예시회사', 시공사: '예시회사', 해당팀: '예시팀', 현장책임자: '예시반장', 현장구분: '지원', 결제구분: '노무', 상태: '예정', 착공일: '2026-09-01', 준공일: '2026-12-31', 동목록: 'A동;B동' }],
    Worker: [{ 이름: '예시반장', 소속팀: '예시팀', 배정현장: '예시현장', 직종: '반장', 이메일: 'worker@example.com', 상태: '휴직', 팀구분: '정규직', 급여방식: '월급제', 단가: '3,000,000원', 혈액형: 'AB형', 고용형태: '정규직', 직급: '반장', 노무명세서지급구분: '위임', 은행명: '개인은행', 계좌번호: '000000123456789012', 예금주: '예시반장', 색상: '#0f766e' }],
    OfficeStaff: [{ 이름: '예시직원', 부서: '관리부', 직책: '사원', 고용형태: '정규직', 급여방식: '고정급', 급여: '0', 입사일: '2026.09.01', 메모: '예시', 은행명: '직원은행', 계좌번호: '00123', 예금주: '예시직원' }],
    SettlementTarget: [{ 이름: '예시대상자', 대상유형: '영업사원', 직책: '담당자', 회사명: '예시회사', 세후지급률: '75%', 바이백사용: '아니오', 증빙필요: '예', 상태: '사용', 메모: '정산 메모', 은행명: '정산은행', 계좌번호: '000456', 예금주: '예시대상자' }],
});

test('all six DB entity types preserve fields and resolve forward/circular links using real IDs', async () => {
    const data = fullImport();
    const plan = planMasterImport(data, emptyMasterSnapshot());
    expect(MASTER_TYPES.flatMap(type => plan[type].filter(r => r.status === 'CONFLICT').map(r => r.changes))).toEqual([]);
    const adapter = writer();
    const saved = await executeMasterImport(plan, emptyMasterSnapshot(), adapter);
    expect(saved.Company[0]).toMatchObject({ type: '건설사', code: 'C-01', email: 'office@example.com', fax: '02-000-0000', bankName: '테스트은행', accountNumber: '001234567890123456', accountHolder: '예시회사', isMyCompany: false });
    expect(saved.Company[0]).toMatchObject({ siteIds: [saved.Site[0].id], siteNames: ['예시현장'] });
    expect(saved.Team[0]).toMatchObject({ companyId: saved.Company[0].id, companyName: '예시회사', leaderId: saved.Worker[0].id, siteIds: [saved.Site[0].id], assignedSiteId: saved.Site[0].id, type: '시공팀', status: 'waiting', supportRate: 0, serviceRate: 120000, bankName: '팀은행', accountNumber: '00001234', defaultSalaryModel: '월급제' });
    expect(saved.Site[0]).toMatchObject({ companyId: saved.Company[0].id, constructorCompanyId: saved.Company[0].id, clientCompanyId: saved.Company[0].id, responsibleTeamId: saved.Team[0].id, siteManagerId: saved.Worker[0].id, status: 'planned', siteType: '지원', paymentMethod: '노무', buildings: ['A동', 'B동'] });
    expect(saved.Worker[0]).toMatchObject({ companyId: saved.Company[0].id, companyName: '예시회사', teamId: saved.Team[0].id, siteId: saved.Site[0].id, email: 'worker@example.com', teamType: '정규직', salaryModel: '월급제', payType: '월급제', status: '휴직', bloodType: 'AB', unitPrice: 3000000, employmentType: '정규직', rank: '반장', laborStatementPayType: 'delegate', accountNumber: '000000123456789012', color: '#0f766e' });
    expect(saved.OfficeStaff[0]).toMatchObject({ department: '관리부', role: '사원', salaryModel: '고정급', payType: '고정급', unitPrice: 0, joinDate: '2026-09-01', memo: '예시', accountNumber: '00123' });
    expect(saved.SettlementTarget[0]).toMatchObject({ targetType: 'salesperson', companyId: saved.Company[0].id, defaultAfterTaxRate: 0.75, buybackEnabled: false, evidenceRequired: true, memo: '정산 메모', accountNumber: '000456' });
    expect(JSON.stringify(adapter.create.mock.calls)).not.toContain('__import_');
    expect(JSON.stringify(adapter.update.mock.calls)).not.toContain('__import_');
    const second = planMasterImport(data, saved);
    expect(MASTER_TYPES.flatMap(type => second[type].map(r => r.status))).toEqual(MASTER_TYPES.map(() => 'UNCHANGED'));
    const again = writer();
    await executeMasterImport(second, saved, again);
    expect(again.create).not.toHaveBeenCalled();
    expect(again.update).not.toHaveBeenCalled();
});

test('updates save newly supported fields, preserve blank values, and retain explicit zero and false', async () => {
    const snapshot = dataWith({ Worker: [{ id: 'w1', name: '예시', teamType: '일용직', unitPrice: 100, contact: '010-0000-0000', bankName: '기존은행', email: 'old@example.com', isActive: true, status: '재직' }] });
    const data = dataWith({ Worker: [{ 이름: '예시', 팀구분: '정규직', 단가: 0, 연락처: '', 은행명: '', 이메일: 'new@example.com', 활성여부: false, 상태: '퇴사' }] });
    const plan = planMasterImport(data, snapshot);
    expect(plan.Worker[0].status).toBe('UPDATE');
    const saved = await executeMasterImport(plan, snapshot, writer());
    expect(saved.Worker[0]).toMatchObject({ teamType: '정규직', unitPrice: 0, bankName: '기존은행', contact: '010-0000-0000', email: 'new@example.com', isActive: false, status: '퇴사' });
});

test.each([
    ['이메일', 'invalid'], ['단가', 'not a number'], ['단가', '-1'], ['단가', 'Infinity'], ['단가', '원'], ['혈액형', 'ZZ'], ['상태', '근무중?'], ['활성여부', 'maybe'], ['색상', 'blue'], ['계좌번호', '1234****'], ['계좌번호', '1.23E+17'],
])('rejects invalid worker field %s', (label, value) => {
    expect(parseMasterRow('Worker', { 이름: '예시', [label]: value }).errors.length).toBeGreaterThan(0);
});

test('rejects invalid dates, date ordering and rates', () => {
    expect(parseMasterRow('Site', { 현장명: '예시', 착공일: '2026-02-30' }).errors).not.toHaveLength(0);
    expect(parseMasterRow('Site', { 현장명: '예시', 착공일: '2026-10-01', 준공일: '2026-09-01' }).errors).not.toHaveLength(0);
    expect(parseMasterRow('SettlementTarget', { 이름: '예시', 세후지급률: '101%' }).errors).not.toHaveLength(0);
});

test('aliases normalize whitespace, salary and status without losing zeroes', () => {
    expect(parseMasterRow('Worker', { '작업자 명': '예시', 'account_number': '000123', salaryModel: '일당', status: 'active' }).values).toMatchObject({ name: '예시', accountNumber: '000123', payType: '일급제', status: '재직' });
});

test('unknown populated columns and conflicting aliases block a row', () => {
    expect(parseMasterRow('Worker', { 이름: '예시', '전회번호': '000' }).errors).toContain('인식하지 못한 열: 전회번호');
    expect(parseMasterRow('Worker', { 이름: '예시', 연락처: '000', 휴대폰: '111' }).errors).toContain('연락처: 같은 항목의 여러 열에 서로 다른 값이 있습니다.');
});

test('all duplicate file rows are blocked, including duplicate IDs with different names', () => {
    const snapshot = dataWith({ Company: [{ id: 'c1', name: '기존회사' }] });
    const plan = planMasterImport(dataWith({ Company: [{ 회사명: '회사A', 회사ID: 'c1' }, { 회사명: '회사B', 회사ID: 'c1' }], Worker: [{ 이름: '같은이름' }, { 이름: '같은이름' }] }), snapshot);
    expect([...plan.Company, ...plan.Worker].every(row => row.status === 'CONFLICT')).toBe(true);
});

test('ambiguous people require an ID and explicit IDs never fall back to another person', () => {
    const snapshot = dataWith({ Worker: [{ id: 'w1', name: '동명', teamName: '팀A' }, { id: 'w2', name: '동명', teamName: '팀B' }] });
    expect(planMasterImport(dataWith({ Worker: [{ 이름: '동명', 이메일: 'new@example.com' }] }), snapshot).Worker[0].status).toBe('CONFLICT');
    const exact = planMasterImport(dataWith({ Worker: [{ 이름: '수정이름', 작업자ID: 'w2' }] }), snapshot).Worker[0];
    expect(exact.existingData?.id).toBe('w2');
    expect(exact.status).toBe('UPDATE');
    expect(planMasterImport(dataWith({ Worker: [{ 이름: '동명', 작업자ID: 'missing' }] }), snapshot).Worker[0].status).toBe('CONFLICT');
});

test('missing or inconsistent references block writes before any DB call', async () => {
    const snapshot = dataWith({ Team: [{ id: 't1', name: '실제팀' }] });
    const plan = planMasterImport(dataWith({ Worker: [{ 이름: '예시', 소속팀: '다른팀', 소속팀ID: 't1' }] }), snapshot);
    expect(plan.Worker[0].status).toBe('CONFLICT');
    const adapter = writer();
    await expect(executeMasterImport(plan, snapshot, adapter)).rejects.toThrow('오류 행');
    expect(adapter.create).not.toHaveBeenCalled();
    expect(adapter.update).not.toHaveBeenCalled();
});

test('an invalid new reference is not treated as a usable DB entity', () => {
    const plan = planMasterImport(dataWith({ Company: [{ 회사명: '회사', 구분: '오타' }], Team: [{ 팀명: '팀', 회사명: '회사' }], Worker: [{ 이름: '예시', 소속팀: '팀' }] }), emptyMasterSnapshot());
    expect([plan.Company[0], plan.Team[0], plan.Worker[0]].every(row => row.status === 'CONFLICT')).toBe(true);
});

test('a changed team company is derived into worker company ID and name', async () => {
    const snapshot = dataWith({ Company: [{ id: 'c1', name: '회사1' }, { id: 'c2', name: '회사2' }], Team: [{ id: 't1', name: '팀', companyId: 'c1', companyName: '회사1' }], Worker: [{ id: 'w1', name: '예시', teamId: 't1', teamName: '팀', companyId: 'c1', companyName: '회사1' }] });
    const data = dataWith({ Team: [{ 팀명: '팀', 회사ID: 'c2' }], Worker: [{ 이름: '예시', 소속팀: '팀' }] });
    const saved = await executeMasterImport(planMasterImport(data, snapshot), snapshot, writer());
    expect(saved.Worker[0]).toMatchObject({ companyId: 'c2', companyName: '회사2' });
});

test('a write failure stops subsequent operations and is not reported as success', async () => {
    const adapter = writer();
    adapter.create.mockRejectedValueOnce(new Error('save failed'));
    await expect(executeMasterImport(planMasterImport(fullImport(), emptyMasterSnapshot()), emptyMasterSnapshot(), adapter)).rejects.toThrow('save failed');
    expect(adapter.update).not.toHaveBeenCalled();
});

test('template labels and aliases have no ambiguous destinations within a sheet', () => {
    for (const type of MASTER_TYPES) {
        const labels = new Map<string, string>();
        for (const field of MASTER_DEFINITIONS[type].fields) for (const alias of [field.label, ...field.aliases]) {
            const key = alias.replace(/\s/g, '').toLowerCase();
            expect(labels.get(key) || field.label).toBe(field.label);
            labels.set(key, field.label);
        }
    }
});

test('self-references and circular parent teams are rejected', () => {
    const self = planMasterImport(dataWith({ Team: [{ 팀명: '자기팀', 상위팀: '자기팀' }] }), emptyMasterSnapshot());
    expect(self.Team[0].status).toBe('CONFLICT');
    const cycle = planMasterImport(dataWith({ Team: [{ 팀명: '팀A', 상위팀: '팀B' }, { 팀명: '팀B', 상위팀: '팀A' }] }), emptyMasterSnapshot());
    expect(cycle.Team.every(row => row.status === 'CONFLICT')).toBe(true);
});

test('an existing support-team salary conflict is not silently rewritten', () => {
    const plan = planMasterImport(dataWith({ Worker: [{ 이름: '예시', 급여방식: '월급제' }] }), dataWith({ Worker: [{ id: 'w1', name: '예시', teamType: '지원팀' }] }));
    expect(plan.Worker[0].status).toBe('CONFLICT');
});

test('external support teams and workers retain the DB external-company convention', async () => {
    const data = dataWith({ Team: [{ 팀명: '외부지원', 팀구분: '지원팀', 회사명: '외부팀' }], Worker: [{ 이름: '외부예시', 소속팀: '외부지원', 팀구분: '지원팀', 급여방식: '지원팀' }] });
    const plan = planMasterImport(data, emptyMasterSnapshot());
    expect(plan.Team[0].status).toBe('NEW');
    expect(plan.Worker[0].status).toBe('NEW');
    const saved = await executeMasterImport(plan, emptyMasterSnapshot(), writer());
    expect(saved.Team[0]).toMatchObject({ companyId: '', companyName: '외부팀', type: '지원팀' });
    expect(saved.Worker[0]).toMatchObject({ companyId: '', companyName: '외부팀', teamId: saved.Team[0].id, payType: '지원팀' });
});
