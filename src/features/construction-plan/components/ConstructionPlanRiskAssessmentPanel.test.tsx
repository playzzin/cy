import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ConstructionPlanRiskAssessmentPanel from './ConstructionPlanRiskAssessmentPanel';
import { SYSTEM_SHORING_TEMPLATE_MANIFEST } from '../domain/templateManifest';

const policy = SYSTEM_SHORING_TEMPLATE_MANIFEST.riskAssessmentPolicy;

describe('ConstructionPlanRiskAssessmentPanel', () => {
  it('creates a v2 quantitative risk row instead of a manually selected label', () => {
    const onChange = jest.fn();
    render(<ConstructionPlanRiskAssessmentPanel
      items={[]}
      workers={[]}
      reviewerName="검토자"
      policy={policy}
      onChange={onChange}
    />);

    fireEvent.click(screen.getByRole('button', { name: /첫 위험요인 추가/ }));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        assessmentMethodVersion: 2,
        initialProbability: 4,
        initialSeverity: 4,
        initialRiskLevel: 'high',
        methodReference: expect.stringContaining('5×5'),
      }),
    ]);
  });

  it('recalculates a residual level and clears the old verifier when a score changes', () => {
    const onChange = jest.fn();
    render(<ConstructionPlanRiskAssessmentPanel
      items={[{
        id: 'risk-1',
        assessmentMethodVersion: 2,
        workStage: '설치',
        hazard: '추락',
        initialProbability: 4,
        initialSeverity: 4,
        initialRiskLevel: 'high',
        mitigationMeasures: ['안전대'],
        residualProbability: 2,
        residualSeverity: 2,
        residualRiskLevel: 'low',
        methodReference: '5×5 기준',
        reviewTrigger: '공법 변경 시',
        verifiedBy: '기존 검토자',
      }]}
      workers={[]}
      reviewerName="검토자"
      policy={policy}
      onChange={onChange}
    />);

    fireEvent.change(screen.getByLabelText('저감 후 가능성 (1~5) *'), { target: { value: '3' } });
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        residualProbability: 3,
        residualSeverity: 2,
        residualRiskLevel: 'medium',
        verifiedBy: undefined,
      }),
    ]);
  });
});
