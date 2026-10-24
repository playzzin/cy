import { parseTeamImport, resolveTeamImportRow } from './teamImport';

test('팀명과 팀구분, 팀장명, 상위팀을 각각 인식한다', () => {
    const { rows, mappedFields } = parseTeamImport('팀명\t팀구분\t팀장명\t상위팀\n테스트팀\t지원팀\t테스트팀장\t원청팀');
    expect(mappedFields).toEqual({ 0: 'name', 1: 'type', 2: 'leaderName', 3: 'parentTeamName' });
    expect(rows[0]).toMatchObject({ name: '테스트팀', type: '지원팀', leaderName: '테스트팀장', _valid: true });
});
test.each(['팀명\t팀이름\nA\tB', '팀장명\n테스트팀장', '팀명\nA\nA', '팀명\nA\tB'])('모호하거나 잘못된 입력을 저장 불가로 표시한다: %s', text => {
    expect(parseTeamImport(text).rows.every(row => !row._valid)).toBe(true);
});
test('빈 입력을 지우고 빈 첫 열과 마지막 열을 보존한다', () => {
    expect(parseTeamImport(' \n').rows).toEqual([]);
    expect(parseTeamImport('팀명\t팀장명\n\t테스트팀장').rows[0]._valid).toBe(false);
    expect(parseTeamImport('팀명\t팀장명\nA\t').rows[0]).toMatchObject({ name: 'A', leaderName: '', _valid: true });
});
const row = parseTeamImport('팀명\t팀장명\t회사명\t상위팀\nA\t리더\t회사\t원청').rows[0];
const refs = { workers: [{ id: 'w', name: '리더' }], companies: [{ id: 'c', name: '회사' }], teams: [{ id: 't', name: '원청' }] };
test('이름을 실제 ID로 연결한다', () => {
    expect(resolveTeamImportRow(row, refs)).toMatchObject({ leaderId: 'w', companyId: 'c', parentTeamId: 't' });
});
test('누락된 관계, 동명이인, 기존 팀 중복을 막는다', () => {
    expect(() => resolveTeamImportRow(row, { ...refs, workers: [] })).toThrow('찾을 수 없습니다');
    expect(() => resolveTeamImportRow(row, { ...refs, workers: [...refs.workers, { id: 'w2', name: '리더' }] })).toThrow('중복');
    expect(() => resolveTeamImportRow(row, { ...refs, teams: [...refs.teams, { id: 'a', name: 'A' }] })).toThrow('이미 등록');
});
