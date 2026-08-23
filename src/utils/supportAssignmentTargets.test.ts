import {
    isOfficeBillingTargetForSelectedTeam,
    officeAssignmentReferencesMatch,
    OFFICE_ASSIGNMENT_TEAM_ID,
    OFFICE_ASSIGNMENT_TEAM_NAME
} from './supportAssignmentTargets';

describe('support assignment target filters', () => {
    it.each(['office', 'office_staff'] as const)(
        'includes %s billing targets in the office team filter',
        (targetType) => {
            expect(isOfficeBillingTargetForSelectedTeam(
                OFFICE_ASSIGNMENT_TEAM_ID,
                '',
                targetType
            )).toBe(true);

            expect(isOfficeBillingTargetForSelectedTeam(
                '',
                OFFICE_ASSIGNMENT_TEAM_NAME,
                targetType
            )).toBe(true);
        }
    );

    it('does not treat regular team billing targets as office targets', () => {
        expect(isOfficeBillingTargetForSelectedTeam(
            OFFICE_ASSIGNMENT_TEAM_ID,
            OFFICE_ASSIGNMENT_TEAM_NAME,
            'team'
        )).toBe(false);
    });

    it('does not include office billing targets in a regular team filter', () => {
        expect(isOfficeBillingTargetForSelectedTeam(
            'team-1',
            '1팀',
            'office'
        )).toBe(false);
    });

    it('matches the office synthetic ID with an office name-only assignment', () => {
        expect(officeAssignmentReferencesMatch(
            OFFICE_ASSIGNMENT_TEAM_ID,
            '',
            '',
            OFFICE_ASSIGNMENT_TEAM_NAME
        )).toBe(true);
    });

    it('does not match an office filter with a regular team assignment', () => {
        expect(officeAssignmentReferencesMatch(
            OFFICE_ASSIGNMENT_TEAM_ID,
            OFFICE_ASSIGNMENT_TEAM_NAME,
            'team-1',
            '1팀'
        )).toBe(false);
    });
});
