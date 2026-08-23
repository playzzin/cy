import {
  CONSTRUCTION_PLAN_TEMPLATE_REGISTRY,
  constructionPlanTemplateKey,
  getConstructionPlanTemplate,
  getConstructionPlanTemplateByIdentity,
  getLatestConstructionPlanTemplate,
  isServerDraftCompatibleConstructionPlanTemplate,
  listConstructionPlanTemplates,
  requireConstructionPlanTemplateByIdentity,
} from './templateRegistry';

describe('construction plan template registry', () => {
  it('registers one latest 42-page A4 standard for each supported trade type', () => {
    const shoring = getLatestConstructionPlanTemplate('system-shoring');
    const scaffold = getLatestConstructionPlanTemplate('system-scaffold');

    expect(shoring.manifest.pages).toHaveLength(42);
    expect(scaffold.manifest.pages).toHaveLength(42);
    expect(scaffold.manifest.pages[14]).toEqual(expect.objectContaining({
      pageNumber: 15,
      title: '시스템비계 개요',
    }));
    expect(scaffold.manifest.pages[30]).toEqual(expect.objectContaining({
      pageNumber: 31,
      sectionKey: 'work-platform-access-plan',
    }));
  });

  it('uses an immutable trade/id/version identity without duplicate entries', () => {
    const keys = CONSTRUCTION_PLAN_TEMPLATE_REGISTRY.map((entry) => entry.key);

    expect(new Set(keys).size).toBe(keys.length);
    CONSTRUCTION_PLAN_TEMPLATE_REGISTRY.forEach((entry) => {
      expect(entry.key).toBe(constructionPlanTemplateKey(entry.manifest));
      expect(getConstructionPlanTemplate(entry.key)).toBe(entry);
    });
    expect(listConstructionPlanTemplates('system-shoring')).toHaveLength(1);
    expect(listConstructionPlanTemplates('system-scaffold')).toHaveLength(1);
    expect(getConstructionPlanTemplateByIdentity({
      tradeType: 'system-scaffold',
      templateId: 'system-scaffold-standard',
      templateVersion: '1.0.0',
    })?.manifest.tradeType).toBe('system-scaffold');
    expect(getConstructionPlanTemplateByIdentity({
      tradeType: 'system-shoring',
      templateId: 'system-scaffold-standard',
      templateVersion: '1.0.0',
    })).toBeUndefined();
    expect(() => requireConstructionPlanTemplateByIdentity({
      tradeType: 'system-scaffold',
      templateId: 'system-scaffold-standard',
      templateVersion: '0.9.0',
    })).toThrow(/template-registry-identity-missing/);
  });

  it('enables the exact published server draft contract for both trades', () => {
    expect(isServerDraftCompatibleConstructionPlanTemplate(
      getLatestConstructionPlanTemplate('system-shoring'),
    )).toBe(true);
    expect(isServerDraftCompatibleConstructionPlanTemplate(
      getLatestConstructionPlanTemplate('system-scaffold'),
    )).toBe(true);
  });
});
