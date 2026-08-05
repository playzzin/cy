import { matchesMenuPosition } from './menuPosition';

describe('matchesMenuPosition', () => {
    it.each(['ceo', '대표', '대표이사', '사장', 'pos_ceo', 'chief executive officer'])(
        'recognizes %s as the CEO menu position',
        (profileValue) => {
            expect(matchesMenuPosition('ceo', '대표', profileValue)).toBe(true);
        }
    );

    it('does not map unrelated positions to the CEO menu', () => {
        expect(matchesMenuPosition('ceo', '대표', '매니저1')).toBe(false);
    });
});
