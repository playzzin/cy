import { useCallback, useEffect, useMemo, useState } from 'react';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
    faBuilding,
    faCalendarDay,
    faHardHat,
    faListCheck,
    faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useSiteMode } from '../../contexts/SiteModeContext';
import type { DashboardModeConfig } from './roleDashboardConfig';
import {
    dashboardWidgetPreferenceService,
    type DashboardWidgetPreferenceMap,
} from '../../services/dashboardWidgetPreferenceService';

export type DashboardWidgetKind = 'summary' | 'ranking';

export interface DashboardWidgetDefinition {
    key: string;
    label: string;
    desc: string;
    kind: DashboardWidgetKind;
    icon: IconDefinition;
    color: 'blue' | 'emerald' | 'amber' | 'violet' | 'cyan' | 'rose';
}

export interface DashboardWidgetSettings {
    widgets: DashboardWidgetDefinition[];
    availableWidgets: DashboardWidgetDefinition[];
    selectedKeys: string[];
    defaultSelectedKeys: string[];
    hasPersonalSelection: boolean;
    loading: boolean;
    saving: boolean;
    maxWidgets: number;
    saveSelection: (keys: string[]) => Promise<void>;
    resetSelection: () => Promise<void>;
}

export const MAX_DASHBOARD_WIDGETS = 6;

const TEAM_DASHBOARD_WIDGET_DEFINITIONS: DashboardWidgetDefinition[] = [
    {
        key: 'recent-total-manday',
        label: '우리팀 최근 총공수',
        desc: '소속 팀의 가장 최근 출력일 기준 총 공수',
        kind: 'summary',
        icon: faCalendarDay,
        color: 'blue',
    },
    {
        key: 'registered-workers',
        label: '우리팀 등록 작업자',
        desc: '소속 팀에 등록된 작업자와 재직 인원',
        kind: 'summary',
        icon: faUsers,
        color: 'emerald',
    },
    {
        key: 'registered-sites',
        label: '우리팀 등록 현장',
        desc: '소속 팀이 담당하는 등록 현장',
        kind: 'summary',
        icon: faBuilding,
        color: 'amber',
    },
    {
        key: 'site-month-manday',
        label: '우리팀 현장별 이달 총공수',
        desc: '소속 팀 기준 현장별 공수 상위 목록',
        kind: 'ranking',
        icon: faBuilding,
        color: 'violet',
    },
    {
        key: 'worker-month-manday',
        label: '우리팀 작업자별 이달 총공수',
        desc: '소속 팀 기준 작업자별 공수 상위 목록',
        kind: 'ranking',
        icon: faHardHat,
        color: 'cyan',
    },
    {
        key: 'team-month-manday',
        label: '우리팀 이달 총공수',
        desc: '소속 팀의 이번 달 누적 공수',
        kind: 'summary',
        icon: faListCheck,
        color: 'rose',
    },
];

const OVERALL_DASHBOARD_WIDGET_DEFINITIONS: DashboardWidgetDefinition[] = [
    {
        key: 'recent-total-manday',
        label: '최근 총공수',
        desc: '가장 최근 출력일 기준 총 공수',
        kind: 'summary',
        icon: faCalendarDay,
        color: 'blue',
    },
    {
        key: 'registered-workers',
        label: '총 등록 작업자',
        desc: '등록된 작업자와 재직 인원',
        kind: 'summary',
        icon: faUsers,
        color: 'emerald',
    },
    {
        key: 'registered-sites',
        label: '총 등록 현장',
        desc: '등록된 현장과 진행 현장',
        kind: 'summary',
        icon: faBuilding,
        color: 'amber',
    },
    {
        key: 'site-month-manday',
        label: '현장별 이달 총공수',
        desc: '이번 달 현장별 공수 상위 목록',
        kind: 'ranking',
        icon: faBuilding,
        color: 'violet',
    },
    {
        key: 'worker-month-manday',
        label: '작업자별 이달 총공수',
        desc: '이번 달 작업자별 공수 상위 목록',
        kind: 'ranking',
        icon: faHardHat,
        color: 'cyan',
    },
    {
        key: 'team-month-manday',
        label: '이달 총공수',
        desc: '이번 달 전체 누적 공수',
        kind: 'summary',
        icon: faListCheck,
        color: 'rose',
    },
];

