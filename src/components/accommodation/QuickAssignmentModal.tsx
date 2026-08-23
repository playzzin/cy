import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowRightFromBracket,
    faBuilding,
    faCheck,
    faClipboardCheck,
    faFileInvoiceDollar,
    faPen,
    faSearch,
    faTimes,
    faTrash,
    faUser,
    faUsers
} from '@fortawesome/free-solid-svg-icons';
import { Accommodation } from '../../types/accommodation';
import { AccommodationAssignment } from '../../types/accommodationAssignment';
import { formatTypedDateInput, normalizeTypedDateInput, toShortYearDateInputValue } from '../../utils/typedDateInput';
import { BillingModeSelector, BillingStatusSummary } from '../support/BillingModeSelector';
import BillingPeriodTimeline, { BillingPeriodTimelineItem } from '../support/BillingPeriodTimeline';
import { useAccommodationQuickAssignment } from './useAccommodationQuickAssignment';

interface Props {
    accommodation: Accommodation;
    activeAssignments: AccommodationAssignment[];
    assignmentHistory?: AccommodationAssignment[];
    isOpen: boolean;
    initialBillingSplitMode?: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const AccommodationQuickAssignmentModal: React.FC<Props> = ({
    accommodation,
    activeAssignments,
    assignmentHistory,
    isOpen,
    initialBillingSplitMode = false,
    onClose,
    onSuccess
}) => {
    const {
        submitting,
        billingSubmitting,
        teams,
        selectedTeamId,
        setSelectedTeamId,
        selectedAssignmentWorkerId,
        setSelectedAssignmentWorkerId,
        assignmentTargetType,
        setAssignmentTargetType,
        assignmentWorkerOptions,
        startDate,
        setStartDate,
        editingAssignmentId,
        billingTargetOptions,
        billingMode,
        setBillingMode,
        selectedBillingTargetKey,
        setSelectedBillingTargetKey,
        selectedBillingTarget,
        billingTargetRecords,
        currentBillingTarget,
        currentBillingTargetDisplay,
        handleEdit,
        handleCancelEdit,
        handleAssign,
        handleApplyBillingTarget,
        handleDeleteBillingTarget,
        handleCheckout
    } = useAccommodationQuickAssignment({
        accommodation,
        activeAssignments,
        assignmentHistory,
        isOpen,
        initialBillingSplitMode,
        onSuccess
    });
    const [assignmentWorkerSearch, setAssignmentWorkerSearch] = React.useState('');
    const normalizedAssignmentWorkerSearch = assignmentWorkerSearch.trim().toLowerCase();
    const displayDate = (value?: string | null): string => toShortYearDateInputValue(value) || '';
    const handleStartDateChange = (value: string) => {
        setStartDate(formatTypedDateInput(value, { yearDigits: 2 }));
    };
    const normalizeStartDate = () => {
        setStartDate((prev) => toShortYearDateInputValue(normalizeTypedDateInput(prev) ?? prev) || prev);
    };
    const filteredAssignmentWorkerOptions = React.useMemo(() => {
        if (!normalizedAssignmentWorkerSearch) return assignmentWorkerOptions;
        return assignmentWorkerOptions.filter((workerOption) => {
            const workerName = String(workerOption.workerName ?? '').toLowerCase();
            const teamName = String(workerOption.teamName ?? '').toLowerCase();
            return workerName.includes(normalizedAssignmentWorkerSearch) || teamName.includes(normalizedAssignmentWorkerSearch);
        });
    }, [assignmentWorkerOptions, normalizedAssignmentWorkerSearch]);
    const displayActiveAssignments = React.useMemo(() => {
        return activeAssignments.map((assignment) => {
            const isTeamAssignment = assignment.source === 'team' ||
                (!String(assignment.workerId ?? '').trim() && !String(assignment.workerName ?? '').trim());
            if (!isTeamAssignment || String(assignment.workerName ?? '').trim()) return assignment;
            return {
                ...assignment,
                workerName: assignment.teamName || '팀 이름 없음'
            };
        });
    }, [activeAssignments]);

    const canSaveAssignment = assignmentTargetType === 'team'
        ? Boolean(selectedTeamId)
        : Boolean(selectedAssignmentWorkerId);
    const billingTargetGroups = ['청연이엔지 소속팀', '작업자', '사무실', '사무실직원'];
    const activeAssignmentSummary = React.useMemo(() => {
        if (displayActiveAssignments.length === 0) return '미배정';
        const first = displayActiveAssignments[0];
        const firstLabel = first.workerName || first.teamName || '이름 없음';
        return displayActiveAssignments.length > 1
            ? `${firstLabel} 외 ${displayActiveAssignments.length - 1}명`
            : firstLabel;
    }, [displayActiveAssignments]);
    const canUseSameBillingMode = Boolean(currentBillingTarget || displayActiveAssignments.length > 0);
    const getBillingTargetTypeText = (type?: string | null) => {
        if (type === 'team') return '팀';
        if (type === 'worker') return '작업자';
        if (type === 'office') return '사무실';
        if (type === 'office_staff') return '사무실직원';
        return '청구대상';
    };
    const billingTimelineItems = React.useMemo<BillingPeriodTimelineItem[]>(() => (
        billingTargetRecords
            .slice()
            .sort((a, b) => {
                const startDiff = String(a.startDate ?? '').localeCompare(String(b.startDate ?? ''));
                if (startDiff !== 0) return startDiff;
                return String(a.id ?? '').localeCompare(String(b.id ?? ''));
            })
            .map((target) => {
                const targetName = target.targetType === 'team'
                    ? target.teamName
                    : target.targetType === 'office'
                        ? target.teamName || '사무실'
                        : target.workerName;
                return {
                    id: String(target.id ?? `${target.accommodationId}:${target.startDate}`),
                    label: String(targetName || '청구대상'),
                    typeLabel: getBillingTargetTypeText(target.targetType),
                    startDate: target.startDate,
                    endDate: target.endDate
                };
            })
    ), [billingTargetRecords]);
    const [activeSection, setActiveSection] = React.useState<'assignment' | 'billing'>(
        initialBillingSplitMode ? 'billing' : 'assignment'
    );

    React.useEffect(() => {
        if (!isOpen) {
            setAssignmentWorkerSearch('');
            return;
        }
        setActiveSection(initialBillingSplitMode ? 'billing' : 'assignment');
    }, [initialBillingSplitMode, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
                <div className="border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
                    <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h2 className="flex items-center gap-2 text-lg font-black text-slate-900 sm:text-xl">
                            <span className="bg-indigo-600 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm shadow-indigo-200 shadow-md">
                                <FontAwesomeIcon icon={activeSection === 'billing' ? faFileInvoiceDollar : faUsers} />
                            </span>
                            <span className="min-w-0 truncate">배정/청구 설정</span>
                        </h2>
                        <p className="mt-2 text-sm font-medium text-slate-500 sm:ml-10">
                            숙소 · {accommodation.name} ({accommodation.address})
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center"
                    >
                        <FontAwesomeIcon icon={faTimes} className="text-lg" />
                    </button>
                    </div>
                    <div className="mt-4 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                        <button
                            type="button"
                            onClick={() => setActiveSection('assignment')}
                            className={`min-w-0 rounded-lg px-3 py-2 text-left transition-all ${
                                activeSection === 'assignment'
                                    ? 'bg-white text-indigo-700 shadow-sm'
                                    : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
                            }`}
                        >
                            <div className="flex items-center gap-2 text-sm font-extrabold">
                                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                                    activeSection === 'assignment' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
                                }`}>
                                    1
                                </span>
                                <FontAwesomeIcon icon={faUsers} className="text-xs" />
                                <span>배정</span>
                            </div>
                            <div className="mt-0.5 hidden truncate text-[11px] font-semibold text-slate-400 sm:block">
                                숙소 입실 인원 관리
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveSection('billing')}
                            className={`min-w-0 rounded-lg px-3 py-2 text-left transition-all ${
                                activeSection === 'billing'
                                    ? 'bg-white text-indigo-700 shadow-sm'
                                    : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
                            }`}
                        >
                            <div className="flex items-center gap-2 text-sm font-extrabold">
                                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                                    activeSection === 'billing' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
                                }`}>
                                    2
                                </span>
                                <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-xs" />
                                <span>청구</span>
                            </div>
                            <div className="mt-0.5 hidden truncate text-[11px] font-semibold text-slate-400 sm:block">
                                청구대상 설정
                            </div>
                        </button>
                    </div>

                    <div className="mt-4 grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)]">
                        <BillingStatusSummary
                            items={[
                                {
                                    label: '현재 입실',
                                    value: activeAssignmentSummary,
                                    tone: displayActiveAssignments.length > 0 ? 'indigo' : 'amber'
                                },
                                {
                                    label: '현재 청구',
                                    value: currentBillingTargetDisplay,
                                    tone: currentBillingTarget ? 'indigo' : 'emerald'
                                },
                                {
                                    label: '대장 반영',
                                    value: '저장 즉시 업데이트',
                                    tone: 'emerald'
                                }
                            ]}
                        />
                        <div className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-800">
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-[11px] text-white">
                                <FontAwesomeIcon icon={faClipboardCheck} />
                            </span>
                            <div className="min-w-0">
                                <div className="text-[11px] font-extrabold opacity-70">관리대장 반영</div>
                                <div className="mt-0.5 text-xs font-bold leading-snug">
                                    저장하면 숙소 현황과 숙소 공과금/청구대장에 바로 반영됩니다.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/40">
                    <div className="grid grid-cols-1 gap-6 items-start">
                    <section className={`${activeSection === 'assignment' ? '' : 'hidden'} bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden`}>
                        <header className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <span className="w-1.5 h-5 bg-indigo-500 rounded-full" />
                                배정 인원 목록 관리
                            </h3>
                            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                                {activeAssignments.length}명
                            </span>
                        </header>

                        <div className="p-5 space-y-5">
                            {activeAssignments.length === 0 ? (
                                <div className="bg-slate-50 rounded-xl p-6 text-center text-slate-400 border border-dashed border-slate-200">
                                    현재 입실 인원이 없습니다.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {displayActiveAssignments.map((assign) => {
                                        const isTeamAssignment = assign.source === 'team' ||
                                            (!String(assign.workerId ?? '').trim() && !String(assign.workerName ?? '').trim());
                                        const targetName = isTeamAssignment
                                            ? (assign.teamName || '팀 이름 없음')
                                            : (assign.workerName || '이름 없음');
                                        const subLabel = isTeamAssignment
                                            ? '팀 배정'
                                            : `개인 배정${assign.teamName ? ` · ${assign.teamName}` : ''}`;

                                        return (
                                        <div
                                            key={assign.id || `${assign.workerId}-${assign.startDate}`}
                                            title={`${targetName} · ${subLabel}`}
                                            className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex items-center justify-between group hover:border-emerald-200"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${
                                                        isTeamAssignment ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                                                    }`}>
                                                        <FontAwesomeIcon icon={isTeamAssignment ? faUsers : faUser} />
                                                    </span>
                                                    <div className="font-bold text-slate-700 truncate">
                                                        {assign.workerName || '이름 없음'}
                                                    </div>
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1 pl-9 truncate">
                                                    팀: {assign.teamName || '팀 미지정'}
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-1 font-mono pl-9">
                                                    입실일: {displayDate(assign.startDate) || '-'}
                                                </div>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEdit(assign)}
                                                    className="text-slate-300 hover:text-indigo-500 p-2 rounded-lg hover:bg-indigo-50 transition-colors"
                                                    title="배정 수정"
                                                >
                                                    <FontAwesomeIcon icon={faPen} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => assign.id && handleCheckout(assign.id, assign.workerName || '')}
                                                    className="text-slate-300 hover:text-rose-500 p-2 rounded-lg hover:bg-rose-50 transition-colors"
                                                    title="배정 삭제(퇴실)"
                                                >
                                                    <FontAwesomeIcon icon={faArrowRightFromBracket} />
                                                </button>
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
                                <h4 className="text-sm font-bold text-slate-700">
                                    {editingAssignmentId ? '배정 수정' : '배정 등록'}
                                </h4>
                                <div className="space-y-4">
                                    <div className="inline-flex rounded-xl border border-indigo-100 bg-white p-1">
                                        <button
                                            type="button"
                                            onClick={() => setAssignmentTargetType('team')}
                                            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                                                assignmentTargetType === 'team'
                                                    ? 'bg-indigo-600 text-white shadow-sm'
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            <FontAwesomeIcon icon={faUsers} className="mr-2" />
                                            팀 배정
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAssignmentTargetType('worker')}
                                            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                                                assignmentTargetType === 'worker'
                                                    ? 'bg-indigo-600 text-white shadow-sm'
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            <FontAwesomeIcon icon={faUser} className="mr-2" />
                                            개인 배정
                                        </button>
                                    </div>

                                    {assignmentTargetType === 'team' ? (
                                        <div className="bg-white rounded-xl border border-indigo-100 p-4">
                                            <div className="text-sm font-bold text-slate-600 mb-2">배정할 팀 선택</div>
                                            {teams.length === 0 ? (
                                                <div className="text-xs text-slate-400">선택 가능한 팀이 없습니다.</div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {teams.map((team) => {
                                                        const isSelected = selectedTeamId === team.id;
                                                        return (
                                                            <button
                                                                key={`assignment-team-${team.id}`}
                                                                type="button"
                                                                onClick={() => setSelectedTeamId(team.id ?? '')}
                                                                className={`text-left px-3 py-2 rounded-lg border text-sm transition ${
                                                                    isSelected
                                                                        ? 'border-indigo-400 bg-indigo-50 text-indigo-800'
                                                                        : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/40'
                                                                }`}
                                                            >
                                                                <div className="font-bold">{team.name}</div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="bg-white rounded-xl border border-indigo-100 p-4">
                                            <div className="text-sm font-bold text-slate-600 mb-2">배정할 개인 선택</div>
                                            <div className="relative mb-2">
                                                <input
                                                    type="text"
                                                    placeholder="이름/팀명 검색"
                                                    value={assignmentWorkerSearch}
                                                    onChange={(event) => setAssignmentWorkerSearch(event.target.value)}
                                                    className="w-full pl-8 p-2 text-xs bg-slate-100 rounded-lg outline-none"
                                                />
                                                <FontAwesomeIcon
                                                    icon={faSearch}
                                                    className="absolute left-2.5 top-2.5 text-slate-400 text-xs"
                                                />
                                            </div>
                                            {filteredAssignmentWorkerOptions.length === 0 ? (
                                                <div className="text-xs text-slate-400">선택 가능한 개인이 없습니다.</div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                                                    {filteredAssignmentWorkerOptions.map((workerOption) => {
                                                        const isSelected = selectedAssignmentWorkerId === workerOption.key;
                                                        return (
                                                            <button
                                                                key={`assignment-worker-${workerOption.key}`}
                                                                type="button"
                                                                onClick={() => setSelectedAssignmentWorkerId(workerOption.key)}
                                                                className={`text-left px-3 py-2 rounded-lg border text-sm transition ${
                                                                    isSelected
                                                                        ? 'border-indigo-400 bg-indigo-50 text-indigo-800'
                                                                        : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/40'
                                                                }`}
                                                            >
                                                                <div className="font-bold flex items-center gap-1.5">
                                                                    <FontAwesomeIcon icon={faUser} className="text-[11px]" />
                                                                    {workerOption.workerName}
                                                                </div>
                                                                <div className="text-[11px] text-slate-400 mt-0.5">
                                                                    {workerOption.teamName}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1.5">배정 시작일</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={10}
                                            placeholder="YY-MM-DD"
                                            value={startDate}
                                            onChange={(event) => handleStartDateChange(event.target.value)}
                                            onBlur={normalizeStartDate}
                                            className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none text-sm font-medium bg-white"
                                        />
                                    </div>
                                </div>

                            </div>
                        </div>
                    </section>

                    <section className={`${activeSection === 'billing' ? '' : 'hidden'} bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden`}>
                        <header className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <span className="w-1.5 h-5 bg-indigo-500 rounded-full" />
                                청구 관리
                            </h3>
                        </header>

                        <div className="p-5 space-y-4">
                            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                                <div className="text-xs font-bold text-indigo-500 mb-2">현재 청구대상</div>
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${
                                            currentBillingTarget?.targetType === 'worker' || currentBillingTarget?.targetType === 'office_staff'
                                                ? 'bg-slate-200 text-slate-700'
                                                : currentBillingTarget?.targetType === 'office'
                                                    ? 'bg-slate-200 text-slate-700'
                                                    : 'bg-indigo-200 text-indigo-700'
                                        }`}>
                                            <FontAwesomeIcon icon={
                                                currentBillingTarget?.targetType === 'worker' || currentBillingTarget?.targetType === 'office_staff'
                                                    ? faUser
                                                    : currentBillingTarget?.targetType === 'office'
                                                        ? faBuilding
                                                        : faUsers
                                            } />
                                        </span>
                                        <div className="min-w-0">
                                            <div className="font-bold text-slate-700 truncate">
                                                {currentBillingTargetDisplay}
                                            </div>
                                            <div className="text-[11px] text-slate-500">
                                                {currentBillingTarget ? '전체 청구' : '청구대상 미설정'}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleDeleteBillingTarget}
                                        disabled={billingSubmitting || !currentBillingTarget}
                                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold ${
                                            billingSubmitting || !currentBillingTarget
                                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                : 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100'
                                        }`}
                                    >
                                        <FontAwesomeIcon icon={faTrash} />
                                        미청구
                                    </button>
                                </div>
                            </div>

                            {billingTimelineItems.length > 0 && (
                                <BillingPeriodTimeline
                                    items={billingTimelineItems}
                                    title="숙소 청구기간 타임라인"
                                />
                            )}

                            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                                {activeAssignments.length === 0 && (
                                    <div className="text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                        현재 입실 인원이 없어도 청구대상을 미리 지정할 수 있습니다.
                                    </div>
                                )}

                                <BillingStatusSummary
                                    items={[
                                        {
                                            label: '현재 입실',
                                            value: activeAssignmentSummary,
                                            tone: 'slate'
                                        },
                                        {
                                            label: '현재 청구대상',
                                            value: currentBillingTargetDisplay,
                                            tone: currentBillingTarget ? 'indigo' : 'emerald'
                                        },
                                        {
                                            label: '청구 기준',
                                            value: '매월 1일~말일',
                                            tone: 'amber'
                                        }
                                    ]}
                                />

                                <BillingModeSelector
                                    value={billingMode}
                                    onChange={setBillingMode}
                                    sameLabel={displayActiveAssignments.length > 0 ? '입실자와 동일' : '별도청구 해제'}
                                    sameDescription={displayActiveAssignments.length > 0 ? '현재 입실자를 기본 청구대상으로 사용' : '26-01-01 이후 별도청구 해제'}
                                    customDescription="입실자와 다른 팀/사람에게 청구"
                                    sameDisabled={!canUseSameBillingMode}
                                />

                                <div className="bg-white rounded-xl border border-indigo-100 p-4 space-y-3">
                                    {billingMode !== 'same' && (
                                    <div>
                                        <div className="text-sm font-bold text-slate-600 mb-2">청구대상 선택</div>
                                        {billingTargetOptions.length === 0 ? (
                                            <div className="text-xs text-slate-400">선택 가능한 청구대상이 없습니다.</div>
                                        ) : (
                                            <select
                                                value={selectedBillingTargetKey}
                                                onChange={(event) => setSelectedBillingTargetKey(event.target.value)}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                            >
                                                <option value="">청구대상을 선택하세요</option>
                                                {billingTargetGroups.map((group) => {
                                                    const options = billingTargetOptions.filter((option) => option.group === group);
                                                    if (options.length === 0) return null;
                                                    return (
                                                        <optgroup key={group} label={group}>
                                                            {options.map((option) => (
                                                                <option key={option.key} value={option.key}>
                                                                    {option.name}{option.detail ? ` · ${option.detail}` : ''}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    );
                                                })}
                                            </select>
                                        )}
                                        {selectedBillingTarget && (
                                            <div className="mt-1 text-[11px] font-semibold text-slate-500">
                                                {selectedBillingTarget.group} · {selectedBillingTarget.detail || selectedBillingTarget.name}
                                            </div>
                                        )}
                                    </div>
                                    )}

                                    {billingMode === 'same' && (
                                        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
                                            별도 청구대상 없이 현재 입실자 기준으로 청구합니다.
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={handleApplyBillingTarget}
                                        disabled={
                                            billingSubmitting ||
                                            (billingMode === 'same' && !canUseSameBillingMode) ||
                                            (billingMode !== 'same' && !selectedBillingTargetKey)
                                        }
                                        className={`px-5 py-2.5 rounded-xl font-bold text-sm text-white transition shadow-lg ${
                                            billingSubmitting ||
                                            (billingMode === 'same' && !canUseSameBillingMode) ||
                                            (billingMode !== 'same' && !selectedBillingTargetKey)
                                                ? 'bg-indigo-300 cursor-not-allowed shadow-none'
                                                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 hover:-translate-y-0.5'
                                        }`}
                                    >
                                        {billingSubmitting
                                            ? '처리 중...'
                                            : billingMode === 'same'
                                                ? '입실자 동일 저장'
                                                : currentBillingTarget
                                                    ? '청구대상 수정'
                                                    : '청구대상 저장'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                    </div>
                </div>

                <div className="p-5 border-t border-slate-100 bg-white flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition text-sm"
                    >
                        닫기
                    </button>
                    {activeSection === 'assignment' && editingAssignmentId && (
                        <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition text-sm"
                        >
                            수정 취소
                        </button>
                    )}
                    {activeSection === 'assignment' && (
                    <button
                        type="button"
                        onClick={handleAssign}
                        disabled={submitting || !canSaveAssignment}
                        className={`px-6 py-2.5 rounded-xl font-bold text-white transition shadow-lg flex items-center gap-2 text-sm ${
                            submitting || !canSaveAssignment
                                ? 'bg-emerald-300 cursor-not-allowed shadow-none'
                                : editingAssignmentId
                                  ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'
                                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 hover:-translate-y-0.5'
                        }`}
                    >
                        {submitting ? (
                            '저장 중...'
                        ) : (
                            <>
                                <FontAwesomeIcon icon={faCheck} />
                                {editingAssignmentId ? '배정 수정 저장' : '배정 인원 등록'}
                            </>
                        )}
                    </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AccommodationQuickAssignmentModal;
