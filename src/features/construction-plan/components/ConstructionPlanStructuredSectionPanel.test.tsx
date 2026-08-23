import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PlanSection, SafeWorkerDto } from '../types';
import ConstructionPlanStructuredSectionPanel from './ConstructionPlanStructuredSectionPanel';

const section = (content: Record<string, unknown> = {}, status: PlanSection['status'] = 'in_progress'): PlanSection => ({
  id: 'material-plan',
  key: 'material-plan',
  title: '자재 반입 및 보관계획',
  kind: 'structured-form',
  order: 7,
  pageNumbers: [8],
  required: true,
  status,
  content,
  placeholders: [],
  containsExampleValues: false,
  standardTextModified: false,
});

const workers: SafeWorkerDto[] = [{ id: 'worker-1', name: '현장 작업자', role: '자재담당', status: 'active' }];

describe('ConstructionPlanStructuredSectionPanel', () => {
  it('adds typed rows without deleting legacy section content', () => {
    const onChange = jest.fn();
    render(
      <ConstructionPlanStructuredSectionPanel
        section={section({ scope: '101동 A구간', body: '기존 자유서술 원문' })}
        zones={['A구간']}
        workers={workers}
        onChange={onChange}
      />,
    );

    expect(screen.getByText('기존 자유서술 기록 2건')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '자재 추가' }));

    const next = onChange.mock.calls[0][0] as PlanSection;
    expect(next.content).toMatchObject({
      scope: '101동 A구간',
      body: '기존 자유서술 원문',
      structuredDataVersion: 1,
    });
    expect(next.content.materials).toEqual([expect.objectContaining({ id: expect.any(String), materialName: '' })]);
  });

  it('shows exact missing structured fields when a section is falsely marked complete', () => {
    render(
      <ConstructionPlanStructuredSectionPanel
        section={section({}, 'complete')}
        zones={['A구간']}
        workers={workers}
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('완료 상태이지만 필수 데이터가 누락되었습니다.');
    expect(screen.getByRole('alert')).toHaveTextContent('자재계획');
  });

  it('uses ERP site zones and active workers as selectable structured values', () => {
    const onChange = jest.fn();
    render(
      <ConstructionPlanStructuredSectionPanel
        section={section()}
        zones={['A구간', 'B구간']}
        workers={[...workers, { id: 'inactive-1', name: '비활성 작업자', status: 'inactive' }]}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('checkbox', { name: 'A구간' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /현장 작업자/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /비활성 작업자/ })).not.toBeInTheDocument();
  });

  it('renders the independent scaffold p31 and p33 contracts as structured forms', () => {
    const platformSection: PlanSection = {
      ...section(),
      id: 'work-platform-access-plan',
      key: 'work-platform-access-plan',
      title: '작업발판·승강통로 계획',
      pageNumbers: [31],
    };
    const { rerender } = render(
      <ConstructionPlanStructuredSectionPanel
        section={platformSection}
        zones={['A구간']}
        workers={workers}
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByText(/비계 작업발판의 유효폭/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /작업발판 유효폭/ })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /승강통로 형식/ })).toBeInTheDocument();

    rerender(
      <ConstructionPlanStructuredSectionPanel
        section={{
          ...platformSection,
          id: 'inspection-maintenance-plan',
          key: 'inspection-maintenance-plan',
          title: '사용 중 점검·보수 및 변경관리',
          pageNumbers: [33],
        }}
        zones={['A구간']}
        workers={workers}
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByText(/시스템비계 사용 중 점검주기/)).toBeInTheDocument();
    expect(screen.getByLabelText('벽이음 점검항목')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /점검기록 보존방법/ })).toBeInTheDocument();
  });

  it('creates a Hold Point with an explicit plan decision contract rather than inheriting approval', () => {
    const onChange = jest.fn();
    const qualitySection: PlanSection = {
      ...section(),
      id: 'quality-plan',
      key: 'quality-plan',
      title: '품질관리 계획',
      pageNumbers: [34],
    };
    render(
      <ConstructionPlanStructuredSectionPanel
        section={qualitySection}
        zones={['A구간']}
        workers={workers}
        onChange={onChange}
      />,
    );

    expect(screen.getByText(/문서 승인이나 실제 시공결과에서 자동 합격 처리되지 않습니다/)).toBeInTheDocument();
    expect(screen.getByText(/반려는 검토·발행을 차단/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hold Point 추가' }));
    const next = onChange.mock.calls[0][0] as PlanSection;
    expect(next.content.holdPoints).toEqual([expect.objectContaining({
      responsibleRole: '',
      completionCondition: '',
      decisionStatus: 'pending',
      decisionAt: '',
      decisionComment: '',
    })]);
    expect((next.content.holdPoints as Array<Record<string, unknown>>)[0]).not.toHaveProperty('approverRole');
  });

  it('marks a structured collection and each row index for exact validation focus', () => {
    const qualitySection: PlanSection = {
      ...section({
        holdPoints: [
          { id: 'hold-point-0', stage: '설치', evidence: '검측표', responsibleRole: '품질관리자', completionCondition: '1차 조건', decisionStatus: 'pending', decisionAt: '', decisionComment: '' },
          { id: 'hold-point-1', stage: '타설', evidence: '승인서', responsibleRole: '현장책임자', completionCondition: '2차 조건', decisionStatus: 'pending', decisionAt: '', decisionComment: '' },
        ],
      }),
      id: 'quality-plan',
      key: 'quality-plan',
      title: '품질관리 계획',
    };
    const { container } = render(
      <ConstructionPlanStructuredSectionPanel
        section={qualitySection}
        zones={['A구간']}
        workers={workers}
        onChange={jest.fn()}
      />,
    );

    const collection = container.querySelector('[data-validation-collection="holdPoints"]');
    expect(collection).toBeInTheDocument();
    const secondRow = collection?.querySelector('[data-validation-row-index="1"]');
    expect(secondRow).toHaveAttribute('data-validation-record-id', 'hold-point-1');
    expect(secondRow?.querySelector('[data-validation-field="completionCondition"] input')).toHaveValue('2차 조건');
  });
});
