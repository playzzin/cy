import { getMaterialMasterCategory, getMaterialMasterDisplayGroupKey, getMaterialMasterGroupKey } from './materialMasterGrouping';
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

it('기존 재고 정렬의 분류 규칙은 유지한다', () => {
    expect(getMaterialGroupKey({ category: '시스템', itemName: '수평재' })).toBe('dongbari');
});

it.each([
    ['시스템', '수직재', 'other', '기타'],
    ['소모품', '장갑', 'other', '기타'],
    ['기타', '비계 연결부', 'other', '기타'],
    ['동바리', '비계 연결부', 'dongbari', '동바리'],
    ['동바리', '수직재', 'dongbari', '동바리'],
    ['시스템 동바리', '수직재', 'dongbari', '동바리'],
    ['시스템 비계', '발판', 'scaffolding', '비계'],
])('마스터 화면의 세 분류로 표시한다: %s / %s', (category, itemName, group, label) => {
    expect(getMaterialMasterDisplayGroupKey({ category, itemName })).toBe(group);
    expect(getMaterialMasterCategory({ category, itemName })).toBe(label);
});
