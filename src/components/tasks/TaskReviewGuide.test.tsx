import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { TaskReviewForm, TaskReviewGuide } from './TaskReviewGuide';
import { emptyTaskReview, validateTaskReview, formatTaskReview } from '../../utils/taskReview';

it('requires useful instructions and a testable deployment before requesting review', () => {
    const initial = { ...emptyTaskReview(), changes: '계좌가 바로 반영됩니다.', location: '월급여정산', steps: '은행이체 미리보기를 엽니다.', expected: '선택한 대표계좌가 보입니다.' };
    const onSubmit = jest.fn();
    render(<TaskReviewForm initial={initial} busy={false} onSubmit={onSubmit} onCancel={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '안내와 함께 확인 요청' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('반영한 뒤');
    fireEvent.change(screen.getByRole('combobox', { name: '반영 상태' }), { target: { value: 'preview' } });
    fireEvent.click(screen.getByRole('button', { name: '안내와 함께 확인 요청' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ deployment: 'preview' }));
    expect(validateTaskReview(emptyTaskReview())).toContain('모두');
    expect(formatTaskReview({ ...initial, deployment: 'deployed' })).toContain('실제 사이트 반영');
});

it('presents four readable sections and the entered deployment status', () => {
    render(<TaskReviewGuide review={{ ...emptyTaskReview(), changes: '변경', location: '화면', steps: '순서', expected: '결과', deployment: 'preview' }} />);
    expect(screen.getByRole('region', { name: '결과 확인 안내' })).toHaveTextContent('검증 화면 반영');
    ['바뀐 점', '확인할 화면', '확인 순서', '정상 결과'].forEach(label => expect(screen.getByText(label)).toBeInTheDocument());
});
