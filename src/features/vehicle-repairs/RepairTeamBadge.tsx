import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers } from '@fortawesome/free-solid-svg-icons';
import { resolveIcon } from '../../constants/iconMap';
import { getContrastingTextColor, normalizeHexColor } from '../../utils/color';
import type { RepairTeam } from './vehicleTeam';

export default function RepairTeamBadge({ team, title }: { team: RepairTeam; title?: string }) {
  const color = normalizeHexColor(team.teamColor);
  return <span className="repair-team-badge" title={title ?? team.teamName} style={{ backgroundColor: color, color: getContrastingTextColor(color) }}>
    <FontAwesomeIcon icon={resolveIcon(team.teamIcon, faUsers)} aria-hidden="true" />
    <span>{team.teamName}</span>
  </span>;
}
