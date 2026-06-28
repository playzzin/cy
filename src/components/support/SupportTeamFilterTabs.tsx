import React from 'react';
import { Team } from '../../services/teamService';
import { getContrastingTextColor, hexToRgba, normalizeHexColor } from '../../utils/color';

interface SupportTeamFilterTabsProps {
    teams: Team[];
    selectedTeamId: string;
    onChange: (teamId: string) => void;
    disabled?: boolean;
    allLabel?: string;
    className?: string;
}

const getTeamId = (team: Team): string => String(team.id ?? team.legacyId ?? '').trim();

export const SupportTeamFilterTabs: React.FC<SupportTeamFilterTabsProps> = ({
    teams,
    selectedTeamId,
    onChange,
    disabled = false,
    allLabel = '전체',
    className = ''
}) => {
    const buttonBase = 'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-extrabold transition-all';

    return (
        <div className={`min-w-0 ${className}`}>
            <div className="flex max-w-full gap-1.5 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                    type="button"
                    onClick={() => onChange('')}
                    disabled={disabled}
                    aria-label="팀별 보기: 전체"
                    className={`${buttonBase} ${
                        !selectedTeamId
                            ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                            : 'border-transparent bg-white text-slate-500 hover:border-slate-200 hover:text-slate-800'
                    } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                    {allLabel}
                </button>
                {teams.map((team) => {
                    const teamId = getTeamId(team);
                    if (!teamId) return null;
                    const color = normalizeHexColor(team.color);
                    const selectedTextColor = getContrastingTextColor(color);
                    const isSelected = String(selectedTeamId) === teamId;

                    return (
                        <button
                            key={teamId}
                            type="button"
                            onClick={() => onChange(teamId)}
                            disabled={disabled}
                            aria-label={`팀별 보기: ${team.name}`}
                             className={`${buttonBase} ${
                                 isSelected
                                     ? 'shadow-sm'
                                     : 'bg-white hover:-translate-y-0.5'
                             } ${disabled ? 'cursor-not-allowed opacity-50 hover:translate-y-0' : ''}`}
                             style={isSelected
                                 ? {
                                     backgroundColor: color,
                                     borderColor: color,
                                     color: selectedTextColor
                                 }
                                 : {
                                     color: '#0f172a',
                                     borderColor: hexToRgba(color, 0.45),
                                     backgroundColor: hexToRgba(color, 0.14)
                                 }}
                            title={team.name}
                        >
                            <span
                                 className="h-2 w-2 shrink-0 rounded-full"
                                 style={{ backgroundColor: isSelected ? selectedTextColor : color }}
                             />
                            <span className="whitespace-nowrap">{team.name}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default SupportTeamFilterTabs;
