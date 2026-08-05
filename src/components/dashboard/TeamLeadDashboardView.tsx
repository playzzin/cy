import React from 'react';
import type { Worker } from '../../services/manpowerService';
import { FieldRoleDashboardView } from './FieldRoleDashboardView';

interface TeamLeadDashboardViewProps {
    linkedWorker: Worker | null;
}

const TeamLeadDashboardView: React.FC<TeamLeadDashboardViewProps> = ({ linkedWorker }) => (
    <FieldRoleDashboardView role="teamLead" linkedWorker={linkedWorker} />
);

export default TeamLeadDashboardView;
