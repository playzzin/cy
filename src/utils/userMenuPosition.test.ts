import { resolveUserMenuPositionId } from './userMenuPosition';
import { PositionItem } from '../types/menu';

const positions: PositionItem[] = [
    { id: 'dev', name: '개발자', icon: '', color: '' },
    { id: 'leader-custom', name: '팀장', icon: '', color: '' },
    { id: 'full', name: '전체', icon: '', color: '' },
    { id: 'general', name: '일반', icon: '', color: '' },
];

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
