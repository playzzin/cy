import type { ConstructionPlanErpSnapshot } from '../types';
import {
  diffConstructionPlanErpSnapshots,
  hasConstructionPlanErpSnapshotChanges,
} from './erpSnapshotDiff';

const snapshot = (): ConstructionPlanErpSnapshot => ({
  schemaVersion: 1,
  capturedAt: '2026-08-22T00:00:00.000Z',
  site: {
    source: 'site',
    sourceId: 'site-1',
    capturedAt: '2026-08-22T00:00:00.000Z',
    value: {
      id: 'site-1',
      name: '청연 현장',
      address: '서울시',
      responsibleTeamId: 'team-1',
      responsibleTeamName: '시공팀',
    },
  },
  contractorCompany: {
    source: 'company',
    sourceId: 'company-1',
    capturedAt: '2026-08-22T00:00:00.000Z',
    value: {
      id: 'company-1',
      name: '원도급 주식회사',
      representativeName: '대표자',
      email: 'private@example.com',
    },
  },
  responsibleTeam: {
    source: 'team',
    sourceId: 'team-1',
    capturedAt: '2026-08-22T00:00:00.000Z',
    value: { id: 'team-1', name: '시공팀', leaderName: '김책임' },
  },
});

describe('construction plan ERP snapshot diff', () => {
  it('returns stable field-level changes with latest source provenance', () => {
    const before = snapshot();
    const after: ConstructionPlanErpSnapshot = {
      ...snapshot(),
      capturedAt: '2026-08-23T00:00:00.000Z',
      site: {
        ...snapshot().site,
        sourceUpdatedAt: '2026-08-22T12:00:00.000Z',
        value: { ...snapshot().site.value, address: '서울시 강남구', responsibleTeamName: '안전시공팀' },
      },
      responsibleTeam: {
        ...snapshot().responsibleTeam!,
        sourceUpdatedAt: '2026-08-22T11:00:00.000Z',
        value: { ...snapshot().responsibleTeam!.value, name: '안전시공팀', leaderName: '이책임' },
      },
    };

    expect(diffConstructionPlanErpSnapshots(before, after)).toEqual([
      expect.objectContaining({ id: 'site.address', before: '서울시', after: '서울시 강남구', sourceId: 'site-1' }),
      expect.objectContaining({ id: 'site.responsibleTeamName', before: '시공팀', after: '안전시공팀' }),
      expect.objectContaining({ id: 'responsibleTeam.name', before: '시공팀', after: '안전시공팀', sourceId: 'team-1' }),
      expect.objectContaining({ id: 'responsibleTeam.leaderName', before: '김책임', after: '이책임' }),
    ]);
    expect(hasConstructionPlanErpSnapshotChanges(before, after)).toBe(true);
  });

  it('does not expose photos, image URLs, email or other excluded master fields', () => {
    const before = snapshot();
    // Model a forged/legacy runtime payload without weakening the canonical
    // typed fixture now that site-master media is outside the schema.
    const afterRaw: unknown = {
      ...snapshot(),
      site: { ...snapshot().site, value: { ...snapshot().site.value, imageUrl: 'https://private.example/new.jpg' } },
      contractorCompany: {
        ...snapshot().contractorCompany!,
        value: { ...snapshot().contractorCompany!.value, email: 'changed-private@example.com' },
      },
    };
    const after = afterRaw as ConstructionPlanErpSnapshot;
    expect(diffConstructionPlanErpSnapshots(before, after)).toEqual([]);
    expect(hasConstructionPlanErpSnapshotChanges(before, after)).toBe(false);
  });

  it('surfaces a linked master identity change even when its display name is unchanged', () => {
    const before = snapshot();
    const after: ConstructionPlanErpSnapshot = {
      ...snapshot(),
      contractorCompany: {
        ...snapshot().contractorCompany!,
        sourceId: 'company-2',
        value: { ...snapshot().contractorCompany!.value, id: 'company-2' },
      },
    };

    expect(diffConstructionPlanErpSnapshots(before, after)).toEqual([
      expect.objectContaining({
        id: 'contractorCompany.name',
        before: '원도급 주식회사',
        after: '원도급 주식회사',
        sourceId: 'company-2',
      }),
    ]);
  });
});
