import { filterKoreanSearch, koreanKeyboardText } from './koreanKeyboard';

test.each([
    ['gksrmf', '한글'], ['cjddus', '청연'], ['cjd dus', '청 연'],
    ['dkssudgktpdy', '안녕하세요'],
    ['r', 'ㄱ'], ['rk', '가'], ['rks', '간'], ['rksk', '가나'],
    ['rkqt', '값'], ['rkqtdl', '값이'], ['rkqtk', '갑사'],
    ['dlfr', '읽'], ['dlfrdj', '읽어'], ['dlfrj', '일거'], ['qhk', '봐'], ['dnjs', '원'],
    ['rhk', '과'], ['rnl', '귀'], ['dml', '의'], ['hk', 'ㅘ'],
    ['RkRk', '까까'], ['Qk', '빠'], ['Wk', '짜'], ['Ek', '따'], ['Tk', '싸'],
    ['dO', '얘'], ['dP', '예'], ['GKS', '한'], ['123-45', '123-45'], ['', ''],
])('%s → %s', (keys, expected) => {
    expect(koreanKeyboardText(keys)).toBe(expected);
});

test('잘못된 영문 자판의 한글 검색과 혼합 검색을 보완한다', () => {
    const items = ['합성 A 건설', '합성 B 건설', '다른 현장'];
    expect(filterKoreanSearch(items, 'gkqtjd A', value => value)).toEqual(['합성 A 건설']);
    expect(filterKoreanSearch(items, 'rjstjf', value => value)).toEqual(items.slice(0, 2));
    expect(filterKoreanSearch(items, '합성 B', value => value)).toEqual(['합성 B 건설']);
});

test('영문 검색 결과가 있으면 키보드 변환으로 관련 없는 한글 결과를 섞지 않는다', () => {
    expect(filterKoreanSearch(['SK 현장', '나 현장'], 'SK', value => value)).toEqual(['SK 현장']);
    expect(filterKoreanSearch(['ABC-123', '다른 현장'], 'abc-123', value => value)).toEqual(['ABC-123']);
    expect(filterKoreanSearch(['까 현장', '가 현장'], 'Rk', value => value)).toEqual(['까 현장']);
});

test('빈 검색은 전체를 유지하고 없는 검색어를 빈 문자열로 취급하지 않는다', () => {
    const items = [{ name: '합성' }, { name: '현장' }];
    expect(filterKoreanSearch(items, ' ', item => item.name)).toBe(items);
    expect(filterKoreanSearch(items, '없는 결과', item => item.name)).toEqual([]);
});
