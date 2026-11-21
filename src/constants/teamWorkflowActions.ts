// Shared by the team dashboard, request hub and registered team menu.
export const TEAM_HISTORY_PATH = '/manpower/team-worker-history';
export const TEAM_SITE_PATH = '/manpower/site-responsible-detail';
export const TEAM_REQUESTS_PATH = '/team/requests';

export const TEAM_REQUEST_ACTIONS = [
    { label: '신규 작업자 등록', description: '작업자 등록을 신청하고 승인 상태를 확인합니다.', path: '/manpower/team-worker-requests' },
    { label: '경비 신청', description: '팀 경비를 신청하고 처리 상태를 확인합니다.', path: '/support/team-expense-requests' },
    { label: '가불 신청', description: '팀원의 가불 신청과 신청 내역을 확인합니다.', path: '/payroll/advance-request' },
];
