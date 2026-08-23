import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { EquipmentPlanItem, SafeWorkerDto, VerifiedEngineeringValue } from '../types';
import {
  ConstructionPlanEngineeringPanel,
  ConstructionPlanEquipmentPanel,
} from './ConstructionPlanTechnicalDataPanel';

const transport: EquipmentPlanItem = {
  id: 'transport-1',
  category: 'transport',
  equipmentName: '지게차',
  model: 'FL-3',
  workZones: ['A구간'],
  plannedStages: ['자재반입'],
  controlMeasures: ['유도자 배치'],
};
const workers: SafeWorkerDto[] = [{ id: 'worker-1', name: '운전 작업자', status: 'active' }];

describe('ConstructionPlanEquipmentPanel', () => {
  it('renders non-lifting equipment instead of filtering it out', () => {
    render(<ConstructionPlanEquipmentPanel items={[transport]} zones={['A구간']} workers={workers} onChange={jest.fn()} />);

    expect(screen.getByDisplayValue('지게차')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '운반장비' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('자재반입')).toBeInTheDocument();
  });

  it('edits planned stages and control measures as reusable arrays', () => {
    const onChange = jest.fn();
    render(<ConstructionPlanEquipmentPanel items={[transport]} zones={['A구간']} workers={workers} onChange={onChange} />);

    fireEvent.change(screen.getByRole('textbox', { name: /예정 작업단계/ }), { target: { value: '자재반입, 설치' } });
    expect(onChange.mock.calls[0][0][0].plannedStages).toEqual(['자재반입', '설치']);

    fireEvent.change(screen.getByRole('textbox', { name: /장비 통제대책/ }), { target: { value: '유도자 배치\n보행동선 분리' } });
    expect(onChange.mock.calls[1][0][0].controlMeasures).toEqual(['유도자 배치', '보행동선 분리']);
  });

  it('allows every planned equipment category to be selected', () => {
    const onChange = jest.fn();
    render(<ConstructionPlanEquipmentPanel items={[transport]} zones={['A구간']} workers={workers} onChange={onChange} />);

    fireEvent.change(screen.getByRole('combobox', { name: /장비 분류/ }), { target: { value: 'measurement' } });

    expect(onChange.mock.calls[0][0][0].category).toBe('measurement');
    expect(screen.getByRole('option', { name: '양중장비' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '고소작업장비' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '조립·체결장비' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '측정·검측장비' })).toBeInTheDocument();
  });

  it('marks the equipment record and every editable field for exact validation focus', () => {
    const { container } = render(
      <ConstructionPlanEquipmentPanel items={[transport]} zones={['A구간']} workers={workers} onChange={jest.fn()} />,
    );

    expect(container.querySelector('[data-validation-record-id="equipmentPlan"]')).toBeInTheDocument();
    expect(container.querySelector('[data-validation-record-id="transport-1"]')).toBeInTheDocument();
    [
      'category', 'equipmentName', 'model', 'registrationNo', 'ratedCapacity', 'workRadius',
      'inspectionValidUntil', 'workZones', 'plannedStages', 'controlMeasures',
      'operatorWorkerId', 'signalerWorkerId',
    ].forEach((field) => {
      expect(container.querySelector(`[data-validation-record-id="transport-1"] [data-validation-field="${field}"]`)).toBeInTheDocument();
    });
  });
});

describe('ConstructionPlanEngineeringPanel', () => {
  const engineeringValue: VerifiedEngineeringValue = {
    key: '지주 설치간격',
    value: '1200',
    unit: 'mm',
    sourceDocumentId: 'STR-001',
    sourceRevision: 'Rev.2',
    sourcePageOrSection: '12쪽',
    applicableZones: ['A구간'],
    verificationStatus: 'reviewed',
    verifiedBy: '공사담당자',
    verifiedAt: '2026-08-22T00:00:00.000Z',
  };

  it('marks the engineering record and every editable field for exact validation focus', () => {
    const { container } = render(
      <ConstructionPlanEngineeringPanel
        values={[engineeringValue]}
        zones={['A구간']}
        reviewerName="공사담당자"
        onChange={jest.fn()}
      />,
    );

    expect(container.querySelector('[data-validation-record-id="engineeringValues"]')).toBeInTheDocument();
    expect(container.querySelector('[data-validation-record-id="지주 설치간격"]')).toBeInTheDocument();
    [
      'key', 'value', 'unit', 'sourceDocumentId', 'sourceRevision',
      'sourcePageOrSection', 'applicableZones', 'verificationStatus',
    ].forEach((field) => {
      expect(container.querySelector(`[data-validation-record-id="지주 설치간격"] [data-validation-field="${field}"]`)).toBeInTheDocument();
    });
  });
});
