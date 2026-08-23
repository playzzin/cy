import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { OrganizationSnapshot, SafeWorkerDto } from '../types';
import ConstructionPlanOrganizationEditor from './ConstructionPlanOrganizationEditor';

const worker = (id: string, name: string, siteId?: string): SafeWorkerDto => ({
  id,
  name,
  siteId,
  status: 'active',
  teamName: '시공팀',
});

const snapshot = (workers: Array<SafeWorkerDto | undefined>): OrganizationSnapshot => ({
  capturedAt: '2026-08-22T00:00:00.000Z',
  sourceSiteId: 'site-1',
  assignments: workers.map((assignedWorker, index) => ({
    id: `assignment-${index + 1}`,
    role: index === 0 ? 'site_manager' : 'safety_manager',
    label: index === 0 ? '현장책임자' : '안전담당',
    required: true,
    worker: assignedWorker,
    responsibilities: [],
    order: index,
    externalAssignment: false,
  })),
  additionalWorkers: [],
});

describe('ConstructionPlanOrganizationEditor exception assignments', () => {
  it('requires an independent reason field for every role held by the same worker', () => {
    const sharedWorker = worker('worker-shared', '김겸임', 'site-1');
    const onChange = jest.fn();
    render(
      <ConstructionPlanOrganizationEditor
        value={snapshot([sharedWorker, sharedWorker])}
        candidates={[sharedWorker]}
        onChange={onChange}
      />,
    );

    expect(screen.getAllByText('겸임')).toHaveLength(2);
    const reasons = screen.getAllByPlaceholderText('승인 가능한 구체적인 배정 사유를 5자 이상 입력하세요.');
    expect(reasons).toHaveLength(2);
    expect(reasons[0]).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(reasons[0], { target: { value: '현장책임자와 장비담당을 한시적으로 겸임' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      assignments: expect.arrayContaining([
        expect.objectContaining({
          id: 'assignment-1',
          exceptionReason: '현장책임자와 장비담당을 한시적으로 겸임',
        }),
      ]),
    }));
  });

  it('marks only an explicitly different source-site worker as external', () => {
    const external = worker('worker-external', '이외부', 'site-2');
    const legacy = worker('worker-legacy', '박레거시');
    const onChange = jest.fn();
    const { rerender } = render(
      <ConstructionPlanOrganizationEditor
        value={snapshot([undefined])}
        candidates={[external, legacy]}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText(/현장책임자/), { target: { value: external.id } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      assignments: [expect.objectContaining({
        worker: external,
        externalAssignment: true,
      })],
    }));

    onChange.mockClear();
    rerender(
      <ConstructionPlanOrganizationEditor
        value={snapshot([undefined])}
        candidates={[external, legacy]}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText(/현장책임자/), { target: { value: legacy.id } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      assignments: [expect.objectContaining({
        worker: legacy,
        externalAssignment: false,
      })],
    }));
  });
});
