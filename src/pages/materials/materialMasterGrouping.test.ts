import { getMaterialMasterGroupKey } from './materialMasterGrouping';
import { getMaterialGroupKey } from '../../utils/materialOrdering';

it.each([
    ['시스템', '수평재', 'system'],
    [' 시스템 ', '비계 연결부', 'system'],
    ['동바리', '수직재', 'dongbari'],
    ['서포트', '수직재', 'dongbari'],
    ['시스템 동바리', '수직재', 'dongbari'],
    ['비계', '발판', 'scaffolding'],
    ['시스템 비계', '발판', 'scaffolding'],
    ['소모품', '장갑', 'other'],
])('마스터 분류 %s / %s → %s', (category, itemName, expected) => {
    expect(getMaterialMasterGroupKey({ category, itemName })).toBe(expected);
});

it('입출고의 기존 분류 규칙은 유지한다', () => {
    expect(getMaterialGroupKey({ category: '시스템', itemName: '수평재' })).toBe('dongbari');
});
