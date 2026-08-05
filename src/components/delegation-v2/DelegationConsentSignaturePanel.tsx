import React, { useEffect, useMemo, useState } from 'react';
import {
    BadgeCheck,
    Check,
    CheckCircle2,
    ChevronRight,
    FileCheck2,
    PenLine,
    RotateCcw,
    ShieldCheck,
    UserRoundCheck,
    UsersRound,
} from 'lucide-react';
import SignatureGeneratorModal from '../signatures/SignatureGeneratorModal';
import type { SignatureSaveOptions } from '../../services/signatureService';

export interface DelegationConsentWorker {
    workerId: string;
    workerName: string;
    idNumber?: string;
    address?: string;
    signatureUrl?: string;
}

interface DelegationConsentSignaturePanelProps {
    workers: DelegationConsentWorker[];
    delegationText: string;
    documentDate: string;
    selectedMonth: string;
    siteName: string;
    mandataryName: string;
    onSignatureSaved: (workerId: string, newUrl: string) => void;
    selfService?: boolean;
}

const maskIdNumber = (value?: string): string => {
    const normalized = String(value ?? '').replace(/\s/g, '');
    if (!normalized) return '등록 정보 없음';
    const [front, back = ''] = normalized.split('-');
    if (!back) return `${normalized.slice(0, 6)}-*******`;
    return `${front}-${back.slice(0, 1)}******`;
};

