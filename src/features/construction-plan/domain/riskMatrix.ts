import type {
  ConstructionPlanRiskAssessmentPolicy,
  RiskAssessmentItem,
} from '../types';

export type RiskMatrixLevel = RiskAssessmentItem['initialRiskLevel'];

export const riskScore = (
  probability: number | undefined,
  severity: number | undefined,
  policy: ConstructionPlanRiskAssessmentPolicy,
): number | undefined => {
  if (!Number.isInteger(probability) || !Number.isInteger(severity)) return undefined;
  if ((probability ?? 0) < policy.probabilityMin
    || (probability ?? 0) > policy.probabilityMax
    || (severity ?? 0) < policy.severityMin
    || (severity ?? 0) > policy.severityMax) {
    return undefined;
  }
  return Number(probability) * Number(severity);
};

export const riskLevelFromScore = (
  score: number,
  policy: ConstructionPlanRiskAssessmentPolicy,
): RiskMatrixLevel => {
  const match = policy.thresholds.find((threshold) => (
    score >= threshold.minScore && score <= threshold.maxScore
  ));
  if (!match) throw new Error(`construction-plan-risk-score-out-of-template-range:${score}`);
  return match.level;
};

export const riskLevelLabel = (
  level: RiskMatrixLevel,
  policy: ConstructionPlanRiskAssessmentPolicy,
): string => policy.thresholds.find((threshold) => threshold.level === level)?.label ?? level;

export const riskPairForLevel = (
  level: RiskMatrixLevel,
  policy: ConstructionPlanRiskAssessmentPolicy,
): [number, number] => {
  const threshold = policy.thresholds.find((candidate) => candidate.level === level);
  if (!threshold) throw new Error(`construction-plan-risk-level-not-in-template:${level}`);
  const candidates: Array<[number, number]> = [];
  for (let probability = policy.probabilityMin; probability <= policy.probabilityMax; probability += 1) {
    for (let severity = policy.severityMin; severity <= policy.severityMax; severity += 1) {
      const score = probability * severity;
      if (score >= threshold.minScore && score <= threshold.maxScore) {
        candidates.push([probability, severity]);
      }
    }
  }
  const pair = candidates.sort((left, right) => {
    const leftScore = left[0] * left[1];
    const rightScore = right[0] * right[1];
    return rightScore - leftScore || Math.abs(left[0] - left[1]) - Math.abs(right[0] - right[1]);
  })[0];
  if (!pair) throw new Error(`construction-plan-risk-level-has-no-matrix-pair:${level}`);
  return pair;
};

export const riskIsAcceptable = (
  residualScore: number | undefined,
  residualLevel: RiskMatrixLevel | undefined,
  policy: ConstructionPlanRiskAssessmentPolicy,
): boolean => Boolean(
  residualScore
  && residualLevel
  && residualScore <= policy.acceptance.maxResidualScore
  && !policy.acceptance.blockedResidualLevels.includes(residualLevel),
);

export const quantitativeRiskPatch = (
  probability: number | undefined,
  severity: number | undefined,
  phase: 'initial' | 'residual',
  policy: ConstructionPlanRiskAssessmentPolicy,
): Partial<RiskAssessmentItem> => {
  const score = riskScore(probability, severity, policy);
  if (phase === 'initial') {
    return {
      assessmentMethodVersion: policy.methodVersion,
      methodReference: policy.methodReference,
      initialProbability: probability,
      initialSeverity: severity,
      ...(score ? { initialRiskLevel: riskLevelFromScore(score, policy) } : {}),
      verifiedBy: undefined,
    };
  }
  return {
    assessmentMethodVersion: policy.methodVersion,
    methodReference: policy.methodReference,
    residualProbability: probability,
    residualSeverity: severity,
    residualRiskLevel: score ? riskLevelFromScore(score, policy) : undefined,
    verifiedBy: undefined,
  };
};
