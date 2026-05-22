import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCheck,
    faCog,
    faRotateLeft,
    faSave,
    faSearch,
    faTimes,
} from '@fortawesome/free-solid-svg-icons';
import type { DashboardWidgetDefinition } from './useDashboardWidgetSettings';

interface WeatherLocationOption {
    key: string;
    label: string;
}

interface DashboardWidgetSettingsModalProps {
    isOpen: boolean;
    modeLabel: string;
    widgets: DashboardWidgetDefinition[];
    selectedKeys: string[];
    defaultSelectedKeys: string[];
    hasPersonalSelection: boolean;
    saving: boolean;
    maxWidgets: number;
    weatherLocationKey?: string;
    weatherLocationOptions?: WeatherLocationOption[];
    onClose: () => void;
    onSave: (keys: string[], options?: { weatherLocationKey?: string }) => Promise<void>;
    onReset: () => Promise<void>;
}

const getWidgetKindLabel = (kind: DashboardWidgetDefinition['kind']): string => {
    if (kind === 'weather') return '날씨 위젯';
    if (kind === 'summary') return '요약 위젯';
    return '순위 위젯';
};

const includesSearch = (widget: DashboardWidgetDefinition, searchTerm: string): boolean => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return true;

    return [
        widget.label,
        widget.desc,
        widget.scopeLabel,
        getWidgetKindLabel(widget.kind),
    ].some((value) => String(value || '').toLowerCase().includes(keyword));
};

export const DashboardWidgetSettingsModal: React.FC<DashboardWidgetSettingsModalProps> = ({
    isOpen,
    modeLabel,
    widgets,
    selectedKeys,
    defaultSelectedKeys,
    hasPersonalSelection,
    saving,
    maxWidgets,
    weatherLocationKey = 'seoul',
    weatherLocationOptions = [],
    onClose,
    onSave,
    onReset,
}) => {
    const [draftKeys, setDraftKeys] = useState<string[]>(selectedKeys);
    const [draftWeatherLocationKey, setDraftWeatherLocationKey] = useState(weatherLocationKey);
    const [searchTerm, setSearchTerm] = useState('');
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setDraftKeys(selectedKeys.length > 0 ? selectedKeys : defaultSelectedKeys);
        setDraftWeatherLocationKey(weatherLocationKey);
        setSearchTerm('');
        setMessage(null);
    }, [defaultSelectedKeys, isOpen, selectedKeys, weatherLocationKey]);

    const filteredWidgets = useMemo(() => {
        return widgets.filter((widget) => includesSearch(widget, searchTerm));
    }, [searchTerm, widgets]);

    const selectedOrder = useMemo(() => {
        return new Map(draftKeys.map((key, index) => [key, index + 1]));
    }, [draftKeys]);

    const hasWeatherWidget = useMemo(() => (
        widgets.some((widget) => widget.kind === 'weather')
    ), [widgets]);
    const isWeatherSelected = draftKeys.includes('weather-forecast');

    if (!isOpen) return null;

    const toggleWidget = (widgetKey: string) => {
        setMessage(null);
        setDraftKeys((current) => {
            if (current.includes(widgetKey)) {
                return current.filter((key) => key !== widgetKey);
            }

            if (current.length >= maxWidgets) {
                setMessage(`대시보드 위젯은 최대 ${maxWidgets}개까지 표시할 수 있습니다.`);
                return current;
            }

            return [...current, widgetKey];
        });
    };

    const handleSave = async () => {
        if (draftKeys.length === 0) {
            setMessage('최소 1개 이상의 위젯을 선택하세요.');
            return;
        }

        try {
            await onSave(draftKeys, { weatherLocationKey: draftWeatherLocationKey });
            onClose();
        } catch (error) {
            console.error('[DashboardWidgetSettingsModal] Save failed:', error);
            setMessage('위젯 설정 저장에 실패했습니다.');
        }
    };

    const handleReset = async () => {
        try {
            await onReset();
            onClose();
        } catch (error) {
            console.error('[DashboardWidgetSettingsModal] Reset failed:', error);
            setMessage('기본 설정으로 되돌리지 못했습니다.');
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
            <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
                    <div>
                        <div className="flex items-center gap-2 text-lg font-bold text-slate-900">
                            <FontAwesomeIcon icon={faCog} className="text-indigo-600" />
                            대시보드 위젯 설정
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                            {modeLabel} 화면에서 표시할 위젯을 선택합니다.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                        aria-label="닫기"
                    >
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>

                <div className="border-b border-slate-100 px-5 py-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="relative md:w-80">
                            <FontAwesomeIcon
                                icon={faSearch}
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400"
                            />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="위젯명 검색"
                                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                            />
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <span className="rounded-full bg-indigo-50 px-3 py-1 font-bold text-indigo-700">
                                선택 {draftKeys.length}/{maxWidgets}
                            </span>
                            <button
                                type="button"
                                onClick={handleReset}
                                disabled={!hasPersonalSelection || saving}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <FontAwesomeIcon icon={faRotateLeft} />
                                기본값
                            </button>
                        </div>
                    </div>
                    {message && (
                        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
                            {message}
                        </div>
                    )}
                    {hasWeatherWidget && weatherLocationOptions.length > 0 && (
                        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <div className="text-sm font-bold text-slate-800">날씨 지역</div>
                                <div className="text-xs text-slate-500">
                                    날씨 위젯을 선택하면 이 지역의 현재 날씨와 예보가 표시됩니다.
                                </div>
                            </div>
                            <select
                                value={draftWeatherLocationKey}
                                onChange={(event) => setDraftWeatherLocationKey(event.target.value)}
                                disabled={!isWeatherSelected}
                                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                            >
                                {weatherLocationOptions.map((option) => (
                                    <option key={option.key} value={option.key}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {filteredWidgets.length > 0 ? (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {filteredWidgets.map((widget) => {
                                const isSelected = draftKeys.includes(widget.key);
                                const order = selectedOrder.get(widget.key);

                                return (
                                    <button
                                        key={widget.key}
                                        type="button"
                                        onClick={() => toggleWidget(widget.key)}
                                        className={`flex min-h-[96px] items-start gap-3 rounded-xl border p-4 text-left transition ${
                                            isSelected
                                                ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        <span
                                            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs ${
                                                isSelected
                                                    ? 'border-indigo-600 bg-indigo-600 text-white'
                                                    : 'border-slate-300 bg-white text-transparent'
                                            }`}
                                        >
                                            <FontAwesomeIcon icon={faCheck} />
                                        </span>
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm">
                                            <FontAwesomeIcon icon={widget.icon} />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-start justify-between gap-2">
                                                <span className="line-clamp-1 font-bold text-slate-900">{widget.label}</span>
                                                {order && (
                                                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-indigo-700">
                                                        {order}
                                                    </span>
                                                )}
                                            </span>
                                            <span className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{widget.desc}</span>
                                            <span className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-slate-400">
                                                <span>{getWidgetKindLabel(widget.kind)}</span>
                                                {widget.scopeLabel && (
                                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
                                                        {widget.scopeLabel}
                                                    </span>
                                                )}
                                            </span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">
                            선택할 수 있는 위젯이 없습니다.
                        </div>
                    )}
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || draftKeys.length === 0}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={faSave} />
                        {saving ? '저장 중...' : '저장'}
                    </button>
                </div>
            </div>
        </div>
    );
};
