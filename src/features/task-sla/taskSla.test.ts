import type { Task } from '../../types/task';
import { buildTaskSlaBoard, classifyTaskSla, isTaskClosedForSla } from './taskSla';

const task = (overrides: Partial<Task>): Task => ({
  id: 'task',
  title: '업무',
  assignee: '담당자',
  priority: '보통' as Task['priority'],
  status: '진행' as Task['status'],
  dueDate: '2026-07-01',
  createdAt: '2026-06-30',
  comments: [],
  ...overrides,
});

describe('taskSla', () => {
  it('classifies overdue, today, soon and missing metadata tasks', () => {
    const today = new Date('2026-06-30T00:00:00.000Z');

    expect(classifyTaskSla(task({ dueDate: '2026-06-29' }), today).bucket).toBe('overdue');
    expect(classifyTaskSla(task({ dueDate: '2026-06-30' }), today).bucket).toBe('dueToday');
    expect(classifyTaskSla(task({ dueDate: '2026-07-03' }), today).bucket).toBe('dueSoon');
    expect(classifyTaskSla(task({ dueDate: '' }), today).bucket).toBe('missingDueDate');
    expect(classifyTaskSla(task({ assignee: '' }), today).bucket).toBe('missingAssignee');
  });

  it('counts SLA buckets for a board', () => {
    const today = new Date('2026-06-30T00:00:00.000Z');
    const board = buildTaskSlaBoard([
      task({ id: 'a', dueDate: '2026-06-29' }),
      task({ id: 'b', dueDate: '2026-06-30' }),
      task({ id: 'c', dueDate: '2026-07-10' }),
      task({ id: 'd', status: '검토' as Task['status'] }),
    ], today);

    expect(board.open).toBe(3);
    expect(board.counts.overdue).toBe(1);
    expect(board.counts.dueToday).toBe(1);
    expect(board.counts.healthy).toBe(1);
    expect(board.counts.closed).toBe(1);
    expect(board.riskItems).toHaveLength(2);
  });

  it('treats final review/completed-like statuses as closed', () => {
    expect(isTaskClosedForSla(task({ status: '검토' as Task['status'] }))).toBe(true);
    expect(isTaskClosedForSla(task({ status: 'completed' as Task['status'] }))).toBe(true);
  });
});
