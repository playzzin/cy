import {
  ConstructionPlanErpSnapshotSchema,
  ConstructionPlanSchema,
  ProjectSnapshotSchema,
  UpdateConstructionPlanInputSchema,
} from './constructionPlan';

const erpSnapshot = {
  schemaVersion: 1 as const,
  capturedAt: '2026-08-21T01:02:03.000Z',
  site: {
    value: { id: 'site-1', name: '테스트 현장', code: 'SITE-1' },
    source: 'site' as const,
    sourceId: 'site-1',
    sourceUpdatedAt: '2026-08-20T00:00:00.000Z',
    capturedAt: '2026-08-21T01:02:03.000Z',
    overridden: false,
  },
  clientCompany: {
    value: {
      id: 'company-1',
      name: '발주사',
      businessNumber: '123-45-67890',
      accountNumber: 'must-be-stripped',
    },
    source: 'company' as const,
    sourceId: 'company-1',
    capturedAt: '2026-08-21T01:02:03.000Z',
    overridden: false,
  },
};

describe('construction plan ERP snapshot contract', () => {
  it('keeps source metadata and strips fields outside the public business allowlist', () => {
    const parsed = ConstructionPlanErpSnapshotSchema.parse({
      ...erpSnapshot,
      site: {
        ...erpSnapshot.site,
        value: {
          ...erpSnapshot.site.value,
          imageUrl: 'https://storage.example/site.jpg?token=private-token',
          photos: ['https://storage.example/photo.jpg?token=private-token'],
        },
      },
    });

    expect(parsed.clientCompany?.sourceId).toBe('company-1');
    expect(parsed.clientCompany?.value.businessNumber).toBe('123-45-67890');
    expect(parsed.clientCompany?.value).not.toHaveProperty('accountNumber');
    expect(parsed.site.value).not.toHaveProperty('imageUrl');
    expect(parsed.site.value).not.toHaveProperty('photos');
  });

  it('drops legacy site photos at the project read boundary', () => {
    const parsed = ProjectSnapshotSchema.parse({
      capturedAt: '2026-08-21T01:02:03.000Z',
      siteName: '테스트 현장',
      sitePhotos: ['https://storage.example/photo.jpg?token=private-token'],
    });
    expect(parsed.sitePhotos).toEqual([]);
    expect(JSON.stringify(parsed)).not.toContain('private-token');
  });

  it('keeps the new envelope optional for legacy plans and server-owned for updates', () => {
    expect(ConstructionPlanSchema.shape.erpSnapshot.isOptional()).toBe(true);

    const update = UpdateConstructionPlanInputSchema.parse({
      updatedBy: 'author-1',
      erpSnapshot,
    });
    expect(update).not.toHaveProperty('erpSnapshot');
  });

  it('rejects a master value whose source kind does not match its slot', () => {
    expect(ConstructionPlanErpSnapshotSchema.safeParse({
      ...erpSnapshot,
      site: { ...erpSnapshot.site, source: 'company' },
    }).success).toBe(false);
  });

  it('accepts only plan-specific scope in a generic project update', () => {
    expect(UpdateConstructionPlanInputSchema.parse({
      updatedBy: 'author-1',
      projectSnapshot: {
        buildings: ['101동'],
        floors: ['3층'],
        zones: ['A구간'],
        emergencyContactsComplete: true,
      },
    }).projectSnapshot).toEqual({
      buildings: ['101동'],
      floors: ['3층'],
      zones: ['A구간'],
      emergencyContactsComplete: true,
    });

    ['siteName', 'address', 'clientName', 'contractorName', 'constructionPeriod', 'sitePhotos']
      .forEach((field) => {
        expect(UpdateConstructionPlanInputSchema.safeParse({
          updatedBy: 'author-1',
          projectSnapshot: { [field]: field === 'constructionPeriod' ? { startDate: '2099-01-01' } : 'forged' },
        }).success).toBe(false);
      });
  });
});
