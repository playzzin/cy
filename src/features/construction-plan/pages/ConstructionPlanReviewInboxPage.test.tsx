import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ConstructionPlan } from '../types';
import { listConstructionPlans } from '../services/constructionPlanService';
import ConstructionPlanReviewInboxPage, { matchesConstructionPlanReviewInboxTab } from './ConstructionPlanReviewInboxPage';

jest.mock('../services/constructionPlanService', () => ({ listConstructionPlans: jest.fn() }));

const listPlans = listConstructionPlans as jest.MockedFunction<typeof listConstructionPlans>;
const plan = (id: string, status: ConstructionPlan['status']): ConstructionPlan => ({
  id, status, title: `${id} 계획서`, documentNo: `CP-${id}`, revision: 1,
  projectSnapshot: { siteName: '테스트 현장' }, updatedAt: '2026-08-21T00:00:00.000Z',
} as ConstructionPlan);

describe('ConstructionPlanReviewInboxPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('separates pending, change-requested, and completed queues', async () => {
    listPlans.mockResolvedValue([plan('pending', 'in_review'), plan('changes', 'changes_requested'), plan('done', 'review_completed')]);
    render(<MemoryRouter><ConstructionPlanReviewInboxPage /></MemoryRouter>);
    expect(await screen.findByText('pending 계획서')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /수정요청/ }));
    expect(screen.getByText('changes 계획서')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /완료/ }));
    expect(screen.getByText('done 계획서')).toBeInTheDocument();
    await waitFor(() => expect(listPlans).toHaveBeenCalledTimes(1));
  });

  it('keeps queue classification deterministic', () => {
    expect(matchesConstructionPlanReviewInboxTab(plan('a', 'in_review'), 'pending')).toBe(true);
    expect(matchesConstructionPlanReviewInboxTab(plan('b', 'issued'), 'completed')).toBe(true);
    expect(matchesConstructionPlanReviewInboxTab(plan('c', 'draft'), 'pending')).toBe(false);
  });
});
