import { koreanKeyboardText } from './koreanKeyboard';

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
