import React from 'react';
import type { Worker } from '../../services/manpowerService';
import { FieldRoleDashboardView } from './FieldRoleDashboardView';

interface ForemanDashboardViewProps {
    linkedWorker: Worker | null;
}

const ForemanDashboardView: React.FC<ForemanDashboardViewProps> = ({ linkedWorker }) => (
    <FieldRoleDashboardView role="foreman" linkedWorker={linkedWorker} />
);

export default ForemanDashboardView;
