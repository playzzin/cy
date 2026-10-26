import { matchesMenuPosition } from './menuPosition';

describe('matchesMenuPosition', () => {
    it.each(['매니저', '매니저1', '매니저2', '매니저3', '메니저3', 'manager', 'pos_manager2'])(
        'maps legacy manager value %s to the consolidated menu', (value) => {
            expect(matchesMenuPosition('manager', '매니저', value)).toBe(true);
            expect(matchesMenuPosition('custom-id', '매니저', value)).toBe(true);
        }
    );
    it.each(['ceo', 'CEO', 'pos_ceo', 'chief executive officer'])(
        'recognizes %s as the CEO menu position',
        (profileValue) => {
            expect(matchesMenuPosition('ceo', 'CEO', profileValue)).toBe(true);
        }
    );

    it('does not map unrelated positions to the CEO menu', () => {
        expect(matchesMenuPosition('ceo', 'CEO', '매니저1')).toBe(false);
    });
});
