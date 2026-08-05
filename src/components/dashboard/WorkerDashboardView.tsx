import React from 'react';
import type { Worker } from '../../services/manpowerService';
import { FieldRoleDashboardView } from './FieldRoleDashboardView';

interface WorkerDashboardViewProps {
    linkedWorker: Worker | null;
}

const WorkerDashboardView: React.FC<WorkerDashboardViewProps> = ({ linkedWorker }) => (
    <FieldRoleDashboardView role="worker" linkedWorker={linkedWorker} />
);

export default WorkerDashboardView;
