import { useCallback, useEffect, useMemo, useState } from 'react';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
    faBuilding,
    faCalendarDay,
    faChartLine,
    faClipboardList,
    faCloud,
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

export type DashboardWidgetKind = 'summary' | 'ranking' | 'weather';
export type DashboardWidgetValueFormat = 'manDay' | 'integer';

export interface DashboardWidgetDefinition {
    key: string;
    label: string;
    desc: string;
    kind: DashboardWidgetKind;
    icon: IconDefinition;
    color: 'blue' | 'emerald' | 'amber' | 'violet' | 'cyan' | 'rose';
    scopeLabel?: '전체' | '팀별' | '현장별' | '작업자별' | '날씨';
    valueFormat?: DashboardWidgetValueFormat;
    valueUnit?: string;
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
    weatherLocationKey: string;
    saveSelection: (keys: string[], options?: { weatherLocationKey?: string }) => Promise<void>;
    resetSelection: () => Promise<void>;
}

export const MAX_DASHBOARD_WIDGETS = 9;
const DEFAULT_WEATHER_LOCATION_KEY = 'seoul';

const TEAM_DASHBOARD_WIDGET_DEFINITIONS: DashboardWidgetDefinition[] = [
    {
        key: 'recent-total-manday',
        label: '우리팀 최근 총공수',
        desc: '소속 팀의 가장 최근 출력일 기준 총 공수',
        kind: 'summary',
        icon: faCalendarDay,
        color: 'blue',
        scopeLabel: '팀별',
    },
    {
        key: 'registered-workers',
        label: '우리팀 등록 작업자',
        desc: '소속 팀에 등록된 작업자와 재직 인원',
        kind: 'summary',
        icon: faUsers,
        color: 'emerald',
        scopeLabel: '팀별',
    },
    {
        key: 'registered-sites',
        label: '우리팀 등록 현장',
        desc: '소속 팀이 담당하는 등록 현장',
        kind: 'summary',
        icon: faBuilding,
        color: 'amber',
        scopeLabel: '팀별',
    },
    {
        key: 'site-month-manday',
        label: '우리팀 현장별 이달 총공수',
        desc: '소속 팀 기준 현장별 공수 상위 목록',
        kind: 'ranking',
        icon: faBuilding,
        color: 'violet',
        scopeLabel: '현장별',
        valueFormat: 'manDay',
        valueUnit: '공',
    },
    {
        key: 'worker-month-manday',
        label: '우리팀 작업자별 이달 총공수',
        desc: '소속 팀 기준 작업자별 공수 상위 목록',
        kind: 'ranking',
        icon: faHardHat,
        color: 'cyan',
        scopeLabel: '작업자별',
        valueFormat: 'manDay',
        valueUnit: '공',
    },
    {
        key: 'team-month-manday',
        label: '우리팀 이달 총공수',
        desc: '소속 팀의 이번 달 누적 공수',
        kind: 'summary',
        icon: faListCheck,
        color: 'rose',
        scopeLabel: '팀별',
    },
];

