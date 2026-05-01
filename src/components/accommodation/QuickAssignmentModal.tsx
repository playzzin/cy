import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowRightFromBracket,
    faCheck,
    faPen,
    faSearch,
    faTimes,
    faTrash,
    faUser,
    faUsers
} from '@fortawesome/free-solid-svg-icons';
import { Accommodation } from '../../types/accommodation';
import { AccommodationAssignment } from '../../types/accommodationAssignment';
import { useAccommodationQuickAssignment } from './useAccommodationQuickAssignment';

interface Props {
    accommodation: Accommodation;
    activeAssignments: AccommodationAssignment[];
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const AccommodationQuickAssignmentModal: React.FC<Props> = ({
    accommodation,
    activeAssignments,
    isOpen,
    onClose,
    onSuccess
}) => {
    const {
        submitting,
        billingSubmitting,
        teams,
        selectedTeamId,
        setSelectedTeamId,
        workerSearch,
        setWorkerSearch,
        selectedWorkerIds,
        startDate,
        setStartDate,
        editingAssignmentId,
        filteredWorkers,
        billingTargetType,
        billingTeamId,
        setBillingTeamId,
        billingTargetWorkerId,
        setBillingTargetWorkerId,
        billingTeamOptions,
        billingWorkerOptions,
        currentBillingTarget,
        currentBillingTargetDisplay,
        selectTeamBillingTarget,
        selectWorkerBillingTarget,
        handleToggleWorker,
        handleEdit,
        handleCancelEdit,
        handleAssign,
        handleApplyBillingTarget,
        handleDeleteBillingTarget,
        handleCheckout
    } = useAccommodationQuickAssignment({
        accommodation,
        activeAssignments,
        isOpen,
        onSuccess
    });
    const [billingWorkerSearch, setBillingWorkerSearch] = React.useState('');
    const normalizedBillingWorkerSearch = billingWorkerSearch.trim().toLowerCase();
    const filteredBillingWorkerOptions = React.useMemo(() => {
        if (!normalizedBillingWorkerSearch) return billingWorkerOptions;
        return billingWorkerOptions.filter((workerOption) => {
            const workerName = String(workerOption.workerName ?? '').toLowerCase();
            const teamName = String(workerOption.teamName ?? '').toLowerCase();
            return workerName.includes(normalizedBillingWorkerSearch) || teamName.includes(normalizedBillingWorkerSearch);
        });
    }, [billingWorkerOptions, normalizedBillingWorkerSearch]);

    React.useEffect(() => {
        if (!isOpen) {
            setBillingWorkerSearch('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <span className="bg-indigo-600 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm shadow-indigo-200 shadow-md">
                                <FontAwesomeIcon icon={faUsers} />
                            </span>
                            숙소 배정/청구관리
                        </h2>
                        <p className="text-sm text-slate-500 mt-1 ml-10">
                            {accommodation.name} ({accommodation.address})
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

                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/40">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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
                                    {activeAssignments.map((assign) => (
                                        <div
                                            key={assign.id || `${assign.workerId}-${assign.startDate}`}
                                            className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex items-center justify-between group hover:border-emerald-200"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">
                                                        <FontAwesomeIcon icon={faUser} />
                                                    </span>
                                                    <div className="font-bold text-slate-700 truncate">
                                                        {assign.workerName || '이름 없음'}
                                                    </div>
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1 pl-9 truncate">
                                                    팀: {assign.teamName || '팀 미지정'}
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-1 font-mono pl-9">
                                                    입실일: {assign.startDate || '-'}
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
                                    ))}
                                </div>
                            )}

                            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
                                <h4 className="text-sm font-bold text-slate-700">
                                    {editingAssignmentId ? '배정 수정' : '배정 등록'}
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1.5">배정 팀</label>
                                        <select
                                            value={selectedTeamId}
                                            onChange={(event) => setSelectedTeamId(event.target.value)}
                                            className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none text-sm font-medium bg-white"
                                        >
                                            <option value="">팀 선택...</option>
                                            {teams.map((team) => (
                                                <option key={team.id} value={team.id}>
                                                    {team.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1.5">입실일</label>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(event) => setStartDate(event.target.value)}
                                            className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none text-sm font-medium bg-white"
                                        />
                                    </div>
                                </div>

                                {selectedTeamId && (
                                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <h5 className="text-sm font-bold text-slate-600">배정 인원 선택</h5>
                                            <div className="relative w-52">
                                                <input
                                                    type="text"
                                                    placeholder="이름 검색"
                                                    value={workerSearch}
                                                    onChange={(event) => setWorkerSearch(event.target.value)}
                                                    className="w-full pl-8 p-1.5 text-xs bg-slate-100 rounded-lg outline-none"
                                                />
                                                <FontAwesomeIcon
                                                    icon={faSearch}
                                                    className="absolute left-2.5 top-2 text-slate-400 text-xs"
                                                />
                                            </div>
                                        </div>
                                        <div className="max-h-52 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {filteredWorkers.map((worker) => {
                                                const workerId = worker.id || '';
                                                const isActive = selectedWorkerIds.includes(workerId);
                                                const isAlreadyHere = activeAssignments.some(
                                                    (assignment) =>
                                                        assignment.workerId === worker.id &&
                                                        assignment.id !== editingAssignmentId
                                                );

                                                return (
                                                    <label
                                                        key={worker.id}
                                                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-all ${
                                                            isAlreadyHere
                                                                ? 'bg-slate-100 border-transparent opacity-50 cursor-not-allowed'
                                                                : isActive
                                                                  ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                                                                  : 'border-slate-100 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isActive}
                                                            disabled={isAlreadyHere}
                                                            onChange={() => worker.id && handleToggleWorker(worker.id)}
                                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                                        />
                                                        <span className={`text-sm ${isActive ? 'font-bold text-indigo-900' : 'text-slate-600'}`}>
                                                            {worker.name}
                                                        </span>
                                                        {isAlreadyHere && (
                                                            <span className="text-[10px] text-slate-400 ml-auto">입실중</span>
                                                        )}
                                                    </label>
                                                );
                                            })}
                                            {filteredWorkers.length === 0 && (
                                                <div className="col-span-2 text-center py-4 text-xs text-slate-400">
                                                    선택 가능한 작업자가 없습니다.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <header className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <span className="w-1.5 h-5 bg-indigo-500 rounded-full" />
                                청구대상 관리 (팀 1개 또는 개인 1명)
                            </h3>
                        </header>

                        <div className="p-5 space-y-4">
                            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                                <div className="text-xs font-bold text-indigo-500 mb-2">현재 청구대상</div>
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${
                                            currentBillingTarget?.targetType === 'worker'
                                                ? 'bg-slate-200 text-slate-700'
                                                : 'bg-indigo-200 text-indigo-700'
                                        }`}>
                                            <FontAwesomeIcon icon={currentBillingTarget?.targetType === 'worker' ? faUser : faUsers} />
                                        </span>
                                        <div className="min-w-0">
                                            <div className="font-bold text-slate-700 truncate">
                                                {currentBillingTargetDisplay}
                                            </div>
                                            <div className="text-[11px] text-slate-500">
                                                {currentBillingTarget
                                                    ? (currentBillingTarget.targetType === 'worker' ? '개인 청구' : '팀 청구')
                                                    : '청구대상 미설정'}
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
                                        청구대상 삭제
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                                {activeAssignments.length === 0 && (
                                    <div className="text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                        현재 입실 인원이 없어도 청구대상을 미리 지정할 수 있습니다.
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">청구 방식</label>
                                    <div className="inline-flex bg-white p-1 rounded-lg border border-indigo-100">
                                        <button
                                            type="button"
                                            onClick={selectTeamBillingTarget}
                                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                                                billingTargetType === 'team'
                                                    ? 'bg-indigo-600 text-white shadow-sm'
                                                    : 'text-slate-600 hover:text-slate-800'
                                            }`}
                                        >
                                            팀 청구
                                        </button>
                                        <button
                                            type="button"
                                            onClick={selectWorkerBillingTarget}
                                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                                                billingTargetType === 'worker'
                                                    ? 'bg-indigo-600 text-white shadow-sm'
                                                    : 'text-slate-600 hover:text-slate-800'
                                            }`}
                                        >
                                            개인 청구
                                        </button>
                                    </div>
                                </div>

                                {billingTargetType === 'team' ? (
                                    <div className="bg-white rounded-xl border border-indigo-100 p-4">
                                        <div className="text-sm font-bold text-slate-600 mb-2">청구 대상 팀 선택</div>
                                        {billingTeamOptions.length === 0 ? (
                                            <div className="text-xs text-slate-400">선택 가능한 팀이 없습니다.</div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {billingTeamOptions.map((teamOption) => {
                                                    const isSelected = billingTeamId === teamOption.id;
                                                    return (
                                                        <button
                                                            key={`billing-team-${teamOption.id}`}
                                                            type="button"
                                                            onClick={() => setBillingTeamId(teamOption.id)}
                                                            className={`text-left px-3 py-2 rounded-lg border text-sm transition ${
                                                                isSelected
                                                                    ? 'border-indigo-400 bg-indigo-50 text-indigo-800'
                                                                    : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/40'
                                                            }`}
                                                        >
                                                            <div className="font-bold">{teamOption.name}</div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-xl border border-indigo-100 p-4">
                                        <div className="text-sm font-bold text-slate-600 mb-2">청구 대상 개인 선택</div>
                                        {billingWorkerOptions.length === 0 ? (
                                            <div className="text-xs text-slate-400">선택 가능한 개인이 없습니다.</div>
                                        ) : (
                                            <>
                                                <div className="relative mb-2">
                                                    <input
                                                        type="text"
                                                        placeholder="이름/팀명 검색"
                                                        value={billingWorkerSearch}
                                                        onChange={(event) => setBillingWorkerSearch(event.target.value)}
                                                        className="w-full pl-8 p-2 text-xs bg-slate-100 rounded-lg outline-none"
                                                    />
                                                    <FontAwesomeIcon
                                                        icon={faSearch}
                                                        className="absolute left-2.5 top-2.5 text-slate-400 text-xs"
                                                    />
                                                </div>
                                                {filteredBillingWorkerOptions.length === 0 ? (
                                                    <div className="text-xs text-slate-400">검색 결과가 없습니다.</div>
                                                ) : (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                        {filteredBillingWorkerOptions.map((workerOption) => {
                                                            const isSelected = billingTargetWorkerId === workerOption.key;
                                                            return (
                                                                <button
                                                                    key={`billing-worker-${workerOption.key}`}
                                                                    type="button"
                                                                    onClick={() => setBillingTargetWorkerId(workerOption.key)}
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
                                            </>
                                        )}
                                    </div>
                                )}

                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={handleApplyBillingTarget}
                                        disabled={
                                            billingSubmitting ||
                                            (billingTargetType === 'team' && !billingTeamId) ||
                                            (billingTargetType === 'worker' && !billingTargetWorkerId)
                                        }
                                        className={`px-5 py-2.5 rounded-xl font-bold text-sm text-white transition shadow-lg ${
                                            billingSubmitting ||
                                            (billingTargetType === 'team' && !billingTeamId) ||
                                            (billingTargetType === 'worker' && !billingTargetWorkerId)
                                                ? 'bg-indigo-300 cursor-not-allowed shadow-none'
                                                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 hover:-translate-y-0.5'
                                        }`}
                                    >
                                        {billingSubmitting ? '저장 중...' : '청구대상 등록/수정 저장'}
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
                    {editingAssignmentId && (
                        <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition text-sm"
                        >
                            수정 취소
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleAssign}
                        disabled={submitting || selectedWorkerIds.length === 0}
                        className={`px-6 py-2.5 rounded-xl font-bold text-white transition shadow-lg flex items-center gap-2 text-sm ${
                            submitting || selectedWorkerIds.length === 0
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
                </div>
            </div>
        </div>
    );
};

export default AccommodationQuickAssignmentModal;