const DelegationConsentSignaturePanel: React.FC<DelegationConsentSignaturePanelProps> = ({
    workers,
    delegationText,
    documentDate,
    selectedMonth,
    siteName,
    mandataryName,
    onSignatureSaved,
    selfService = false,
}) => {
    const [selectedWorkerId, setSelectedWorkerId] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [isSignatureOpen, setIsSignatureOpen] = useState(false);
    const [completedWorkerId, setCompletedWorkerId] = useState('');

    useEffect(() => {
        if (workers.length === 0) {
            setSelectedWorkerId('');
            setAgreed(false);
            return;
        }

        if (workers.some((worker) => worker.workerId === selectedWorkerId)) return;
        const firstUnsignedWorker = workers.find((worker) => !worker.signatureUrl);
        setSelectedWorkerId((firstUnsignedWorker ?? workers[0]).workerId);
        setAgreed(false);
    }, [selectedWorkerId, workers]);

    const selectedWorker = useMemo(
        () => workers.find((worker) => worker.workerId === selectedWorkerId) ?? null,
        [selectedWorkerId, workers]
    );

    const nextUnsignedWorker = workers.find((worker) => (
        worker.workerId !== selectedWorkerId && !worker.signatureUrl
    ));

    const signatureSaveOptions = useMemo<SignatureSaveOptions | undefined>(() => {
        if (!selectedWorker) return undefined;
        return {
            source: 'worker_direct',
            consent: {
                version: 1,
                documentText: delegationText,
                documentDate,
                workMonth: selectedMonth,
                siteName,
                mandataryName,
                workerName: selectedWorker.workerName,
            },
        };
    }, [delegationText, documentDate, mandataryName, selectedMonth, selectedWorker, siteName]);

    const selectWorker = (workerId: string) => {
        setSelectedWorkerId(workerId);
        setAgreed(false);
        setCompletedWorkerId('');
    };

    const handleSignatureSaved = (newUrl: string) => {
        if (!selectedWorker) return;
        onSignatureSaved(selectedWorker.workerId, newUrl);
        setCompletedWorkerId(selectedWorker.workerId);
        setAgreed(false);
        setIsSignatureOpen(false);
    };

    if (workers.length === 0) {
        return (
            <div className="flex h-full min-h-[560px] items-center justify-center overflow-y-auto bg-slate-50 p-6">
                <div className="w-full max-w-lg rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                        <UsersRound className="h-7 w-7" aria-hidden="true" />
                    </div>
                    <h2 className="mt-5 text-xl font-extrabold text-slate-900">직접 서명할 작업자가 없습니다</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-500">
                        {selfService
                            ? '계정과 연결된 작업자 정보가 없습니다. 관리자에게 작업자 계정 연결을 요청해 주세요.'
                            : '먼저 필터에서 근무 월과 현장을 선택하고, 작업자 탭에서 위임 대상자를 확인해 주세요.'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full min-h-0 overflow-y-auto bg-slate-100">
            <div className={`mx-auto w-full p-4 sm:p-6 lg:p-8 ${selfService ? 'max-w-5xl' : 'max-w-7xl'}`}>
                <header className="overflow-hidden rounded-3xl bg-slate-950 px-5 py-5 text-white shadow-xl sm:px-7 sm:py-6">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-300">
                            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                            Worker consent
                        </div>
                        <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">작업자 직접 서명</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                            {selfService
                                ? '위임장 내용을 확인하고 동의한 뒤 본인이 직접 서명해 주세요.'
                                : '관리자가 작업자를 선택한 뒤 기기를 전달하면, 작업자가 위임장 원문을 확인하고 직접 동의·서명합니다.'}
                        </p>
                    </div>
                </header>

                <div className={`mt-5 grid gap-5 ${selfService ? '' : 'xl:grid-cols-[300px_minmax(0,1fr)]'}`}>
                    {!selfService && <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-4 xl:self-start">
                        <div className="flex items-center justify-between px-1">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Step 1</p>
                                <h2 className="mt-1 font-extrabold text-slate-900">서명자 선택</h2>
                            </div>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">{workers.length}명</span>
                        </div>
                        <div className="mt-4 max-h-[470px] space-y-2 overflow-y-auto pr-1" role="listbox" aria-label="직접 서명 작업자 선택">
                            {workers.map((worker, index) => {
                                const selected = worker.workerId === selectedWorkerId;
                                const signed = Boolean(worker.signatureUrl);
                                return (
                                    <button
                                        key={worker.workerId}
                                        type="button"
                                        role="option"
                                        aria-selected={selected}
                                        onClick={() => selectWorker(worker.workerId)}
                                        className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${selected
                                            ? 'border-blue-500 bg-blue-50 shadow-sm'
                                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                    >
                                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black ${selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                            {index + 1}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-extrabold text-slate-800">{worker.workerName}</span>
                                            <span className={`mt-0.5 block text-xs font-semibold ${signed ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                {signed ? '서명 등록됨 · 수정 가능' : '서명 필요'}
                                            </span>
                                        </span>
                                        {signed ? (
                                            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" aria-hidden="true" />
                                        ) : (
                                            <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" aria-hidden="true" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </aside>}

                    {selectedWorker && (
                        <main className="min-w-0 space-y-5">
                            {completedWorkerId === selectedWorker.workerId && (
                                <section role="status" className="flex flex-col gap-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-start gap-3">
                                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                                            <BadgeCheck className="h-6 w-6" aria-hidden="true" />
                                        </span>
                                        <div>
                                            <h2 className="font-extrabold text-emerald-950">{selectedWorker.workerName}님의 서명이 반영되었습니다</h2>
                                            <p className="mt-1 text-sm text-emerald-700">위임장 미리보기와 인쇄본에도 새 서명이 바로 표시됩니다.</p>
                                        </div>
                                    </div>
                                    {!selfService && nextUnsignedWorker && (
                                        <button
                                            type="button"
                                            onClick={() => selectWorker(nextUnsignedWorker.workerId)}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800"
                                        >
                                            다음 미서명자
                                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                                        </button>
                                    )}
                                </section>
                            )}

                            <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                                <div className="border-b border-slate-200 px-5 py-5 sm:px-7">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-start gap-3">
                                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
                                                <UserRoundCheck className="h-5 w-5" aria-hidden="true" />
                                            </span>
                                            <div>
                                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">서명자 본인 확인</p>
                                                <h2 className="mt-1 text-xl font-extrabold text-slate-900">{selectedWorker.workerName}</h2>
                                                <p className="mt-1 text-sm text-slate-500">주민등록번호 {maskIdNumber(selectedWorker.idNumber)}</p>
                                            </div>
                                        </div>
                                        <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${selectedWorker.signatureUrl
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-amber-100 text-amber-700'
                                            }`}>
                                            {selectedWorker.signatureUrl ? <Check className="h-3.5 w-3.5" /> : <PenLine className="h-3.5 w-3.5" />}
                                            {selectedWorker.signatureUrl ? '기존 서명 있음' : '서명 전'}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
                                    <article className="border-b border-slate-200 p-5 sm:p-7 lg:border-b-0 lg:border-r">
                                        <div className="flex items-center gap-2">
                                            <FileCheck2 className="h-5 w-5 text-blue-600" aria-hidden="true" />
                                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Step 2 · 위임장 내용 확인</p>
                                        </div>
                                        <h3 className="mt-3 text-2xl font-black tracking-[0.18em] text-slate-950">위 임 장</h3>

                                        <div className="mt-5 whitespace-pre-line rounded-2xl border border-slate-200 bg-[#fbfaf7] p-5 text-[15px] leading-7 text-slate-700 shadow-inner">
                                            {delegationText}
                                        </div>
                                    </article>

                                    <div className="p-5 sm:p-7">
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">Step 3 · 동의 및 서명</p>
                                        </div>

                                        {selectedWorker.signatureUrl && (
                                            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                                <p className="text-xs font-bold text-slate-500">현재 등록된 서명</p>
                                                <div className="mt-2 flex h-20 items-center justify-center overflow-hidden rounded-xl bg-white">
                                                    <img src={selectedWorker.signatureUrl} alt={`${selectedWorker.workerName} 현재 서명`} className="h-full w-full object-contain" />
                                                </div>
                                                <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                                                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                                                    새로 서명하면 기존 서명이 교체됩니다.
                                                </p>
                                            </div>
                                        )}

                                        <label className={`mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${agreed
                                            ? 'border-emerald-500 bg-emerald-50'
                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}>
                                            <input
                                                type="checkbox"
                                                checked={agreed}
                                                onChange={(event) => setAgreed(event.target.checked)}
                                                className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                                aria-label="위임장 내용 확인 및 서명 동의"
                                            />
                                            <span>
                                                <span className="block text-sm font-extrabold text-slate-900">위임장 내용을 확인하고 동의합니다</span>
                                                <span className="mt-1 block text-xs leading-5 text-slate-500">
                                                    본인이 직접 서명하며, 저장된 서명이 위 위임장과 출력 문서에 사용되는 것에 동의합니다.
                                                </span>
                                            </span>
                                        </label>

                                        <button
                                            type="button"
                                            onClick={() => setIsSignatureOpen(true)}
                                            disabled={!agreed}
                                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                                        >
                                            <PenLine className="h-5 w-5" aria-hidden="true" />
                                            {selectedWorker.signatureUrl ? '동의하고 서명 수정' : '동의하고 직접 서명'}
                                        </button>

                                        <p className="mt-3 text-center text-[11px] leading-5 text-slate-400">
                                            서명 결과 이미지만 저장하며, 필압·획 데이터는 별도로 보관하지 않습니다.
                                        </p>
                                    </div>
                                </div>
                            </section>
                        </main>
                    )}
                </div>
            </div>

            {selectedWorker && (
                <SignatureGeneratorModal
                    isOpen={isSignatureOpen}
                    onClose={() => setIsSignatureOpen(false)}
                    workerId={selectedWorker.workerId}
                    workerName={selectedWorker.workerName}
                    onSaveComplete={handleSignatureSaved}
                    saveOptions={signatureSaveOptions}
                />
            )}
        </div>
    );
};

export default DelegationConsentSignaturePanel;
