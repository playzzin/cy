import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { REFERENCE_CONSTRUCTION_PLAN_SECTIONS } from '../domain/referenceConstructionPlanSections';
import {
  loadReferenceConstructionPlanSectionCatalog,
  saveReferenceConstructionPlanSectionCatalog,
} from './referenceConstructionPlanSectionCatalogService';
import {
  readReferenceSectionCatalogFromLocalDatabase,
  writeReferenceSectionCatalogToLocalDatabase,
} from './referenceConstructionPlanSectionLocalDatabase';

jest.mock('../../../config/firebase', () => ({
  auth: { currentUser: { uid: 'admin-user' } },
  db: { name: 'test-db' },
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => ({ path: 'settings/construction_plan_reference_catalog_system_shoring_rev5' })),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(() => 'SERVER_TIME'),
}));

jest.mock('./referenceConstructionPlanSectionLocalDatabase', () => ({
  readReferenceSectionCatalogFromLocalDatabase: jest.fn(),
  writeReferenceSectionCatalogToLocalDatabase: jest.fn(),
}));

const mockedGetDoc = getDoc as jest.MockedFunction<typeof getDoc>;
const mockedSetDoc = setDoc as jest.MockedFunction<typeof setDoc>;
const mockedDoc = doc as jest.MockedFunction<typeof doc>;
const mockedServerTimestamp = serverTimestamp as jest.MockedFunction<typeof serverTimestamp>;
const mockedReadLocal = readReferenceSectionCatalogFromLocalDatabase as jest.MockedFunction<
  typeof readReferenceSectionCatalogFromLocalDatabase
>;
const mockedWriteLocal = writeReferenceSectionCatalogToLocalDatabase as jest.MockedFunction<
  typeof writeReferenceSectionCatalogToLocalDatabase
>;

describe('referenceConstructionPlanSectionCatalogService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedDoc.mockReturnValue({ path: 'settings/construction_plan_reference_catalog_system_shoring_rev5' } as never);
    mockedServerTimestamp.mockReturnValue('SERVER_TIME' as never);
    mockedReadLocal.mockResolvedValue(undefined);
    mockedWriteLocal.mockResolvedValue(undefined);
  });

  it('seeds the default catalog when the database document does not exist', async () => {
    mockedGetDoc.mockResolvedValue({ exists: () => false } as never);
    const result = await loadReferenceConstructionPlanSectionCatalog();

    expect(result.source).toBe('seeded');
    expect(result.sections).toHaveLength(33);
    expect(mockedSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'settings/construction_plan_reference_catalog_system_shoring_rev5' }),
      expect.objectContaining({
        templateKey: 'system-shoring-rev5',
        version: 1,
        items: REFERENCE_CONSTRUCTION_PLAN_SECTIONS,
        createdBy: 'admin-user',
        updatedBy: 'admin-user',
      }),
    );
    expect(serverTimestamp).toHaveBeenCalled();
  });

  it('loads and normalizes the saved catalog', async () => {
    mockedGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        items: [{
          ...REFERENCE_CONSTRUCTION_PLAN_SECTIONS[0],
          number: 82,
          title: 'DB 일반사항',
        }],
      }),
    } as never);

    await expect(loadReferenceConstructionPlanSectionCatalog()).resolves.toEqual({
      source: 'database',
      sections: [{
        ...REFERENCE_CONSTRUCTION_PLAN_SECTIONS[0],
        number: 1,
        title: 'DB 일반사항',
      }],
    });
  });

  it('saves a CRUD result as one atomic catalog document', async () => {
    mockedSetDoc.mockResolvedValue(undefined);
    const sections = [{ ...REFERENCE_CONSTRUCTION_PLAN_SECTIONS[0], title: '수정 제목' }];

    await expect(saveReferenceConstructionPlanSectionCatalog(sections)).resolves.toEqual({
      sections,
      source: 'database',
    });
    expect(mockedSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'settings/construction_plan_reference_catalog_system_shoring_rev5' }),
      expect.objectContaining({
        items: sections,
        updatedBy: 'admin-user',
      }),
      { merge: true },
    );
  });

  it('uses IndexedDB when Firebase is unavailable and preserves later CRUD writes', async () => {
    mockedGetDoc.mockRejectedValue(new Error('permission-denied'));
    mockedReadLocal.mockResolvedValue([{ ...REFERENCE_CONSTRUCTION_PLAN_SECTIONS[0], title: '오프라인 목차' }]);

    await expect(loadReferenceConstructionPlanSectionCatalog()).resolves.toEqual({
      source: 'local',
      sections: [{ ...REFERENCE_CONSTRUCTION_PLAN_SECTIONS[0], title: '오프라인 목차' }],
    });

    mockedSetDoc.mockRejectedValue(new Error('permission-denied'));
    const sections = [{ ...REFERENCE_CONSTRUCTION_PLAN_SECTIONS[0], title: '브라우저 DB 수정' }];
    await expect(saveReferenceConstructionPlanSectionCatalog(sections)).resolves.toEqual({
      source: 'local',
      sections,
    });
    expect(mockedWriteLocal).toHaveBeenCalledWith(sections);
  });
});