const OVERALL_DASHBOARD_WIDGET_DEFINITIONS: DashboardWidgetDefinition[] = [
    {
        key: 'recent-total-manday',
        label: '전체 최근 총공수',
        desc: '가장 최근 출력일 기준 총 공수',
        kind: 'summary',
        icon: faCalendarDay,
        color: 'blue',
        scopeLabel: '전체',
    },
    {
        key: 'registered-workers',
        label: '전체 등록 작업자',
        desc: '등록된 작업자와 재직 인원',
        kind: 'summary',
        icon: faUsers,
        color: 'emerald',
        scopeLabel: '전체',
    },
    {
        key: 'registered-sites',
        label: '전체 등록 현장',
        desc: '등록된 현장과 진행 현장',
        kind: 'summary',
        icon: faBuilding,
        color: 'amber',
        scopeLabel: '전체',
    },
    {
        key: 'registered-teams',
        label: '전체 등록 팀',
        desc: '운영 중인 팀과 시스템 등록 팀',
        kind: 'summary',
        icon: faHardHat,
        color: 'cyan',
        scopeLabel: '전체',
    },
    {
        key: 'today-total-manday',
        label: '오늘 총공수',
        desc: '오늘 입력된 일보 기준 전체 공수',
        kind: 'summary',
        icon: faCalendarDay,
        color: 'rose',
        scopeLabel: '전체',
    },
    {
        key: 'site-month-manday',
        label: '현장별 이달 총공수',
        desc: '이번 달 현장별 공수 상위 목록',
        kind: 'ranking',
        icon: faBuilding,
        color: 'violet',
        scopeLabel: '현장별',
        valueFormat: 'manDay',
        valueUnit: '공',
    },
    {
        key: 'worker-month-manday',
        label: '작업자별 이달 총공수',
        desc: '이번 달 작업자별 공수 상위 목록',
        kind: 'ranking',
        icon: faHardHat,
        color: 'cyan',
        scopeLabel: '작업자별',
        valueFormat: 'manDay',
        valueUnit: '공',
    },
    {
        key: 'team-month-manday',
        label: '전체 이달 총공수',
        desc: '이번 달 전체 누적 공수',
        kind: 'summary',
        icon: faListCheck,
        color: 'rose',
        scopeLabel: '전체',
    },
    {
        key: 'team-month-manday-ranking',
        label: '팀별 이달 총공수',
        desc: '이번 달 팀별 공수 상위 목록',
        kind: 'ranking',
        icon: faChartLine,
        color: 'blue',
        scopeLabel: '팀별',
        valueFormat: 'manDay',
        valueUnit: '공',
    },
    {
        key: 'team-active-workers',
        label: '팀별 재직 작업자',
        desc: '팀별 현재 재직 작업자 상위 목록',
        kind: 'ranking',
        icon: faUsers,
        color: 'emerald',
        scopeLabel: '팀별',
        valueFormat: 'integer',
        valueUnit: '명',
    },
    {
        key: 'site-worker-count',
        label: '현장별 투입 인원',
        desc: '이번 달 현장별 실제 투입 작업자 수',
        kind: 'ranking',
        icon: faBuilding,
        color: 'amber',
        scopeLabel: '현장별',
        valueFormat: 'integer',
        valueUnit: '명',
    },
    {
        key: 'site-report-count',
        label: '현장별 일보 건수',
        desc: '이번 달 현장별 저장된 일보 건수',
        kind: 'ranking',
        icon: faClipboardList,
        color: 'violet',
        scopeLabel: '현장별',
        valueFormat: 'integer',
        valueUnit: '건',
    },
    {
        key: 'month-report-count',
        label: '이달 일보 건수',
        desc: '이번 달 전체 저장 일보 수',
        kind: 'summary',
        icon: faClipboardList,
        color: 'blue',
        scopeLabel: '전체',
    },
    {
        key: 'weather-forecast',
        label: '날씨 위젯',
        desc: '선택한 지역의 현재 날씨와 5일 예보',
        kind: 'weather',
        icon: faCloud,
        color: 'cyan',
        scopeLabel: '날씨',
    },
];

export const DASHBOARD_WIDGET_DEFINITIONS = TEAM_DASHBOARD_WIDGET_DEFINITIONS;

export const isOverallDashboardWidgetScope = (modeConfig: DashboardModeConfig): boolean => {
    if (modeConfig.id === 'executive' || modeConfig.id === 'manager') return true;

    const label = `${modeConfig.label || ''} ${modeConfig.shortLabel || ''} ${modeConfig.roleGroup || ''}`.toLowerCase();
    return ['관리자', '사무', '사장', '대표', '실장', '매니저', '메니저', 'admin', 'administrator', 'office', 'manager', 'ceo', 'owner']
        .some((keyword) => label.includes(keyword.toLowerCase()));
};

const DEFAULT_TEAM_DASHBOARD_WIDGET_KEYS = TEAM_DASHBOARD_WIDGET_DEFINITIONS.map((widget) => widget.key);
const DEFAULT_OVERALL_DASHBOARD_WIDGET_KEYS = [
    'recent-total-manday',
    'registered-workers',
    'registered-sites',
    'team-month-manday',
    'team-month-manday-ranking',
    'site-month-manday',
    'site-worker-count',
    'weather-forecast',
];

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
    const defaultSelectedKeys = (isOverallDashboardWidgetScope(modeConfig)
        ? DEFAULT_OVERALL_DASHBOARD_WIDGET_KEYS
        : DEFAULT_TEAM_DASHBOARD_WIDGET_KEYS
    ).slice(0, MAX_DASHBOARD_WIDGETS);
    const selectedKeys = hasPersonalSelection ? validSavedKeys : defaultSelectedKeys;
    const weatherLocationKey = preferences[positionKey]?.weatherLocationKey || DEFAULT_WEATHER_LOCATION_KEY;
    const widgets = selectedKeys
        .map((key) => widgetByKey.get(key))
        .filter((widget): widget is DashboardWidgetDefinition => Boolean(widget));

    const saveSelection = useCallback(async (keys: string[], options: { weatherLocationKey?: string } = {}) => {
        const uid = currentUser?.uid;
        if (!uid) throw new Error('missing-user');

        const cleanedKeys = Array.from(new Set(keys))
            .filter((key) => widgetByKey.has(key))
            .slice(0, MAX_DASHBOARD_WIDGETS);

        if (cleanedKeys.length === 0) throw new Error('empty-selection');

        setSaving(true);
        try {
            await dashboardWidgetPreferenceService.savePositionSelection(uid, positionId, cleanedKeys, {
                weatherLocationKey: options.weatherLocationKey || weatherLocationKey,
            });
        } finally {
            setSaving(false);
        }
    }, [currentUser?.uid, positionId, weatherLocationKey, widgetByKey]);

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
        weatherLocationKey,
        saveSelection,
        resetSelection,
    };
};
