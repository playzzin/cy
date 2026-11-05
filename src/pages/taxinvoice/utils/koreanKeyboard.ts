// Two-set Korean keyboard fallback for search fields when the OS IME is English.
// Native IME composition and pasted text are handled by the input, not this helper.
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
