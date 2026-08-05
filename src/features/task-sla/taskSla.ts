import type { Task } from '../../types/task';

export type TaskSlaBucket = 'overdue' | 'dueToday' | 'dueSoon' | 'missingAssignee' | 'missingDueDate' | 'healthy' | 'closed';

export interface TaskSlaItem {
  task: Task;
  bucket: TaskSlaBucket;
  daysUntilDue: number | null;
  label: string;
  severity: 0 | 1 | 2 | 3;
}

export interface TaskSlaBoard {
  total: number;
  open: number;
  counts: Record<TaskSlaBucket, number>;
  riskItems: TaskSlaItem[];
}

const normalizeText = (value: unknown): string => String(value ?? '').trim().replace(/\s+/g, '').toLowerCase();

export const isTaskClosedForSla = (task: Pick<Task, 'status'>): boolean => {
  const status = normalizeText(task.status);
  return /검토|최종|완료됨|closed|done|complete/.test(status);
};

const toStartOfDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const getDaysUntilDue = (dueDate: string, today: Date): number | null => {
  if (!dueDate) return null;
  const due = toStartOfDay(new Date(dueDate));
  if (Number.isNaN(due.getTime())) return null;
  const base = toStartOfDay(today);
  return Math.ceil((due.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
};

export const classifyTaskSla = (task: Task, today = new Date()): TaskSlaItem => {
  const closed = isTaskClosedForSla(task);
  if (closed) {
    return { task, bucket: 'closed', daysUntilDue: getDaysUntilDue(task.dueDate, today), label: '종료', severity: 0 };
  }

  if (!String(task.assignee || '').trim()) {
    return { task, bucket: 'missingAssignee', daysUntilDue: getDaysUntilDue(task.dueDate, today), label: '담당자 없음', severity: 3 };
  }

  const daysUntilDue = getDaysUntilDue(task.dueDate, today);
  if (daysUntilDue === null) {
    return { task, bucket: 'missingDueDate', daysUntilDue, label: '기한 없음', severity: 2 };
  }

  if (daysUntilDue < 0) {
    return { task, bucket: 'overdue', daysUntilDue, label: `${Math.abs(daysUntilDue)}일 지연`, severity: 3 };
  }

  if (daysUntilDue === 0) {
    return { task, bucket: 'dueToday', daysUntilDue, label: '오늘 마감', severity: 2 };
  }

  if (daysUntilDue <= 3) {
    return { task, bucket: 'dueSoon', daysUntilDue, label: `${daysUntilDue}일 남음`, severity: 1 };
  }

  return { task, bucket: 'healthy', daysUntilDue, label: '정상', severity: 0 };
};

export const buildTaskSlaBoard = (tasks: Task[], today = new Date()): TaskSlaBoard => {
  const items = tasks.map((task) => classifyTaskSla(task, today));
  const counts: Record<TaskSlaBucket, number> = {
    overdue: 0,
    dueToday: 0,
    dueSoon: 0,
    missingAssignee: 0,
    missingDueDate: 0,
    healthy: 0,
    closed: 0,
  };

  items.forEach((item) => {
    counts[item.bucket] += 1;
  });

  return {
    total: tasks.length,
    open: tasks.length - counts.closed,
    counts,
    riskItems: items
      .filter((item) => item.severity > 0)
      .sort((a, b) => b.severity - a.severity || (a.daysUntilDue ?? 999) - (b.daysUntilDue ?? 999))
      .slice(0, 5),
  };
};
