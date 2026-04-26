
/**
 * 차트 색상 팔레트 (Tailwind CSS colors 기반)
 */
export const CHART_COLORS = {
    primary: '#3B82F6', // Blue 500
    secondary: '#10B981', // Emerald 500
    accent: '#F59E0B', // Amber 500
    danger: '#EF4444', // Red 500
    info: '#6366F1', // Indigo 500
    dark: '#1F2937', // Gray 800
    light: '#F3F4F6', // Gray 100

    // 그라데이션용
    gradients: {
        primary: ['#3B82F6', '#93C5FD'],
        secondary: ['#10B981', '#6EE7B7'],
        accent: ['#F59E0B', '#FCD34D'],
    }
};

/**
 * 차트 기본 설정
 */
export const CHART_DEFAULTS = {
    margin: { top: 10, right: 30, left: 0, bottom: 0 },
    animationDuration: 1000,
    tooltipStyle: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        border: 'none',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        padding: '12px'
    }
};

/**
 * 팀별 고정 색상 매핑 (일관성 유지)
 */
export const TEAM_COLOR_MAP: Record<string, string> = {
    'A팀': '#3B82F6',
    'B팀': '#10B981',
    'C팀': '#F59E0B',
    '직영팀': '#6366F1',
    '용역팀': '#EF4444',
    '지원팀': '#8B5CF6'
};

export const getTeamColor = (teamName: string): string => {
    return TEAM_COLOR_MAP[teamName] || '#9CA3AF'; // Default Gray
};
