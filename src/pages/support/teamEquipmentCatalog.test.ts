import { DEFAULT_EQUIPMENT_ITEMS, upgradeEquipmentCatalog } from './teamEquipmentCatalog';

test('기본 장비는 요청한 다섯 항목 순서로 제공한다', () => {
    expect(DEFAULT_EQUIPMENT_ITEMS.map(item => item.name)).toEqual(['임팩', '함마', '스킬', '배터리', '기타']);
});

test('기존 기타 ID를 함마에 유지하고 새 기타 항목을 별도로 만든다', () => {
    const items = [{ id: 'impact', name: '임팩' }, { id: 'skill', name: '스킬' }, { id: 'legacy-other', name: '기타' }];
    const result = upgradeEquipmentCatalog(items);
    expect(result.map(item => item.name)).toEqual(['임팩', '함마', '스킬', '배터리', '기타']);
    expect(result[1]).toEqual({ id: 'legacy-other', name: '함마' });
    expect(result[4].id).not.toBe('legacy-other');
    expect(items[2].name).toBe('기타');
});

test('기존 기타 ID가 other여도 신규 기타 ID와 겹치지 않는다', () => {
    const result = upgradeEquipmentCatalog([{ id: 'other', name: '기타' }]);
    expect(result.find(item => item.name === '함마')?.id).toBe('other');
    expect(new Set(result.map(item => item.id)).size).toBe(5);
});

test('이미 함마가 있는 경우 기타를 바꾸지 않고 사용자 추가 항목도 유지한다', () => {
    const result = upgradeEquipmentCatalog([{ id: 'a', name: '함마' }, { id: 'b', name: '기타' }, { id: 'laser', name: '레이저' }]);
    expect(result[1]).toEqual({ id: 'a', name: '함마' });
    expect(result[4]).toEqual({ id: 'b', name: '기타' });
    expect(result[5]).toEqual({ id: 'laser', name: '레이저' });
});

test('저장한 사용자 이름·삭제·순서를 새로고침 때 기본값으로 덮어쓰지 않는다', () => {
    const items = [{ id: 'battery', name: '충전 배터리' }, { id: 'other', name: '공구' }];
    expect(upgradeEquipmentCatalog(items, 2)).toEqual(items);
    expect(upgradeEquipmentCatalog([], 2)).toEqual([]);
    expect(upgradeEquipmentCatalog([])).toEqual([]);
});
