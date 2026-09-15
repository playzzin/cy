import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoReminderDialog } from './MemoReminderDialog';
import { MemoReminder, memoReminderService, parseReminderDateInput, reminderDateInput } from '../services/memoReminderService';

jest.mock('../../../config/firebase', () => ({ db: {}, functions: {} }));
const props = { memoId: 'memo-one', memoTitle: '알림 확인', onClose: jest.fn(), onSaved: jest.fn() };
const nextYear = `${new Date().getFullYear() + 1}-01-31T09:30`;
const reminder: MemoReminder = { id: 'r', memoId: props.memoId, remindAt: parseReminderDateInput(nextYear), repeat: 'monthly', status: 'scheduled' };

beforeEach(() => { jest.clearAllMocks(); });
afterEach(() => { jest.restoreAllMocks(); });

it.each(['none', 'daily', 'weekdays', 'weekly', 'monthly'])('saves %s in Korean time', async repeat => {
    const save = jest.spyOn(memoReminderService, 'save').mockResolvedValue(undefined);
    render(<MemoReminderDialog {...props} />);
    fireEvent.change(screen.getByLabelText('알림 날짜·시간 (한국 시간)'), { target: { value: nextYear } });
    fireEvent.change(screen.getByLabelText('반복 주기'), { target: { value: repeat } });
    fireEvent.click(screen.getByRole('button', { name: '알림 저장' }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith('memo-one', Date.parse(`${nextYear}:00+09:00`), repeat);
    expect(props.onSaved).toHaveBeenCalledWith(false);
});

it('loads and cancels the existing reminder', async () => {
    const save = jest.spyOn(memoReminderService, 'save').mockResolvedValue(undefined);
    render(<MemoReminderDialog {...props} reminder={reminder} />);
    expect(screen.getByLabelText('알림 날짜·시간 (한국 시간)')).toHaveValue(nextYear);
    expect(screen.getByLabelText('반복 주기')).toHaveValue('monthly');
    fireEvent.click(screen.getByRole('button', { name: '알림 해제' }));
    await waitFor(() => expect(props.onSaved).toHaveBeenCalledWith(true));
    expect(save).toHaveBeenCalledWith('memo-one', null, 'monthly');
});

it('rejects past time without saving', () => {
    const save = jest.spyOn(memoReminderService, 'save').mockResolvedValue(undefined);
    render(<MemoReminderDialog {...props} />);
    fireEvent.change(screen.getByLabelText('알림 날짜·시간 (한국 시간)'), { target: { value: '2020-01-01T09:00' } });
    fireEvent.click(screen.getByRole('button', { name: '알림 저장' }));
    expect(screen.getByRole('alert')).toHaveTextContent('현재보다 이후');
    expect(save).not.toHaveBeenCalled();
});

it('retains settings on failure and allows retry', async () => {
    const save = jest.spyOn(memoReminderService, 'save').mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    render(<MemoReminderDialog {...props} reminder={reminder} />);
    fireEvent.click(screen.getByRole('button', { name: '알림 저장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('저장하지 못했습니다');
    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText('반복 주기')).toHaveValue('monthly');
    fireEvent.click(screen.getByRole('button', { name: '알림 저장' }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledTimes(2);
});

it('round-trips Korean dates independently of the browser timezone', () => {
    expect(reminderDateInput(Date.parse('2026-09-14T00:30:00Z'))).toBe('2026-09-14T09:30');
    expect(parseReminderDateInput('2026-09-14T09:30')).toBe(Date.parse('2026-09-14T00:30:00Z'));
    expect(parseReminderDateInput('not a date')).toBeNaN();
    expect(parseReminderDateInput('2026-02-30T09:30')).toBeNaN();
});
