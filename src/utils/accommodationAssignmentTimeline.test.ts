import { AccommodationAssignment } from '../types/accommodationAssignment';
import { findAccommodationAssignmentForDate } from './accommodationAssignmentTimeline';

const assignment = (overrides: Partial<AccommodationAssignment>): AccommodationAssignment => ({
    id: overrides.id ?? 'assignment',
    accommodationId: 'room-1',
    accommodationName: '테스트 숙소',
    workerId: overrides.workerId ?? '',
    workerName: overrides.workerName ?? '',
    teamId: overrides.teamId ?? '',
    teamName: overrides.teamName ?? '',
    source: overrides.source ?? 'worker',
    status: overrides.status ?? 'active',
    startDate: overrides.startDate ?? '2026-01-01',
    endDate: overrides.endDate,
});

describe('findAccommodationAssignmentForDate', () => {
    const assignments = [
        assignment({ id: 'park', workerName: '박상국', startDate: '2026-04-18', endDate: '2026-04-30', status: 'ended' }),
        assignment({ id: 'shin', workerName: '신광식', startDate: '2026-05-01' }),
    ];

    it('uses the historical occupant for the previous split segment', () => {
        expect(findAccommodationAssignmentForDate(assignments, '2026-04-30')?.workerName).toBe('박상국');
    });

    it('uses the current occupant after the handoff date', () => {
        expect(findAccommodationAssignmentForDate(assignments, '26-05-01')?.workerName).toBe('신광식');
    });

    it('returns undefined when no assignment covers the date', () => {
        expect(findAccommodationAssignmentForDate(assignments, '2026-04-01')).toBeUndefined();
    });
});
