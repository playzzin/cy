import { getTaskStage, getTaskStatusMeta } from './taskStatus';
import { isTaskClosedForSla } from '../features/task-sla/taskSla';
import { STATUS_CONFIG, type Task } from '../types/task';

it.each(['완료', '검토중'] as Task['status'][])('keeps %s open until the requester confirms it', status => {
    expect(getTaskStage(status)).toBe('review');
    expect(isTaskClosedForSla({ status })).toBe(false);
    expect(getTaskStatusMeta(status).label).toBe('확인 필요');
    expect(STATUS_CONFIG[status].label).toBe('확인 필요');
});
it.each(['검토', '완료함'] as Task['status'][])('uses one completion meaning for %s', status => {
    expect(getTaskStage(status)).toBe('done');
    expect(isTaskClosedForSla({ status })).toBe(true);
    expect(STATUS_CONFIG[status].label).toBe('완료');
});
it('does not hide unknown statuses as completed', () => {
    expect(getTaskStage('검토 보류')).toBe('active');
    expect(getTaskStage('not completed')).toBe('active');
});
