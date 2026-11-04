import React, { useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faUsers } from '@fortawesome/free-solid-svg-icons';
import { normalizeHexColor } from '../../../utils/color';
import './AdvanceTeamSelector.css';

type Props = {
    teams: ReadonlyArray<{ id: string; name: string; color?: string | null }>;
    selectedTeamId: string | null;
    onChange: (teamId: string | null) => void;
    disabled?: boolean;
    allReadOnly?: boolean;
};

export default function AdvanceTeamSelector({ teams, selectedTeamId, onChange, disabled = false, allReadOnly = false }: Props) {
    const buttonsRef = useRef<HTMLDivElement>(null);
    const allLabel = allReadOnly ? '전체 보기 (조회 전용)' : '전체 보기';
    const unavailable = selectedTeamId && !teams.some(team => team.id === selectedTeamId);
    useEffect(() => {
        const strip = buttonsRef.current;
        const active = strip?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
        if (!strip || !active || strip.scrollWidth <= strip.clientWidth) return;
        const bounds = strip.getBoundingClientRect();
        const selected = active.getBoundingClientRect();
        if (selected.left < bounds.left) strip.scrollLeft += selected.left - bounds.left;
        else if (selected.right > bounds.right) strip.scrollLeft += selected.right - bounds.right;
    }, [selectedTeamId, teams]);
    return (
        <div className="advance-team-selector">
            <span className="advance-filter-label" aria-hidden="true"><FontAwesomeIcon icon={faUsers} />팀 선택</span>
            <div ref={buttonsRef} className="advance-team-buttons" role="group" aria-label="팀 선택">
                <button type="button" className="advance-team-button advance-team-button--all"
                    aria-pressed={selectedTeamId === null} aria-label={allLabel} title={allLabel}
                    disabled={disabled} onClick={() => onChange(null)}>전체 보기</button>
                {!disabled && (unavailable || !teams.length) && <span className="advance-team-empty" role="status">
                    {unavailable ? '선택한 팀 (조회 불가)' : '선택할 팀이 없습니다'}
                </span>}
                {teams.map(team => {
                    const color = normalizeHexColor(team.color);
                    const selected = selectedTeamId === team.id;
                    return <button key={team.id} type="button" className="advance-team-button" aria-pressed={selected}
                        disabled={disabled} onClick={() => onChange(team.id)} title={team.name}
                        style={{ '--advance-team-color': color } as React.CSSProperties}>
                        <span className="advance-team-marker" style={{ color }} aria-hidden="true">
                            {selected ? <FontAwesomeIcon icon={faCheck} /> : <span />}
                        </span>
                        {team.name}
                    </button>;
                })}
            </div>
        </div>
    );
}
