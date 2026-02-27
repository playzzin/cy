import React, { useEffect, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Card as MTCard, Typography as MTTypography, Button as MTButton, Spinner as MTSpinner } from '@material-tailwind/react';
import { format } from 'date-fns';

// Fix for Material Tailwind TS2739 errors (missing props in types)
const Card = MTCard as any;
const Typography = MTTypography as any;
const Button = MTButton as any;
const Spinner = MTSpinner as any;

interface MetricPoint {
    timestamp: number;
    value: number;
}

interface SystemMetrics {
    invocations: MetricPoint[];
    errors: MetricPoint[];
    totalInvocations24h: number;
    totalErrors24h: number;
}

const MonitoringDashboard: React.FC = () => {
    const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchMetrics = async () => {
        setLoading(true);
        setError(null);
        try {
            const functions = getFunctions();
            const getSystemMetrics = httpsCallable(functions, 'getSystemMetrics');
            const result = await getSystemMetrics();
            const data = result.data as SystemMetrics;
            setMetrics(data);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to fetch metrics');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
    }, []);

    if (loading && !metrics) {
        return <div className="flex justify-center p-10"><Spinner /></div>;
    }

    if (error) {
        return (
            <div className="p-4 text-red-500 bg-red-50 rounded">
                Error: {error}
                <br />
                <Button size="sm" onClick={fetchMetrics} className="mt-2">Retry</Button>
            </div>
        );
    }

    // Prepare data for chart
    // We want to merge invocations and errors by timestamp
    const chartData = metrics?.invocations.map(inv => {
        const err = metrics.errors.find(e => e.timestamp === inv.timestamp);
        return {
            time: inv.timestamp,
            date: format(new Date(inv.timestamp), 'HH:mm'),
            invocations: inv.value,
            errors: err ? err.value : 0
        };
    }) || [];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4 bg-blue-50">
                    <Typography variant="h6" color="blue-gray" className="mb-1">Total Invocations (24h)</Typography>
                    <Typography variant="h3" color="blue">{metrics?.totalInvocations24h.toLocaleString()}</Typography>
                </Card>
                <Card className="p-4 bg-red-50">
                    <Typography variant="h6" color="blue-gray" className="mb-1">Total Errors (24h)</Typography>
                    <Typography variant="h3" color="red">{metrics?.totalErrors24h.toLocaleString()}</Typography>
                </Card>
            </div>

            <Card className="p-4">
                <div className="flex justify-between items-center mb-4">
                    <Typography variant="h5" color="blue-gray">Function Execution Trend</Typography>
                    <Button size="sm" variant="outlined" onClick={fetchMetrics} loading={loading}>Refresh</Button>
                </div>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip labelFormatter={(label) => new Date(chartData.find(d => d.date === label)?.time || 0).toLocaleString()} />
                            <Legend />
                            <Line type="monotone" dataKey="invocations" stroke="#2196F3" name="Invocations" strokeWidth={2} />
                            <Line type="monotone" dataKey="errors" stroke="#F44336" name="Errors" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <div className="text-sm text-gray-500">
                * Data is fetched from Cloud Monitoring API. Real-time metrics may have a slight delay (1-3 mins).
            </div>
        </div>
    );
};

export default MonitoringDashboard;
