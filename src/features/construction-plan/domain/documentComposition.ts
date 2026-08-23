import type { ConstructionPlanTemplateManifest } from '../types';

/**
 * Every composed plan keeps these document-control sections. The remaining
 * table-of-contents entries are selected per site and stored on the plan.
 */
export const CONSTRUCTION_PLAN_CORE_SECTION_KEYS = [
  'cover',
  'document-control',
  'toc',
  'project-overview',
] as const;

const coreSectionKeySet = new Set<string>(CONSTRUCTION_PLAN_CORE_SECTION_KEYS);

export const isConstructionPlanCoreSection = (sectionKey: string): boolean =>
  coreSectionKeySet.has(sectionKey);

export const constructionPlanManifestSectionKeys = (
  manifest: ConstructionPlanTemplateManifest,
): string[] => Array.from(new Set(manifest.pages.map((page) => page.sectionKey)));

/**
 * Returns unique, manifest-ordered section keys. An absent selection is the
 * legacy/full-template mode, while an explicit selection must retain all core
 * sections.
 */
export const normalizeConstructionPlanSelectedSectionKeys = (
  manifest: ConstructionPlanTemplateManifest,
  selectedSectionKeys?: readonly string[],
): string[] => {
  const manifestKeys = constructionPlanManifestSectionKeys(manifest);
  if (!selectedSectionKeys) return manifestKeys;
  const selected = new Set(selectedSectionKeys);
  CONSTRUCTION_PLAN_CORE_SECTION_KEYS.forEach((key) => selected.add(key));
  return manifestKeys.filter((key) => selected.has(key));
};

export const constructionPlanSelectedPageCount = (
  manifest: ConstructionPlanTemplateManifest,
  selectedSectionKeys?: readonly string[],
): number => {
  const selected = new Set(normalizeConstructionPlanSelectedSectionKeys(manifest, selectedSectionKeys));
  return manifest.pages.filter((page) => selected.has(page.sectionKey)).length;
};
