import { getAllMaterials, getUniqueMaterialsForSelection } from './materialService';
import { materialFirestoreService } from './materialFirestoreService';
import { usesTeamScopedReads } from './teamScopedReadService';

jest.mock('./materialFirestoreService', () => ({ materialFirestoreService: { getAllMaterials: jest.fn(), saveMaterial: jest.fn() } }));
jest.mock('./teamScopedReadService', () => ({ usesTeamScopedReads: jest.fn() }));
jest.mock('./storageService', () => ({ storageService: {} }));

beforeEach(() => jest.clearAllMocks());

it('팀장은 기본 자재를 저장하지 않고 기존 자재와 기본 카탈로그를 조회한다', async () => {
    (usesTeamScopedReads as jest.Mock).mockResolvedValue(true);
    (materialFirestoreService.getAllMaterials as jest.Mock).mockResolvedValue([
        { id: 'own', itemName: '팀 자재', category: '기타', unit: '개', isActive: true },
    ]);
    const rows = await getAllMaterials();
    expect(rows.find(row => row.id === 'own')?.itemName).toBe('팀 자재');
    expect(rows.some(row => row.isCatalogDefault)).toBe(true);
    expect(materialFirestoreService.saveMaterial).not.toHaveBeenCalled();
});

it('관리자 조회 후 팀장으로 전환하면 가격이 담긴 캐시를 재사용하지 않는다', async () => {
    (usesTeamScopedReads as jest.Mock).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    (materialFirestoreService.getAllMaterials as jest.Mock)
        .mockResolvedValueOnce([{ id: 'shared', itemName: '공유 자재', unitPrice: 900 }])
        .mockResolvedValueOnce([{ id: 'shared', itemName: '공유 자재' }]);
    await getUniqueMaterialsForSelection();
    (materialFirestoreService.saveMaterial as jest.Mock).mockClear();
    const rows = await getUniqueMaterialsForSelection();
    expect(rows.find(row => row.id === 'shared')?.unitPrice).toBeUndefined();
    expect(materialFirestoreService.getAllMaterials).toHaveBeenCalledTimes(2);
    expect(materialFirestoreService.saveMaterial).not.toHaveBeenCalled();
});
