import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import ConstructionPlanImmediateSaveBoundary from './ConstructionPlanImmediateSaveBoundary';

describe('ConstructionPlanImmediateSaveBoundary', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it.each([
    ['textbox', <input aria-label="기술 입력" key="input" />],
    ['textarea', <textarea aria-label="안전 대책" key="textarea" />],
    ['combobox', <select aria-label="담당 작업자" key="select"><option>선택</option></select>],
  ])('flushes pending plan changes when a %s field loses focus', (_label, control) => {
    const onImmediateSave = jest.fn();
    render(
      <ConstructionPlanImmediateSaveBoundary enabled onImmediateSave={onImmediateSave}>
        {control}
      </ConstructionPlanImmediateSaveBoundary>,
    );

    fireEvent.blur(screen.getByLabelText(/기술 입력|안전 대책|담당 작업자/));
    expect(onImmediateSave).not.toHaveBeenCalled();
    jest.runOnlyPendingTimers();
    expect(onImmediateSave).toHaveBeenCalledTimes(1);
  });

  it('does not save review-panel inputs or read-only controls', () => {
    const onImmediateSave = jest.fn();
    const { rerender } = render(
      <ConstructionPlanImmediateSaveBoundary enabled={false} onImmediateSave={onImmediateSave}>
        <textarea aria-label="검토 댓글" />
      </ConstructionPlanImmediateSaveBoundary>,
    );
    fireEvent.blur(screen.getByLabelText('검토 댓글'));
    jest.runOnlyPendingTimers();
    expect(onImmediateSave).not.toHaveBeenCalled();

    rerender(
      <ConstructionPlanImmediateSaveBoundary enabled onImmediateSave={onImmediateSave}>
        <input aria-label="읽기전용 값" readOnly />
      </ConstructionPlanImmediateSaveBoundary>,
    );
    fireEvent.blur(screen.getByLabelText('읽기전용 값'));
    jest.runOnlyPendingTimers();
    expect(onImmediateSave).not.toHaveBeenCalled();
  });
});
