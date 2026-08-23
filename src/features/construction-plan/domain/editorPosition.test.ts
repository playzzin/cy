import type { ConstructionPlan } from '../types';
import {
  readConstructionPlanEditorPosition,
  resolveConstructionPlanEditorCenterScrollTop,
  resolveConstructionPlanEditorMode,
  resolveConstructionPlanEditorSectionId,
  withConstructionPlanEditorModeSearchParams,
  writeConstructionPlanEditorPosition,
} from './editorPosition';

const memoryStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
};

describe('construction plan editor position', () => {
  it('round-trips a user-scoped position and removes corrupt data', () => {
    const storage = memoryStorage();
    writeConstructionPlanEditorPosition({
      planId: 'plan-1',
      userId: 'user-1',
      sectionId: 'drawing-d01',
      drawingWorkspace: true,
      rightTab: 'data',
      mode: 'preview',
      centerScrollTopBySection: { cover: 125.4, 'drawing-d01': 840 },
    }, storage, '2026-08-22T00:00:00.000Z');

    expect(readConstructionPlanEditorPosition('plan-1', 'user-1', storage)).toMatchObject({
      sectionId: 'drawing-d01',
      drawingWorkspace: true,
      mode: 'preview',
      centerScrollTopBySection: { cover: 125, 'drawing-d01': 840 },
    });
    expect(readConstructionPlanEditorPosition('plan-1', 'user-2', storage)).toBeUndefined();

    storage.setItem('cy:construction-plan-editor-position:v1:user-1:plan-1', '{bad-json');
    expect(readConstructionPlanEditorPosition('plan-1', 'user-1', storage)).toBeUndefined();
  });

  it('migrates a legacy position without a mode to edit', () => {
    const storage = memoryStorage();
    storage.setItem('cy:construction-plan-editor-position:v1:user-1:plan-1', JSON.stringify({
      schemaVersion: 1,
      planId: 'plan-1',
      userId: 'user-1',
      sectionId: 'cover',
      drawingWorkspace: false,
      rightTab: 'data',
      updatedAt: '2026-08-22T00:00:00.000Z',
    }));

    const migrated = readConstructionPlanEditorPosition('plan-1', 'user-1', storage);
    expect(migrated?.mode).toBe('edit');
    expect(migrated?.centerScrollTopBySection).toEqual({});
  });

  it('restores section-specific center scroll while sanitizing invalid values', () => {
    const storage = memoryStorage();
    writeConstructionPlanEditorPosition({
      planId: 'plan-1',
      userId: 'user-1',
      sectionId: 'cover',
      drawingWorkspace: false,
      rightTab: 'data',
      mode: 'edit',
      centerScrollTopBySection: {
        cover: 320.6,
        drawing: 915,
        negative: -20,
        infinite: Number.POSITIVE_INFINITY,
      },
    }, storage, '2026-08-22T00:00:00.000Z');

    const position = readConstructionPlanEditorPosition('plan-1', 'user-1', storage);
    expect(position?.centerScrollTopBySection).toEqual({ cover: 321, drawing: 915 });
    expect(resolveConstructionPlanEditorCenterScrollTop(position, 'drawing')).toBe(915);
    expect(resolveConstructionPlanEditorCenterScrollTop(position, 'deep-linked-section')).toBe(0);
  });

  it('prioritizes a drawing deep-link, then a valid persisted section', () => {
    const plan = {
      drawings: [{ id: 'drawing-d01', drawingNo: 'D-01' }],
      sections: [
        { id: 'cover', kind: 'cover', content: {} },
        { id: 'drawing-page', kind: 'drawing-page', content: { drawingId: 'drawing-d01' } },
      ],
    } as unknown as Pick<ConstructionPlan, 'sections' | 'drawings'>;

    const deepLinkedSectionId = resolveConstructionPlanEditorSectionId(plan, {
      drawingId: 'drawing-d01',
      persistedSectionId: 'cover',
    });
    expect(deepLinkedSectionId).toBe('drawing-page');
    expect(resolveConstructionPlanEditorCenterScrollTop({
      centerScrollTopBySection: { cover: 120, 'drawing-page': 760 },
    }, deepLinkedSectionId)).toBe(760);
    expect(resolveConstructionPlanEditorSectionId(plan, { persistedSectionId: 'cover' })).toBe('cover');
    expect(resolveConstructionPlanEditorSectionId(plan, { persistedSectionId: 'removed' })).toBe('cover');
  });

  it('resolves route, lifecycle and user mode intent in fail-safe order', () => {
    expect(resolveConstructionPlanEditorMode({
      planStatus: 'draft',
      requestedMode: 'preview',
      persistedMode: 'edit',
    })).toBe('preview');
    expect(resolveConstructionPlanEditorMode({
      planStatus: 'draft',
      requestedMode: 'preview',
      snapshotDeepLink: true,
    })).toBe('review');
    expect(resolveConstructionPlanEditorMode({
      planStatus: 'issued',
      requestedMode: 'edit',
      persistedMode: 'review',
    })).toBe('review');
    expect(resolveConstructionPlanEditorMode({
      planStatus: 'superseded',
      requestedMode: 'invalid',
      persistedMode: 'edit',
    })).toBe('preview');
  });

  it('writes a canonical mode query while preserving unrelated deep-link state', () => {
    const review = withConstructionPlanEditorModeSearchParams(
      new URLSearchParams('drawingPage=2&mode=edit'),
      'review',
    );
    expect(review.get('mode')).toBe('review');
    expect(review.get('tab')).toBe('review');
    expect(review.get('drawingPage')).toBe('2');

    const preview = withConstructionPlanEditorModeSearchParams(review, 'preview');
    expect(preview.get('mode')).toBe('preview');
    expect(preview.has('tab')).toBe(false);
    expect(preview.get('drawingPage')).toBe('2');
  });
});
