import { parseDrawingStudioValue } from './drawingStudioSchema';

describe('drawingStudioSchema', () => {
  it('migrates the unversioned studio shape', () => {
    expect(parseDrawingStudioValue({ objects: [] })).toEqual({ schemaVersion: 1, objects: [] });
  });

  it('falls back safely when a layer or normalized point is invalid', () => {
    expect(parseDrawingStudioValue({
      schemaVersion: 1,
      objects: [{
        id: 'bad-object',
        kind: 'rectangle',
        layer: 'unknown',
        points: [{ x: -4, y: 0 }, { x: 1, y: 1 }],
        label: '',
        zoneCode: '',
      }],
    })).toEqual({ schemaVersion: 1, objects: [] });
  });

  it('keeps legacy objects readable and preserves structured layer attributes', () => {
    const parsed = parseDrawingStudioValue({
      objects: [{
        id: 'retain-1',
        kind: 'rectangle',
        layer: 'retain',
        points: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.4 }],
        label: '존치구간',
        zoneCode: '',
        sequence: 2,
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        reason: '구조검토 조건 유지',
        releaseCondition: '승인강도 확인',
      }],
    });

    expect(parsed.objects[0]).toMatchObject({
      sequence: 2,
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      reason: '구조검토 조건 유지',
      releaseCondition: '승인강도 확인',
    });
  });

  it('rejects URL-bearing structured attributes before persistence', () => {
    expect(parseDrawingStudioValue({
      schemaVersion: 1,
      objects: [{
        id: 'storage-1',
        kind: 'rectangle',
        layer: 'storage',
        points: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.4 }],
        label: '적치장',
        zoneCode: '',
        materialType: 'https://private.invalid/file?token=secret',
      }],
    })).toEqual({ schemaVersion: 1, objects: [] });
  });
});
