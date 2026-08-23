import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { PlanSectionNavigator } from './PlanSectionNavigator';
import type { PlanSection } from '../types';

const sections = [
  {
    id: 'cover',
    key: 'cover',
    title: '표지',
    kind: 'cover',
    required: true,
    order: 0,
    pageNumbers: [1],
    status: 'complete',
    content: {},
  },
  {
    id: 'drawing',
    key: 'drawing',
    title: '도면',
    kind: 'drawing-page',
    required: true,
    order: 1,
    pageNumbers: [2],
    status: 'in_progress',
    content: { drawingId: 'drawing-1' },
  },
] as unknown as PlanSection[];

describe('PlanSectionNavigator', () => {
  it('keeps the active upload section selected while navigation is disabled', () => {
    const onSelect = jest.fn();
    render(<PlanSectionNavigator
      sections={sections}
      selectedSectionId="drawing"
      disabled
      onSelect={onSelect}
    />);

    const coverButton = screen.getByRole('button', { name: /표지/ }) as HTMLButtonElement;
    expect(coverButton.disabled).toBe(true);
    fireEvent.click(coverButton);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
