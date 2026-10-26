import { resolveUserMenuPositionId } from './userMenuPosition';
import { PositionItem } from '../types/menu';

const positions: PositionItem[] = [
    { id: 'manager', name: '매니저', icon: '', color: '' },
    { id: 'dev', name: '개발자', icon: '', color: '' },
    { id: 'leader-custom', name: '팀장', icon: '', color: '' },
    { id: 'full', name: '전체', icon: '', color: '' },
    { id: 'general', name: '일반', icon: '', color: '' },
];

it.each(['매니저', '매니저1', '매니저2', '매니저3', 'manager2'])(
    '통합 전후 직책 %s는 통합 매니저 메뉴에 연결한다', (position) => {
        expect(resolveUserMenuPositionId(positions, { role: 'user', position })).toBe('manager');
    }
);

it('프로필에 dev가 남아 있어도 연결된 작업자의 팀장 직책을 우선한다', () => {
    expect(resolveUserMenuPositionId(positions, { position: 'dev', role: 'admin' }, ['팀장']))
        .toBe('leader-custom');
});

it('작업자 역방향 조회 결과가 없으면 계정의 직책으로 메뉴를 찾는다', () => {
    expect(resolveUserMenuPositionId(positions, { position: '팀장', role: 'user' }, [undefined]))
        .toBe('leader-custom');
});

it('직책이 없는 일반 계정을 dev로 선택하지 않는다', () => {
    expect(resolveUserMenuPositionId(positions, { role: 'user' })).toBe('general');
    expect(resolveUserMenuPositionId(positions, null)).toBeUndefined();
});
