// Two-set Korean search fallback. Never rewrites the input or controls the OS IME.
const keys = 'rRseEfaqQtTdwWczxvgkoiOjpuPhynbml';
const letters = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎㅏㅐㅑㅒㅓㅔㅕㅖㅗㅛㅜㅠㅡㅣ';
const initials = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const vowels = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const finals = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';
const vowelPairs: Record<string, string> = {
    'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ',
    'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ', 'ㅡㅣ': 'ㅢ',
};
const finalPairs: Record<string, string> = {
    'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ', 'ㄹㄱ': 'ㄺ',
    'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ', 'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ',
    'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ', 'ㅂㅅ': 'ㅄ',
};

export const koreanKeyboardText = (text: string): string => {
    const jamo = Array.from(text, key => {
        const index = keys.indexOf(keys.includes(key) ? key : key.toLowerCase());
        return index < 0 ? key : letters[index];
    });
    const isVowel = (index: number) => Boolean(jamo[index]) && vowels.includes(jamo[index]);
    let result = '';
    let index = 0;
    while (index < jamo.length) {
        const initial = initials.indexOf(jamo[index]);
        if (initial < 0 || !isVowel(index + 1)) {
            const pair = vowelPairs[jamo[index] + jamo[index + 1]];
            result += pair || jamo[index];
            index += pair ? 2 : 1;
            continue;
        }
        index += 1;
        let vowel = jamo[index++];
        const vowelPair = vowelPairs[vowel + jamo[index]];
        if (vowelPair) { vowel = vowelPair; index += 1; }
        let final = 0;
        if (jamo[index] && finals.indexOf(jamo[index]) > 0 && !isVowel(index + 1)) {
            final = finals.indexOf(jamo[index++]);
            const finalPair = finalPairs[finals[final] + jamo[index]];
            if (finalPair && !isVowel(index + 1)) {
                final = finals.indexOf(finalPair);
                index += 1;
            }
        }
        result += String.fromCharCode(0xAC00 + (initial * 21 + vowels.indexOf(vowel)) * 28 + final);
    }
    return result;
};

// Prefer literal matches so English company names/codes keep their meaning.
// Only when there are none, also try Korean key equivalents, token by token.
export function filterKoreanSearch<T>(items: T[], query: string, getText: (item: T) => string): T[] {
    const terms = query.trim().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return items;
    const candidates = items.map(item => ({ item, text: getText(item).normalize('NFC').toLowerCase() }));
    const literalTerms = terms.map(term => term.normalize('NFC').toLowerCase());
    const literalMatches = candidates.filter(({ text }) => literalTerms.every(term => text.includes(term)));
    if (literalMatches.length > 0) return literalMatches.map(({ item }) => item);
    const alternatives = terms.map((term, index) => {
        const korean = koreanKeyboardText(term).normalize('NFC').toLowerCase();
        return /[가-힣]/.test(korean) ? [literalTerms[index], korean] : [literalTerms[index]];
    });
    return candidates.filter(({ text }) => alternatives.every(tokens => tokens.some(token => text.includes(token))))
        .map(({ item }) => item);
}
