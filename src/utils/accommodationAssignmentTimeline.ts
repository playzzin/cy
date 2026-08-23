import { AccommodationAssignment } from '../types/accommodationAssignment';
import { normalizeTypedDateInput } from './typedDateInput';

const normalizeDate = (value: unknown): string => normalizeTypedDateInput(String(value ?? '')) ?? '';

/**
 * 특정 날짜에 실제로 적용되던 숙소 배정을 찾는다.
 * 현재 입실자만 보지 않고 종료된 과거 배정까지 포함해야 분할청구의 이전
 * 구간이 당시 입실자에게 정확히 연결된다.
 */
export const findAccommodationAssignmentForDate = (
    assignments: readonly AccommodationAssignment[],
    date: string
): AccommodationAssignment | undefined => {
    const targetDate = normalizeDate(date);
    if (!targetDate) return undefined;

    return assignments
        .filter((assignment) => {
            const startDate = normalizeDate(assignment.startDate);
            const endDate = normalizeDate(assignment.endDate);
            if (startDate && startDate > targetDate) return false;
            if (endDate && endDate < targetDate) return false;
            return true;
        })
        .sort((left, right) => normalizeDate(right.startDate).localeCompare(normalizeDate(left.startDate)))[0];
};

