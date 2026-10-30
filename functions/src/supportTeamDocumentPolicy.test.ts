import { strict as assert } from 'assert';
import { test } from 'node:test';
import { supportDocumentPeople, documentRowIds } from './supportTeamDocumentPolicy';
import { summaryDirectoryTeams } from './workerSummaryDirectory';
import { TeamRow } from './teamReadPolicy';

const fixture = () => {
    const teams: TeamRow[] = [
        { id: 'own', legacyId: 'own-old', name: '내 팀', companyId: 'company' },
        { id: 'other', name: '다른 팀', leaderId: 'other-leader', companyId: 'company-old' },
        { id: 'outside', name: '외부 팀', companyId: 'outside-company' },
    ];
    const companies = [{ id: 'company', legacyId: 'company-old', name: '가상 회사' }, { id: 'outside-company', name: '외부 회사' }];
    return {
        ownTeamIds: ['own', 'own-old'], office: false, teams, companies,
        allowedTeamIds: summaryDirectoryTeams(teams, companies, [teams[0]]).flatMap(documentRowIds),
        workers: [
            { id: 'own-leader', teamId: 'own', name: '내 팀장', role: '팀장', fileNameSaved: 'private-id', idNumber: 'PRIVATE', bankPhotoId: 'private-bank' },
            { id: 'other-worker', teamId: 'other', name: '다른 팀 작업자', fileNameSaved: 'private-other-id' },
            { id: 'other-leader', teamId: 'other', name: '다른 팀장', bankPhotoId: 'private-other-bank' },
            { id: 'never-attended', teamId: 'other', name: '지원 이력 없는 작업자', directPayBankPhotoId: 'private-direct-bank' },
            { id: 'outside', teamId: 'outside', name: '외부 작업자' },
        ] as TeamRow[],
    };
};

test('지원 이력 없이도 작업자 목록의 다른 팀원과 팀장 서류를 조회하고 원본 경로·개인번호는 제외한다', () => {
    const people = supportDocumentPeople(fixture());
    assert.deepEqual(people.map(worker => worker.id), ['own-leader', 'other-worker', 'other-leader', 'never-attended']);
    assert.deepEqual(people.map(worker => worker.relation), ['own', 'other', 'other', 'other']);
    assert.equal(people[2].role, '팀장');
    assert.equal(people[3].hasDirectPayBank, true);
    assert(!JSON.stringify(people).includes('private')); assert(!JSON.stringify(people).includes('PRIVATE'));
});

test('회사 연결이 바뀌면 기존 명단 범위와 동일하게 다른 회사 서류를 제외한다', () => {
    const source = fixture();
    source.teams[1].companyId = 'outside-company';
    source.allowedTeamIds = summaryDirectoryTeams(source.teams, source.companies, [source.teams[0]]).flatMap(documentRowIds);
    assert.deepEqual(supportDocumentPeople(source).map(worker => worker.id), ['own-leader']);
});

test('퇴사자·비활성 작업자는 서류 공유 대상에서 제외한다', () => {
    const source = fixture();
    source.workers[1].status = '퇴사';
    source.workers[2].isActive = false;
    assert.deepEqual(supportDocumentPeople(source).map(worker => worker.id), ['own-leader', 'never-attended']);
});

test('사무실의 전체 서류 조회는 유지하고 팀장에게는 지정된 명단 범위만 허용한다', () => {
    const source = fixture();
    assert.equal(supportDocumentPeople({ ...source, office: true }).length, 5);
    assert.deepEqual(supportDocumentPeople({ ...source, allowedTeamIds: [] }), []);
});
