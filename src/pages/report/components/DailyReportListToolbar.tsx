import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCalendarAlt,
    faDownload,
    faFilter,
    faPenToSquare,
    faSave,
    faSearch,
    faSortAmountDown,
    faSortAmountUp,
    faSpinner,
    faTrash,
} from '@fortawesome/free-solid-svg-icons';

export type DailyReportDatePresetKey = 'prevMonth' | 'thisMonth' | 'yesterday' | 'today';
export type DailyReportSortMode = 'date' | 'name' | 'site';
export type DailyReportSortOrder = 'asc' | 'desc';

export interface DailyReportToolbarOption {
    value: string;
    label: string;
}

export interface DailyReportToolbarPreset {
    key: DailyReportDatePresetKey;
    label: string;
    start: string;
    end: string;
    active: boolean;
}

interface DailyReportListToolbarProps {
    startDateInput: string;
    endDateInput: string;
    presets: DailyReportToolbarPreset[];
    siteOptions: DailyReportToolbarOption[];
    reportTeamOptions: DailyReportToolbarOption[];
    workerTeamOptions: DailyReportToolbarOption[];
    selectedSiteId: string;
    selectedTeamId: string;
    selectedWorkerTeamId: string;
    workerSearch: string;
    activeFilterLabels: string[];
    sortMode: DailyReportSortMode;
    dateSortOrder: DailyReportSortOrder;
    nameSortOrder: DailyReportSortOrder;
    siteSortOrder: DailyReportSortOrder;
    isEditMode: boolean;
    showSiteDetailColumns: boolean;
    selectedRowCount: number;
    dirtyRowCount: number;
    isSearchDisabled: boolean;
    isTransferBusy: boolean;
    isDownloadingExcel: boolean;
    onStartDateChange: (value: string) => void;
    onEndDateChange: (value: string) => void;
    onDateBlur: (field: 'start' | 'end') => void;
    onPresetSelect: (key: DailyReportDatePresetKey) => void;
    onSiteChange: (value: string) => void;
    onReportTeamChange: (value: string) => void;
    onWorkerTeamChange: (value: string) => void;
    onWorkerSearchChange: (value: string) => void;
    onClearFilters: () => void;
    onToggleSort: (mode: DailyReportSortMode) => void;
    onToggleEditMode: () => void;
    onToggleSiteDetails: () => void;
    onOpenBulkEdit: () => void;
    onBulkDelete: () => void;
    onSearch: () => void;
    onDownloadExcel: () => void;
    onSaveAll: () => void;
}

