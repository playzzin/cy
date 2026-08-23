import type {
  ConstructionPlanTemplateManifest,
  ConstructionPlanTradeType,
} from '../types';
import {
  SYSTEM_SCAFFOLD_TEMPLATE_MANIFEST,
  SYSTEM_SHORING_TEMPLATE_MANIFEST,
} from './templateManifest';

export type ConstructionPlanTemplateLifecycle = 'published' | 'deprecated' | 'retired';
export type ConstructionPlanServerDraftCapability = 'supported' | 'unsupported';

export type ConstructionPlanTemplateRegistryEntry = {
  key: string;
  manifest: ConstructionPlanTemplateManifest;
  lifecycle: ConstructionPlanTemplateLifecycle;
  isLatest: boolean;
  serverDraftCapability: ConstructionPlanServerDraftCapability;
  serverDraftUnavailableReason?: string;
};

export const constructionPlanTemplateKey = (
  manifest: Pick<ConstructionPlanTemplateManifest, 'tradeType' | 'id' | 'version'>,
): string => `${manifest.tradeType}:${manifest.id}@${manifest.version}`;

const registryEntries: ConstructionPlanTemplateRegistryEntry[] = [
  {
    key: constructionPlanTemplateKey(SYSTEM_SHORING_TEMPLATE_MANIFEST),
    manifest: SYSTEM_SHORING_TEMPLATE_MANIFEST,
    lifecycle: 'published',
    isLatest: true,
    serverDraftCapability: 'supported',
  },
  {
    key: constructionPlanTemplateKey(SYSTEM_SCAFFOLD_TEMPLATE_MANIFEST),
    manifest: SYSTEM_SCAFFOLD_TEMPLATE_MANIFEST,
    lifecycle: 'published',
    isLatest: true,
    serverDraftCapability: 'supported',
  },
];

const assertRegistryIntegrity = (entries: readonly ConstructionPlanTemplateRegistryEntry[]): void => {
  const keys = new Set<string>();
  const latestByTrade = new Set<ConstructionPlanTradeType>();

  entries.forEach((entry) => {
    const expectedKey = constructionPlanTemplateKey(entry.manifest);
    if (entry.key !== expectedKey || keys.has(entry.key)) {
      throw new Error(`construction-plan-template-registry-duplicate:${entry.key}`);
    }
    keys.add(entry.key);

    if (entry.isLatest) {
      if (entry.lifecycle !== 'published' || latestByTrade.has(entry.manifest.tradeType)) {
        throw new Error(`construction-plan-template-registry-latest-invalid:${entry.key}`);
      }
      latestByTrade.add(entry.manifest.tradeType);
    }

    if (entry.serverDraftCapability === 'unsupported'
      && !entry.serverDraftUnavailableReason?.trim()) {
      throw new Error(`construction-plan-template-registry-capability-reason-required:${entry.key}`);
    }
  });

  (['system-shoring', 'system-scaffold'] as const).forEach((tradeType) => {
    if (!latestByTrade.has(tradeType)) {
      throw new Error(`construction-plan-template-registry-latest-missing:${tradeType}`);
    }
  });
};

assertRegistryIntegrity(registryEntries);

export const CONSTRUCTION_PLAN_TRADE_LABELS: Readonly<Record<ConstructionPlanTradeType, string>> = {
  'system-shoring': '시스템동바리',
  'system-scaffold': '시스템비계',
};

export const CONSTRUCTION_PLAN_TEMPLATE_REGISTRY: readonly ConstructionPlanTemplateRegistryEntry[] =
  Object.freeze(registryEntries.map((entry) => Object.freeze({ ...entry })));

export const listConstructionPlanTemplates = (
  tradeType?: ConstructionPlanTradeType,
): readonly ConstructionPlanTemplateRegistryEntry[] => {
  const matches = tradeType
    ? CONSTRUCTION_PLAN_TEMPLATE_REGISTRY.filter((entry) => entry.manifest.tradeType === tradeType)
    : [...CONSTRUCTION_PLAN_TEMPLATE_REGISTRY];
  return matches.sort((left, right) => right.manifest.version.localeCompare(
    left.manifest.version,
    undefined,
    { numeric: true, sensitivity: 'base' },
  ));
};

export const getConstructionPlanTemplate = (
  key: string,
): ConstructionPlanTemplateRegistryEntry | undefined =>
  CONSTRUCTION_PLAN_TEMPLATE_REGISTRY.find((entry) => entry.key === key);

export const getConstructionPlanTemplateByIdentity = (identity: {
  tradeType: ConstructionPlanTradeType;
  templateId: string;
  templateVersion: string;
}): ConstructionPlanTemplateRegistryEntry | undefined => getConstructionPlanTemplate(
  constructionPlanTemplateKey({
    tradeType: identity.tradeType,
    id: identity.templateId,
    version: identity.templateVersion,
  }),
);

export const requireConstructionPlanTemplateByIdentity = (identity: {
  tradeType: ConstructionPlanTradeType;
  templateId: string;
  templateVersion: string;
}): ConstructionPlanTemplateRegistryEntry => {
  const entry = getConstructionPlanTemplateByIdentity(identity);
  if (!entry) {
    throw new Error(
      `construction-plan-template-registry-identity-missing:${identity.tradeType}:${identity.templateId}@${identity.templateVersion}`,
    );
  }
  return entry;
};

export const getLatestConstructionPlanTemplate = (
  tradeType: ConstructionPlanTradeType,
): ConstructionPlanTemplateRegistryEntry => {
  const latest = CONSTRUCTION_PLAN_TEMPLATE_REGISTRY.find((entry) => (
    entry.manifest.tradeType === tradeType
    && entry.lifecycle === 'published'
    && entry.isLatest
  ));
  if (!latest) {
    throw new Error(`construction-plan-template-registry-latest-missing:${tradeType}`);
  }
  return latest;
};

export type ServerDraftCompatibleConstructionPlanTemplate =
  ConstructionPlanTemplateRegistryEntry & {
    serverDraftCapability: 'supported';
  };

export const isServerDraftCompatibleConstructionPlanTemplate = (
  entry: ConstructionPlanTemplateRegistryEntry,
): entry is ServerDraftCompatibleConstructionPlanTemplate => (
  entry.serverDraftCapability === 'supported'
);
