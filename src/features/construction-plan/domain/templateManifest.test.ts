import {
  createDefaultPlanSections,
  getTemplatePagesForSection,
  SYSTEM_SCAFFOLD_TEMPLATE_MANIFEST,
  SYSTEM_SHORING_TEMPLATE_MANIFEST,
} from './templateManifest';
import { ConstructionPlanTemplateManifestSchema } from '../types';

describe('system shoring template manifest', () => {
  it('locks the REV.5 reference structure to 42 ordered A4 pages', () => {
    const manifest = SYSTEM_SHORING_TEMPLATE_MANIFEST;

    expect(manifest.pages).toHaveLength(42);
    expect(manifest.pages.map((page) => page.pageNumber)).toEqual(
      Array.from({ length: 42 }, (_, index) => index + 1),
    );
    expect(manifest.pageSize).toEqual({
      name: 'A4',
      widthPt: 595.28,
      heightPt: 841.89,
      orientation: 'portrait',
    });
    expect(manifest.sourceReference).toEqual(expect.objectContaining({
      revision: 'REV.5',
      pageCount: 42,
    }));
    expect(manifest.rendererVersion).toBe('field-use-a4-v3');
    expect(manifest.riskAssessmentPolicy).toEqual(expect.objectContaining({
      methodVersion: 2,
      formula: 'probability * severity',
      acceptance: expect.objectContaining({ maxResidualScore: 9, requireResidualReduction: true }),
    }));
    expect(manifest.riskAssessmentPolicy.thresholds).toHaveLength(4);
    expect(Object.isFrozen(manifest)).toBe(true);
    expect(Object.isFrozen(manifest.riskAssessmentPolicy)).toBe(true);
    expect(Object.isFrozen(manifest.riskAssessmentPolicy.thresholds)).toBe(true);
  });

  it('covers every D-01 through D-06 applicability slot', () => {
    const slots = new Set(
      SYSTEM_SHORING_TEMPLATE_MANIFEST.pages.flatMap((page) => page.drawingSlots),
    );

    expect(Array.from(slots).sort()).toEqual(['D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06']);
  });

  it('rejects a template risk policy with threshold gaps or duplicate triggers', () => {
    const gap = JSON.parse(JSON.stringify(SYSTEM_SHORING_TEMPLATE_MANIFEST));
    gap.riskAssessmentPolicy.thresholds[1].minScore = 6;
    expect(ConstructionPlanTemplateManifestSchema.safeParse(gap).success).toBe(false);
    const duplicateTrigger = JSON.parse(JSON.stringify(SYSTEM_SHORING_TEMPLATE_MANIFEST));
    duplicateTrigger.riskAssessmentPolicy.reviewTriggers.push(duplicateTrigger.riskAssessmentPolicy.reviewTriggers[0]);
    expect(ConstructionPlanTemplateManifestSchema.safeParse(duplicateTrigger).success).toBe(false);
  });

  it('aggregates the two generated toc pages into one editable-domain section', () => {
    const sections = createDefaultPlanSections();
    const toc = sections.find((section) => section.key === 'toc');

    expect(getTemplatePagesForSection('toc')).toHaveLength(2);
    expect(toc).toEqual(expect.objectContaining({
      pageNumbers: [3, 4],
      status: 'complete',
    }));
    expect(new Set(sections.map((section) => section.id)).size).toBe(sections.length);
  });

  it('builds scaffold sections from the selected manifest without shoring-only section keys', () => {
    const sections = createDefaultPlanSections(SYSTEM_SCAFFOLD_TEMPLATE_MANIFEST);
    const wallTieDetailPage = SYSTEM_SCAFFOLD_TEMPLATE_MANIFEST.pages[20];

    expect(sections.some((section) => section.key === 'base-standard-assembly')).toBe(true);
    expect(sections.some((section) => section.key === 'work-platform-access-plan')).toBe(true);
    expect(sections.some((section) => section.key === 'post-ledger-assembly')).toBe(false);
    expect(wallTieDetailPage).toEqual(expect.objectContaining({
      pageNumber: 21,
      sectionKey: 'wall-tie-anchorage',
      drawingSlot: 'D-04',
      drawingSlots: ['D-04'],
    }));
    expect(getTemplatePagesForSection(
      'scaffold-daily-log',
      SYSTEM_SCAFFOLD_TEMPLATE_MANIFEST,
    )).toEqual([expect.objectContaining({ pageNumber: 40 })]);
  });
});