const DailyReportListToolbar: React.FC<DailyReportListToolbarProps> = ({
    startDateInput,
    endDateInput,
    presets,
    siteOptions,
    reportTeamOptions,
    workerTeamOptions,
    selectedSiteId,
    selectedTeamId,
    selectedWorkerTeamId,
    workerSearch,
    activeFilterLabels,
    sortMode,
    dateSortOrder,
    nameSortOrder,
    siteSortOrder,
    isEditMode,
    showSiteDetailColumns,
    selectedRowCount,
    dirtyRowCount,
    isSearchDisabled,
    isTransferBusy,
    isDownloadingExcel,
    onStartDateChange,
    onEndDateChange,
    onDateBlur,
    onPresetSelect,
    onSiteChange,
    onReportTeamChange,
    onWorkerTeamChange,
    onWorkerSearchChange,
    onClearFilters,
    onToggleSort,
    onToggleEditMode,
    onToggleSiteDetails,
    onOpenBulkEdit,
    onBulkDelete,
    onSearch,
    onDownloadExcel,
    onSaveAll,
}) => {
    const handleDateKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        onSearch();
    };

    return (
        <div className="daily-report-v2-toolbar flex-shrink-0 bg-white px-3 py-2.5 rounded-xl shadow-sm border border-slate-200">
            <div className="daily-report-v2-toolbar-main">
                <section className="daily-report-v2-toolbar-section daily-report-v2-date-section" aria-label="조회 기간">
                    <span className="daily-report-v2-section-label">조회 기간</span>
                    <div className="daily-report-v2-date-inputs">
                        <div className="relative">
                            <FontAwesomeIcon icon={faCalendarAlt} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                inputMode="numeric"
                                value={startDateInput}
                                onChange={(event) => onStartDateChange(event.target.value)}
                                onBlur={() => onDateBlur('start')}
                                onKeyDown={handleDateKeyDown}
                                aria-label="조회 시작일"
                                placeholder="YYYY-MM-DD"
                                className="pl-10 pr-3 py-2 border-slate-300 rounded-lg text-sm w-[130px]"
                            />
                        </div>
                        <span className="text-slate-400">~</span>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={endDateInput}
                            onChange={(event) => onEndDateChange(event.target.value)}
                            onBlur={() => onDateBlur('end')}
                            onKeyDown={handleDateKeyDown}
                            aria-label="조회 종료일"
                            placeholder="YYYY-MM-DD"
                            className="px-3 py-2 border-slate-300 rounded-lg text-sm w-[130px]"
                        />
                    </div>
                    <div className="daily-report-v2-preset-group" role="group" aria-label="빠른 날짜 선택">
                        {presets.map((preset) => (
                            <button
                                key={preset.key}
                                type="button"
                                onClick={() => onPresetSelect(preset.key)}
                                aria-pressed={preset.active}
                                title={`${preset.label} 기간 선택: ${preset.start} ~ ${preset.end}`}
                                className={`daily-report-v2-preset-btn px-2.5 py-1.5 text-xs rounded-lg font-semibold border transition-colors ${preset.active
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                </section>

                <section className="daily-report-v2-toolbar-section daily-report-v2-filter-section" aria-label="목록 필터">
                    <span className="daily-report-v2-section-label">상세 필터</span>
                    <ToolbarSelect label="현장" value={selectedSiteId} options={siteOptions} onChange={onSiteChange} />
                    <ToolbarSelect label="현장소속팀" value={selectedTeamId} options={reportTeamOptions} onChange={onReportTeamChange} />
                    <ToolbarSelect label="작업자 소속팀" value={selectedWorkerTeamId} options={workerTeamOptions} onChange={onWorkerTeamChange} />
                    <label className="daily-report-v2-field daily-report-v2-worker-search-field">
                        <span>작업자</span>
                        <div className="relative daily-report-v2-worker-search">
                            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={workerSearch}
                                onChange={(event) => onWorkerSearchChange(event.target.value)}
                                aria-label="작업자 이름 검색"
                                placeholder="작업자 검색"
                                className="w-full pl-10 pr-4 py-2 border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                            />
                        </div>
                    </label>
                    {activeFilterLabels.length > 0 && (
                        <button type="button" onClick={onClearFilters} className="daily-report-v2-filter-reset">필터 초기화</button>
                    )}
                </section>

                <section className="daily-report-v2-toolbar-section daily-report-v2-sort-section" aria-label="정렬 및 수정 도구">
                    <span className="daily-report-v2-section-label">정렬·보기</span>
                    <div className="daily-report-v2-sort-controls">
                        <SortButton label="날짜" mode="date" activeMode={sortMode} order={dateSortOrder} onToggle={onToggleSort} tone="indigo" />
                        <SortButton label="이름순" mode="name" activeMode={sortMode} order={nameSortOrder} onToggle={onToggleSort} tone="emerald" />
                        <SortButton label="현장순" mode="site" activeMode={sortMode} order={siteSortOrder} onToggle={onToggleSort} tone="amber" />
                        <button
                            type="button"
                            onClick={onToggleEditMode}
                            aria-pressed={isEditMode}
                            className={`daily-report-v2-tool-btn flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold shadow-sm border transition-colors ${isEditMode
                                ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                        >
                            <FontAwesomeIcon icon={faPenToSquare} />
                            {isEditMode ? '수정 종료' : '수정모드'}
                        </button>
                        <button
                            type="button"
                            onClick={onToggleSiteDetails}
                            aria-pressed={showSiteDetailColumns}
                            className={`daily-report-v2-tool-btn flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold shadow-sm border transition-colors ${showSiteDetailColumns
                                ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                        >
                            <FontAwesomeIcon icon={faFilter} />
                            현장상세
                        </button>
                        {isEditMode && (
                            <>
                                <button
                                    type="button"
                                    onClick={onOpenBulkEdit}
                                    disabled={selectedRowCount === 0}
                                    className={`daily-report-v2-tool-btn px-4 py-2 rounded-lg text-sm font-bold shadow-sm border transition-colors ${selectedRowCount > 0
                                        ? 'bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200'
                                        : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'}`}
                                >
                                    일괄수정 ({selectedRowCount})
                                </button>
                                <button
                                    type="button"
                                    onClick={onBulkDelete}
                                    disabled={selectedRowCount === 0}
                                    className={`daily-report-v2-tool-btn flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold shadow-sm border transition-colors ${selectedRowCount > 0
                                        ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'
                                        : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'}`}
                                >
                                    <FontAwesomeIcon icon={faTrash} />
                                    삭제
                                </button>
                            </>
                        )}
                    </div>
                </section>

                <section className="daily-report-v2-toolbar-actions" aria-label="조회 작업">
                    <button
                        type="button"
                        onClick={onSearch}
                        disabled={isSearchDisabled}
                        className="daily-report-v2-primary-action bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 transition-transform active:scale-95"
                    >
                        <FontAwesomeIcon icon={faSearch} />
                        조회
                    </button>
                    <button
                        type="button"
                        onClick={onDownloadExcel}
                        disabled={isTransferBusy}
                        className={`daily-report-v2-secondary-action flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold shadow-sm border transition-colors ${isTransferBusy
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}
                    >
                        <FontAwesomeIcon icon={isDownloadingExcel ? faSpinner : faDownload} spin={isDownloadingExcel} />
                        엑셀 다운로드
                    </button>
                    {isEditMode && (
                        <button
                            type="button"
                            onClick={onSaveAll}
                            disabled={isSearchDisabled || dirtyRowCount === 0}
                            className={`daily-report-v2-secondary-action px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 border transition-colors ${dirtyRowCount > 0
                                ? 'bg-red-500 hover:bg-red-600 text-white border-red-500'
                                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'}`}
                        >
                            <FontAwesomeIcon icon={faSave} />
                            전체 저장 ({dirtyRowCount})
                        </button>
                    )}
                </section>
            </div>

            {activeFilterLabels.length > 0 && (
                <div className="daily-report-v2-active-filter-row" aria-label="적용 중인 필터">
                    <span>적용 조건</span>
                    {activeFilterLabels.map((label) => <b key={label}>{label}</b>)}
                </div>
            )}
            {isEditMode && (
                <div className="mt-2 flex w-full items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-indigo-50 px-2 py-1 font-semibold text-indigo-600">수정중</span>
                    <span>변경분은 각 행 저장 또는 상단 전체 저장으로 반영됩니다.</span>
                </div>
            )}
        </div>
    );
};

interface ToolbarSelectProps {
    label: string;
    value: string;
    options: DailyReportToolbarOption[];
    onChange: (value: string) => void;
}

const ToolbarSelect: React.FC<ToolbarSelectProps> = ({ label, value, options, onChange }) => (
    <label className="daily-report-v2-field">
        <span>{label}</span>
        <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-label={`${label} 필터`}
            className="daily-report-v2-select px-3 py-2 border-slate-300 rounded-lg text-sm"
        >
            {options.map((option) => <option key={option.value || `all-${label}`} value={option.value}>{option.label}</option>)}
        </select>
    </label>
);

interface SortButtonProps {
    label: string;
    mode: DailyReportSortMode;
    activeMode: DailyReportSortMode;
    order: DailyReportSortOrder;
    tone: 'indigo' | 'emerald' | 'amber';
    onToggle: (mode: DailyReportSortMode) => void;
}

const SortButton: React.FC<SortButtonProps> = ({ label, mode, activeMode, order, tone, onToggle }) => {
    const activeTone = {
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        amber: 'bg-amber-50 text-amber-700 border-amber-100',
    }[tone];
    const orderLabel = mode === 'date'
        ? (order === 'desc' ? '최신순' : '오래된순')
        : (order === 'asc' ? '오름차순' : '내림차순');

    return (
        <button
            type="button"
            onClick={() => onToggle(mode)}
            aria-label={`${label} ${orderLabel} 정렬`}
            aria-pressed={activeMode === mode}
            className={`daily-report-v2-sort-btn flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${activeMode === mode
                ? activeTone
                : 'bg-slate-50 text-slate-600 border-slate-200'}`}
        >
            {mode === 'date' && <FontAwesomeIcon icon={order === 'desc' ? faSortAmountDown : faSortAmountUp} />}
            <span className="text-xs font-bold">{label}</span>
            {mode !== 'date' && <FontAwesomeIcon icon={order === 'asc' ? faSortAmountUp : faSortAmountDown} />}
        </button>
    );
};

export default React.memo(DailyReportListToolbar);
