import { getContrastRatio } from './color';
import { freelancerReportRowKey } from './freelancerYearlyData';

interface ReportRow {
    id?: string;
    teamId?: string;
    teamName?: string;
    performanceBonus?: unknown;
    [key: string]: unknown;
}

interface TeamTheme {
    id: string;
    name: string;
    background: string;
}

const TEAM_COLORS = [
    'linear-gradient(135deg, #FF5252 0%, #D32F2F 100%)',
    'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
    'linear-gradient(135deg, #7C4DFF 0%, #512DA8 100%)',
    'linear-gradient(135deg, #E040FB 0%, #C2185B 100%)',
    'linear-gradient(135deg, #FFAB40 0%, #F57C00 100%)',
    'linear-gradient(135deg, #FFD740 0%, #FFA000 100%)',
    'linear-gradient(135deg, #69F0AE 0%, #388E3C 100%)',
    'linear-gradient(135deg, #40C4FF 0%, #0288D1 100%)',
    'linear-gradient(135deg, #18FFFF 0%, #0097A7 100%)',
    'linear-gradient(135deg, #EEFF41 0%, #AFB42B 100%)',
];

/** 저장된 팀 색상을 우선하고, 미등록 시 신고 화면에서 사용하는 기본색을 적용한다. */
export function freelancerTeamBackground(team: { name: string; color?: string }, index: number): string {
    if (team.color?.trim()) return team.color.trim();
    const name = team.name.replace(/\s+/g, '').replace(/팀$/, '');
    if (name === '김진민') return '#000000';
    if (name === '김군회') return '#7c3aed';
    return TEAM_COLORS[index % TEAM_COLORS.length];
}

interface ReportTeamColor {
    teamId: string;
    teamName: string;
    background?: string;
    textColor?: string;
}

export interface FreelancerTeamHistory {
    background?: string;
    textColor?: string;
    previousTeamId?: string;
    previousTeamName?: string;
    label: string;
    sharedMonths: number[];
    otherTeams: ReportTeamColor[];
    reports: Array<ReportTeamColor & {
        months: Array<{ month: number; amount: number }>;
        bonus: number;
        total: number;
    }>;
    title: string;
}

const amount = (value: unknown): number => {
    const parsed = Number(String(value ?? '').replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
};
const won = (value: number): string => `${value.toLocaleString('ko-KR')}원`;

const readableText = (background: string): string => {
    const colors = (background.match(/#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/ig) || ['#64748b'])
        .map(color => color.length === 4 ? `#${color.slice(1).split('').map(channel => channel + channel).join('')}` : color);
    const contrast = (text: string) => Math.min(...colors.map(color => getContrastRatio(text, color)));
    return contrast('#ffffff') >= contrast('#0f172a') ? '#ffffff' : '#0f172a';
};

/** 선택 연도의 실제 신고 월로 이전 팀을 찾는다. 동월 복수 팀은 이동 순서를 추정하지 않는다. */
export function buildFreelancerTeamHistory(
    rows: ReportRow[], teams: TeamTheme[], year: number,
): Map<string, FreelancerTeamHistory> {
    const themes = new Map(teams.map(team => [team.id, team]));
    const reportColor = (row: ReportRow): ReportTeamColor => {
        const theme = themes.get(row.teamId || '');
        return {
            teamId: row.teamId || '',
            teamName: theme?.name || row.teamName || '소속 없음',
            background: theme?.background,
            textColor: theme ? readableText(theme.background) : undefined,
        };
    };
    const histories = rows.map(row => {
        const months = Array.from({ length: 12 }, (_, index) => ({
            month: index + 1,
            amount: amount(row[`m${String(index + 1).padStart(2, '0')}`]),
        })).filter(entry => entry.amount !== 0);
        const bonus = amount(row.performanceBonus);
        return {
            row, months, bonus,
            ...reportColor(row),
            total: months.reduce((sum, entry) => sum + entry.amount, bonus),
        };
    });
    const byWorker = new Map<string, typeof histories>();
    histories.forEach(history => {
        if (!history.row.id) return;
        const workerHistory = byWorker.get(history.row.id) || [];
        workerHistory.push(history);
        byWorker.set(history.row.id, workerHistory);
    });

    const result = new Map<string, FreelancerTeamHistory>();
    histories.forEach(current => {
        const workerHistory = byWorker.get(current.row.id || '') || [];
        const reports = workerHistory.filter(history => history.months.length > 0 || history.bonus !== 0);
        const otherReports = reports.filter(history => history.row.teamId !== current.row.teamId);
        if (otherReports.length === 0) return;
        const sharedMonths = Array.from({ length: 12 }, (_, index) => index + 1)
            .filter(month => new Set(reports.filter(history => history.months.some(entry => entry.month === month))
                .map(history => history.row.teamId)).size > 1);

        // 재이동한 경우 가장 최근 신고 월 직전의 다른 팀을 표시한다.
        // 아직 신고가 없는 새 팀에서는 마지막 신고팀을 표시한다.
        const currentMonth = current.months.at(-1)?.month ?? 13;
        const previous = reports.filter(history => history.row.teamId !== current.row.teamId)
            .map(history => ({ history, month: history.months.filter(entry => entry.month < currentMonth).at(-1)?.month || 0 }))
            .filter(entry => entry.month > 0);
        const latestMonth = Math.max(0, ...previous.map(entry => entry.month));
        const latestTeams = previous.filter(entry => entry.month === latestMonth);
        const previousTeam = latestTeams.length === 1 ? latestTeams[0].history : undefined;
        // 다른 신고팀이 하나면 시점과 무관하게 그 색을 채운다. 여러 팀은 각각의 색상표로 모두 안내한다.
        const nameColor = previousTeam || (otherReports.length === 1 ? otherReports[0] : undefined);
        const title = [
            ...(previousTeam ? [`이전 신고팀: ${previousTeam.teamName} (${latestMonth}월)`] : []),
            ...(latestTeams.length > 1 ? ['같은 월에 여러 팀의 신고가 있어 이동 순서를 알 수 없습니다.'] : []),
            `${year}년 팀별 신고 내역`,
            ...reports.flatMap(history => [
                `${history.teamName} · 합계 ${won(history.total)}`,
                ...history.months.map(entry => `  ${entry.month}월 ${won(entry.amount)}`),
                ...(history.bonus !== 0 ? [`  성과급 ${won(history.bonus)}`] : []),
            ]),
        ].join('\n');
        result.set(freelancerReportRowKey(current.row), {
            background: nameColor?.background,
            textColor: nameColor?.textColor,
            previousTeamId: previousTeam?.row.teamId,
            previousTeamName: previousTeam?.teamName,
            label: previousTeam ? `이전: ${previousTeam.teamName}`
                : sharedMonths.length > 0 ? '같은 달 여러 팀 신고' : '다른 팀 신고 있음',
            sharedMonths,
            otherTeams: otherReports.map(history => reportColor(history.row)),
            reports: reports.map(history => ({
                ...reportColor(history.row),
                months: history.months, bonus: history.bonus, total: history.total,
            })),
            title,
        });
    });
    return result;
}