export const DASHBOARD_WIDGET_DEFINITIONS = TEAM_DASHBOARD_WIDGET_DEFINITIONS;

export const isOverallDashboardWidgetScope = (modeConfig: DashboardModeConfig): boolean => {
    if (modeConfig.id === 'executive' || modeConfig.id === 'manager') return true;

    const label = `${modeConfig.label || ''} ${modeConfig.shortLabel || ''} ${modeConfig.roleGroup || ''}`.toLowerCase();
    return ['관리자', '사무', '사장', '대표', '실장', '매니저', '메니저', 'admin', 'administrator', 'office', 'manager', 'ceo', 'owner']
        .some((keyword) => label.includes(keyword.toLowerCase()));
};

const DEFAULT_DASHBOARD_WIDGET_KEYS = TEAM_DASHBOARD_WIDGET_DEFINITIONS.map((widget) => widget.key);

const LEGACY_WIDGET_KEY_MAP: Record<string, string> = {
    'operating-teams': 'registered-sites',
};

const normalizeWidgetKey = (key: string): string => LEGACY_WIDGET_KEY_MAP[key] || key;

export const useDashboardWidgetSettings = (modeConfig: DashboardModeConfig): DashboardWidgetSettings => {
    const { currentUser } = useAuth();
    const { currentPosition } = useSiteMode();
    const [preferences, setPreferences] = useState<DashboardWidgetPreferenceMap>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const uid = currentUser?.uid;
        if (!uid) {
            setPreferences({});
            setLoading(false);
            return;
        }

        setLoading(true);
        return dashboardWidgetPreferenceService.subscribe(uid, (nextPreferences) => {
            setPreferences(nextPreferences);
            setLoading(false);
        });
    }, [currentUser?.uid]);

    const availableWidgets = isOverallDashboardWidgetScope(modeConfig)
        ? OVERALL_DASHBOARD_WIDGET_DEFINITIONS
        : TEAM_DASHBOARD_WIDGET_DEFINITIONS;

    const widgetByKey = useMemo(() => {
        return new Map(availableWidgets.map((widget) => [widget.key, widget]));
    }, [availableWidgets]);

    const positionId = currentPosition || modeConfig.id;
    const positionKey = dashboardWidgetPreferenceService.getPositionKey(positionId);
    const savedKeys = Array.from(new Set((preferences[positionKey]?.selectedKeys || []).map(normalizeWidgetKey)));
    const validSavedKeys = savedKeys.filter((key) => widgetByKey.has(key));
    const hasPersonalSelection = validSavedKeys.length > 0;
    const defaultSelectedKeys = DEFAULT_DASHBOARD_WIDGET_KEYS.slice(0, MAX_DASHBOARD_WIDGETS);
    const selectedKeys = hasPersonalSelection ? validSavedKeys : defaultSelectedKeys;
    const widgets = selectedKeys
        .map((key) => widgetByKey.get(key))
        .filter((widget): widget is DashboardWidgetDefinition => Boolean(widget));

    const saveSelection = useCallback(async (keys: string[]) => {
        const uid = currentUser?.uid;
        if (!uid) throw new Error('missing-user');

        const cleanedKeys = Array.from(new Set(keys))
            .filter((key) => widgetByKey.has(key))
            .slice(0, MAX_DASHBOARD_WIDGETS);

        if (cleanedKeys.length === 0) throw new Error('empty-selection');

        setSaving(true);
        try {
            await dashboardWidgetPreferenceService.savePositionSelection(uid, positionId, cleanedKeys);
        } finally {
            setSaving(false);
        }
    }, [currentUser?.uid, positionId, widgetByKey]);

    const resetSelection = useCallback(async () => {
        const uid = currentUser?.uid;
        if (!uid) throw new Error('missing-user');

        setSaving(true);
        try {
            await dashboardWidgetPreferenceService.resetPositionSelection(uid, positionId);
        } finally {
            setSaving(false);
        }
    }, [currentUser?.uid, positionId]);

    return {
        widgets,
        availableWidgets,
        selectedKeys,
        defaultSelectedKeys,
        hasPersonalSelection,
        loading,
        saving,
        maxWidgets: MAX_DASHBOARD_WIDGETS,
        saveSelection,
        resetSelection,
    };
};
