
import React from 'react';
import { StatCard } from '../core/StatCard';
import { KPIItem } from '../../../types/dashboard';
import { Users, CreditCard, Activity, TrendingUp } from 'lucide-react';

interface KPISummaryProps {
    items: KPIItem[];
    loading?: boolean;
}

const iconMap: Record<string, any> = {
    'total-manday': Activity,
    'total-amount': CreditCard,
    'worker-count': Users,
    default: TrendingUp
};

const colorMap: Record<string, any> = {
    'total-manday': 'blue',
    'total-amount': 'emerald',
    'worker-count': 'amber',
    default: 'slate'
};

export const KPISummary: React.FC<KPISummaryProps> = ({ items, loading }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {items.map((item) => (
                <StatCard
                    key={item.id}
                    title={item.label}
                    value={
                        item.unit === '원'
                            ? new Intl.NumberFormat('ko-KR').format(item.value) + '원'
                            : item.unit === '공수'
                                ? item.value.toFixed(1) + '공수'
                                : item.value + (item.unit || '')
                    }
                    icon={iconMap[item.id] || iconMap.default}
                    color={colorMap[item.id] || colorMap.default}
                    trend={item.trend}
                    trendLabel={item.trendLabel}
                    loading={loading}
                />
            ))}
        </div>
    );
};
