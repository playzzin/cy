import React from 'react';
import { Card as MTCard, Typography as MTTypography } from '@material-tailwind/react';
import MonitoringDashboard from '../../components/admin/MonitoringDashboard';

// Fix for Material Tailwind TS2739 errors
const Card = MTCard as any;
const Typography = MTTypography as any;

const SystemStatusPage: React.FC = () => {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <Typography variant="h3" color="blue-gray">
                    System Status
                </Typography>
                <Typography variant="paragraph" className="text-gray-600">
                    Monitor system health, Cloud Functions usage, and errors.
                </Typography>
            </div>

            <Card className="p-6">
                <MonitoringDashboard />
            </Card>
        </div>
    );
};

export default SystemStatusPage;
