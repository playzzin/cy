import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarDay, faClock, faTriangleExclamation, faUserSlash } from '@fortawesome/free-solid-svg-icons';
import type { Task } from '../../types/task';
import { buildTaskSlaBoard, type TaskSlaBucket } from '../../features/task-sla/taskSla';

interface TaskSlaBoardProps {
  tasks: Task[];
  onSelectTask?: (taskId: string) => void;
}

const bucketMeta: Record<Exclude<TaskSlaBucket, 'healthy' | 'closed'>, {
  label: string;
  className: string;
  icon: typeof faClock;
}> = {
  overdue: {
    label: '지연',
    icon: faTriangleExclamation,
    className: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  },
  dueToday: {
    label: '오늘 마감',
    icon: faCalendarDay,
    className: 'border-orange-500/30 bg-orange-500/10 text-orange-200',
  },
  dueSoon: {
    label: '3일 이내',
    icon: faClock,
    className: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
  },
  missingAssignee: {
    label: '담당자 없음',
    icon: faUserSlash,
    className: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
  },
  missingDueDate: {
    label: '기한 없음',
    icon: faClock,
    className: 'border-slate-500/30 bg-slate-500/10 text-slate-200',
  },
};

const riskBuckets: Array<Exclude<TaskSlaBucket, 'healthy' | 'closed'>> = [
  'overdue',
  'dueToday',
  'dueSoon',
  'missingAssignee',
  'missingDueDate',
];

export const TaskSlaBoard: React.FC<TaskSlaBoardProps> = ({ tasks, onSelectTask }) => {
  const board = React.useMemo(() => buildTaskSlaBoard(tasks), [tasks]);

  return (
    <section className="mb-6 rounded-2xl border border-slate-700/60 bg-slate-800/50 p-4 shadow-xl shadow-slate-950/20">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-indigo-300">SLA Board</p>
          <h2 className="text-lg font-black text-white">업무 요청 SLA</h2>
        </div>
        <p className="text-sm font-medium text-slate-400">
          열린 업무 {board.open}건 / 전체 {board.total}건
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {riskBuckets.map((bucket) => {
          const meta = bucketMeta[bucket];
          return (
            <div key={bucket} className={`rounded-xl border px-4 py-3 ${meta.className}`}>
              <div className="flex items-center justify-between text-xs font-black">
                <span>{meta.label}</span>
                <FontAwesomeIcon icon={meta.icon} />
              </div>
              <div className="mt-2 text-2xl font-black">{board.counts[bucket]}</div>
            </div>
          );
        })}
      </div>

      {board.riskItems.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-2">
          {board.riskItems.map((item) => (
            <button
              type="button"
              key={item.task.id}
              onClick={() => onSelectTask?.(item.task.id)}
              className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-left transition hover:border-indigo-500/60 hover:bg-slate-900"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">{item.task.title}</p>
                <p className="mt-1 text-xs font-medium text-slate-400">
                  {item.task.assignee || '담당자 없음'} · {item.task.dueDate || '기한 없음'}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-800 px-2 py-1 text-[11px] font-black text-indigo-200">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};
