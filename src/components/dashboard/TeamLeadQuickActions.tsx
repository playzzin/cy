import React from 'react';
import { CalendarCheck, ClipboardList, HandCoins, Receipt, MapPin, Wallet } from 'lucide-react';
import { useRouteAction } from '../../hooks/useRouteAction';
import { TEAM_HISTORY_PATH, TEAM_REQUESTS_PATH, TEAM_SITE_PATH, TEAM_REQUEST_ACTIONS } from '../../constants/teamWorkflowActions';

const actions = [
    { label: '근무내역 확인', path: TEAM_HISTORY_PATH, icon: CalendarCheck },
    { ...TEAM_REQUEST_ACTIONS[1], icon: Receipt },
    { ...TEAM_REQUEST_ACTIONS[2], icon: HandCoins },
    { label: '팀 정산', path: '/payroll/team-settlement', icon: Wallet },
    { label: '팀 요청함', path: TEAM_REQUESTS_PATH, icon: ClipboardList },
    { label: '현장 현황', path: TEAM_SITE_PATH, icon: MapPin },
];

export function TeamLeadQuickActions() {
    const runRouteAction = useRouteAction();
    return (
        <nav aria-label="팀장 바로가기" className="tm-dashboard-quick mb-6 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <h2 className="mb-3 text-sm font-bold text-slate-700">팀장 바로가기</h2>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
                {actions.map(({ label, path, icon: Icon }) => (
                    <button key={path} type="button" onClick={() => runRouteAction(path)}
                        className="flex min-h-14 min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left text-sm font-bold text-slate-800 transition hover:border-cyan-300 hover:bg-cyan-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600">
                        <Icon size={20} className="shrink-0 text-cyan-700" aria-hidden="true" />
                        <span>{label}</span>
                    </button>
                ))}
            </div>
        </nav>
    );
}
