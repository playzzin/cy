import { getPositionMenuView, getLinkedMenuRef, getLinkedPositions, linkedMenuId, setPositionMenuView } from './linkedPositionMenus';
import { menuConfigsEqual, mergeMenuConfigChanges } from './menuConfigChanges';
import type { SiteDataType, MenuItem } from '../types/menu';

const config = (): SiteDataType => ({
    admin: { name: '전체', icon: '', menu: [], positionConfig: [
        { id: 'dev', name: 'DEV', icon: '', color: '', order: 0 },
        { id: 'leader', name: '팀장', icon: '', color: '', order: 2 },
        { id: 'office', name: '사무실', icon: '', color: '', order: 1 },
    ] },
    pos_dev: { name: 'DEV', icon: '', menu: [{ id: 'same', text: 'DEV 고유' }] },
    pos_leader: { name: '팀장', icon: '', menu: [{ id: 'same', text: '일보', sub: [{ id: 'child', text: '작성', path: '/daily' }] }] },
    pos_office: { name: '사무실', icon: '', menu: [{ id: 'same', text: '급여' }] },
});

it('등록된 직책을 순서대로 연결하고 DEV와 다른 직책의 같은 ID를 분리한다', () => {
    const data = config();
    const view = getPositionMenuView(data, 'pos_dev');
    expect(view.map(i => i.text)).toEqual(['DEV 고유', '-', '사무실', '팀장']);
    expect((view[2].sub![0] as MenuItem).id).not.toEqual((view[3].sub![0] as MenuItem).id);
    expect(getPositionMenuView(data, 'pos_leader')).toEqual(data.pos_leader.menu);
    data.pos_dev.linkedPositionMenusEnabled = false;
    expect(getPositionMenuView(data, 'pos_dev')).toEqual(data.pos_dev.menu);
});

it('DEV 안에서 이름, 순서, 하위 메뉴, 숨김을 수정해도 원본에만 저장한다', () => {
    const data = config();
    const originalDev = JSON.stringify(data.pos_dev);
    const view = getPositionMenuView(data, 'pos_dev');
    const source = view.find(i => i.id === linkedMenuId('pos_leader'))!;
    const menu = source.sub![0] as MenuItem;
    menu.text = '출력 관리';
    menu.hide = true;
    menu.sub = [{ id: 'new', text: '새 항목', path: '/new' }, ...menu.sub!];
    setPositionMenuView(data, 'pos_dev', view);
    expect(JSON.stringify(data.pos_dev)).toBe(originalDev);
    expect(data.pos_leader.menu[0]).toMatchObject({ id: 'same', text: '출력 관리', hide: true, sub: [{ id: 'new' }, { id: 'child' }] });
    expect(JSON.stringify(data)).not.toContain('__linked_position__');
    data.pos_leader.menu[0].text = '직책에서 수정';
    expect((getPositionMenuView(data, 'pos_dev')[3].sub![0] as MenuItem).text).toBe('직책에서 수정');
});

it('직책 추가·삭제·이름 변경을 반영하고 없는 직책을 되살리지 않는다', () => {
    const data = config();
    data.admin.positionConfig![1].name = '현장 팀장';
    expect(getLinkedPositions(data, 'pos_dev')[1].name).toBe('현장 팀장');
    delete data.pos_office;
    expect(getLinkedPositions(data, 'pos_dev').map(p => p.id)).toEqual(['leader']);
    data.pos_office = { name: '사무실', icon: '', menu: [] };
    expect(getPositionMenuView(data, 'pos_dev')[2].sub).toEqual([]);
});

it('다른 직책의 동시 변경을 보존하고 같은 메뉴 변경 충돌은 거부한다', () => {
    const base = config();
    const next = config();
    const remote = config();
    next.pos_leader.menu[0].text = '내 수정';
    remote.pos_office.menu[0].text = '다른 창 수정';
    const saved = mergeMenuConfigChanges(remote, base, next);
    expect(saved.pos_office.menu[0].text).toBe('다른 창 수정');
    expect(saved.pos_leader.menu[0].text).toBe('내 수정');
    remote.pos_leader.menu[0].text = '동시 수정';
    expect(() => mergeMenuConfigChanges(remote, base, next)).toThrow('다른 창에서 같은 메뉴');
});

it('잘못된 직책 연결을 거부하고 모든 직책의 기존 데이터를 보존한다', () => {
    const data = config();
    const original = JSON.stringify(data);
    const view = getPositionMenuView(data, 'pos_dev');
    view[0] = { ...view[0], text: '저장되면 안 되는 변경' };
    (view[2].sub![0] as MenuItem).text = '앞선 직책 변경';
    (view[3].sub![0] as MenuItem).id = linkedMenuId('pos_office', 'same');
    expect(() => setPositionMenuView(data, 'pos_dev', view)).toThrow('다른 직책');
    expect(JSON.stringify(data)).toBe(original);
    expect(() => setPositionMenuView(data, 'pos_dev', [...view, view[3]])).toThrow();
    expect(JSON.stringify(data)).toBe(original);
});

it('고아 연결 메뉴나 해제된 연결을 저장해 원본을 유실하지 않는다', () => {
    const data = config();
    const view = getPositionMenuView(data, 'pos_dev');
    const orphan = view[2].sub![0] as MenuItem;
    expect(() => setPositionMenuView(data, 'pos_dev', [...view, orphan])).toThrow('해당 직책 안에서만');
    data.pos_dev.linkedPositionMenusEnabled = false;
    expect(() => setPositionMenuView(data, 'pos_dev', view)).toThrow();
    expect(data.pos_dev.menu).toHaveLength(1);
});

it.each(['__linked_position__/pos_leader/root/extra', '__linked_position__/pos_leader/item/', '__linked_position__/pos_leader/item/id/extra', '__linked_position__/%/root'])('잘못된 연결 ID를 해석하지 않는다: %s', id => {
    expect(getLinkedMenuRef(id)).toBeNull();
});

it('속성 순서가 달라져도 같은 메뉴로 비교하고 결과가 입력을 공유하지 않는다', () => {
    const base = config();
    const next = config();
    next.pos_leader.menu[0].text = '수정';
    const remote = config();
    remote.pos_leader.menu[0] = { sub: remote.pos_leader.menu[0].sub, text: '일보', id: 'same', hide: undefined };
    expect(menuConfigsEqual(base, remote)).toBe(true);
    const merged = mergeMenuConfigChanges(remote, base, next);
    merged.pos_leader.menu[0].text = '결과만 변경';
    expect(next.pos_leader.menu[0].text).toBe('수정');
});
