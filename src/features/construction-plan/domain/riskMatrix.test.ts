import {
  quantitativeRiskPatch,
  riskLevelFromScore,
  riskScore,
} from './riskMatrix';
import { SYSTEM_SHORING_TEMPLATE_MANIFEST } from './templateManifest';

const policy = SYSTEM_SHORING_TEMPLATE_MANIFEST.riskAssessmentPolicy;

describe('construction plan risk matrix', () => {
  it('calculates the 5x5 matrix using documented thresholds', () => {
    expect(riskScore(1, 4, policy)).toBe(4);
    expect(riskLevelFromScore(4, policy)).toBe('low');
    expect(riskLevelFromScore(5, policy)).toBe('medium');
    expect(riskLevelFromScore(10, policy)).toBe('high');
    expect(riskLevelFromScore(17, policy)).toBe('critical');
    expect(riskScore(0, 5, policy)).toBeUndefined();
  });

  it('invalidates a previous verification when the residual score changes', () => {
    expect(quantitativeRiskPatch(2, 3, 'residual', policy)).toEqual({
      assessmentMethodVersion: 2,
      methodReference: policy.methodReference,
      residualProbability: 2,
      residualSeverity: 3,
      residualRiskLevel: 'medium',
      verifiedBy: undefined,
    });
  });

  it('uses the exact selected template policy instead of a global threshold', () => {
    const modifiedPolicy = {
      ...policy,
      thresholds: policy.thresholds.map((threshold) => ({ ...threshold })),
    };
    modifiedPolicy.thresholds[0] = { ...modifiedPolicy.thresholds[0], maxScore: 3 };
    modifiedPolicy.thresholds[1] = { ...modifiedPolicy.thresholds[1], minScore: 4 };
    expect(riskLevelFromScore(4, modifiedPolicy)).toBe('medium');
    expect(riskLevelFromScore(4, policy)).toBe('low');
  });
});
