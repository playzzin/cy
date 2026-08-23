import { hasAccountHolderNameMismatch } from './accountHolderName';

describe('hasAccountHolderNameMismatch', () => {
    it('treats whitespace and unicode width differences as the same holder name', () => {
        expect(hasAccountHolderNameMismatch('홍길동', '홍 길동')).toBe(false);
        expect(hasAccountHolderNameMismatch('ABC', 'ＡＢＣ')).toBe(false);
    });

    it('flags a different account holder name', () => {
        expect(hasAccountHolderNameMismatch('홍길동', '김철수')).toBe(true);
    });

    it('leaves missing values to the existing missing-account UI', () => {
        expect(hasAccountHolderNameMismatch('홍길동', '')).toBe(false);
        expect(hasAccountHolderNameMismatch('', '김철수')).toBe(false);
    });
});

