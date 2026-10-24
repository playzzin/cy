import {
    buildMaterialBusinessKey,
    deleteMaterial,
    getAllMaterials,
    getUniqueMaterialsForSelection,
    updateMaterial,
} from './materialService';
import { materialFirestoreService } from './materialFirestoreService';
import { materialLogService } from './materialLogService';
import type { Material } from '../types/materials';

jest.mock('./materialFirestoreService', () => ({
    materialFirestoreService: {
        getMaterial: jest.fn(), getAllMaterials: jest.fn(),
        saveMaterial: jest.fn(), saveMaterialsBatch: jest.fn(),
    },
}));
jest.mock('./teamScopedReadService', () => ({ usesTeamScopedReads: jest.fn(async () => false) }));
jest.mock('./storageService', () => ({ storageService: {} }));
jest.mock('./materialLogService', () => ({ materialLogService: { safeCreateLog: jest.fn() } }));

const makeMaterial = (id: string, overrides: Partial<Material> = {}): Material => ({
    id, category: '동바리', itemName: '수직재', spec: 'P17', unit: 'EA',
    unitPrice: 100, isActive: true, ...overrides,
});
let stored: Map<string, Material>;
let testTime = Date.parse('2026-10-16T00:00:00Z');
const seed = (...rows: Material[]) => rows.forEach(row => stored.set(row.id, row));
const activeRows = (rows: Material[], spec = 'P17') => rows.filter(row => row.spec === spec);

beforeEach(() => {
    jest.clearAllMocks();
    testTime += 120_000;
    jest.useFakeTimers().setSystemTime(testTime);
    stored = new Map();
    (materialFirestoreService.getMaterial as jest.Mock).mockImplementation(async id => stored.get(id) ?? null);
    (materialFirestoreService.getAllMaterials as jest.Mock).mockImplementation(async () => Array.from(stored.values()));
    (materialFirestoreService.saveMaterial as jest.Mock).mockImplementation(async (id, row) => stored.set(id, row));
    (materialFirestoreService.saveMaterialsBatch as jest.Mock).mockImplementation(async rows => {
        rows.forEach((row: Material) => stored.set(row.id, row));
    });
});
afterEach(() => {
    jest.useRealTimers();
});

it('기본 여부가 누락된 구형 행보다 최신 수정 행을 선택하고 빈 설명도 유지한다', async () => {
    seed(makeMaterial('legacy', { description: '이전 설명', updatedAt: new Date(1000) as any }),
        makeMaterial('edited', { isCatalogDefault: false, description: '', updatedAt: new Date(2000) as any }));
    expect(activeRows(await getUniqueMaterialsForSelection())[0]).toMatchObject({ id: 'edited', description: '' });
});

it('삭제한 자재의 일반 중복과 기본 카탈로그를 함께 숨기고 새 조회에서도 복원하지 않는다', async () => {
    const selected = makeMaterial('selected');
    const catalogId = `catalog_${encodeURIComponent(buildMaterialBusinessKey(selected))}`;
    seed(selected, makeMaterial('duplicate'), makeMaterial(catalogId, { isCatalogDefault: true }),
        makeMaterial('unrelated', { spec: 'QA-OTHER' }));

    await deleteMaterial(selected);

    expect(activeRows(await getAllMaterials())).toEqual([]);
    expect(stored.get('duplicate')?.isActive).toBe(false);
    expect(stored.get(catalogId)?.hiddenCatalogDefault).toBe(true);
    expect(stored.get('unrelated')?.isActive).toBe(true);
    expect(stored.has('selected')).toBe(true);
    expect(materialFirestoreService.saveMaterialsBatch).toHaveBeenCalledTimes(1);
});

it('수정 후 오래된 중복 행이 최신 값이나 지운 설명을 덮어쓰지 않는다', async () => {
    seed(makeMaterial('selected', { description: '이전 설명' }), makeMaterial('duplicate', { description: '다른 설명' }));
    await updateMaterial('selected', { description: '', unitPrice: 350, safetyStock: 25 });

    const rows = activeRows(await getUniqueMaterialsForSelection());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'selected', description: '', unitPrice: 350, safetyStock: 25 });
    expect(stored.get('duplicate')?.isActive).toBe(false);
});

it('규격 변경 시 이전 중복과 자동 카탈로그가 다시 나타나지 않는다', async () => {
    seed(makeMaterial('selected'), makeMaterial('duplicate'));
    await updateMaterial('selected', { spec: 'QA-RENAMED' });

    const rows = await getAllMaterials();
    expect(activeRows(rows)).toEqual([]);
    expect(activeRows(rows, 'QA-RENAMED')).toHaveLength(1);
});

it('기본 카탈로그 대신 등록한 단일 자재의 규격을 바꿔도 이전 규격이 복원되지 않는다', async () => {
    seed(makeMaterial('selected'));
    await updateMaterial('selected', { spec: 'QA-SINGLE' });
    expect(activeRows(await getAllMaterials())).toEqual([]);
});

it('이미 존재하는 다른 자재의 품명·규격으로 수정하면 쓰기 전에 거절한다', async () => {
    seed(makeMaterial('selected'), makeMaterial('other', { spec: 'P12' }));
    await expect(updateMaterial('selected', { spec: 'P12' })).rejects.toThrow('이미 등록된 자재');
    expect(materialFirestoreService.saveMaterialsBatch).not.toHaveBeenCalled();
    expect(materialFirestoreService.saveMaterial).not.toHaveBeenCalled();
});

it('묶음 저장 실패 시 성공 로그를 남기거나 저장된 원본을 바꾸지 않는다', async () => {
    seed(makeMaterial('selected'), makeMaterial('duplicate'));
    (materialFirestoreService.saveMaterialsBatch as jest.Mock).mockRejectedValueOnce(new Error('permission-denied'));
    await expect(deleteMaterial('selected')).rejects.toThrow('permission-denied');
    expect(stored.get('selected')?.isActive).toBe(true);
    expect(stored.get('duplicate')?.isActive).toBe(true);
    expect(materialLogService.safeCreateLog).not.toHaveBeenCalled();
});
