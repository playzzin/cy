import React, { useEffect, useMemo, useState } from 'react';
import { FilePenLine, LoaderCircle, RotateCcw, Save } from 'lucide-react';
import DelegationConsentSignaturePanel, {
    type DelegationConsentWorker,
} from '../../components/delegation-v2/DelegationConsentSignaturePanel';
import { DEFAULT_DELEGATION_BODY_TEXT } from '../../constants/delegationLetter';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useLinkedWorker } from '../../hooks/useLinkedWorker';
import { delegationLetterTemplateService } from '../../services/delegationLetterTemplateService';
import { canEditDelegationTemplate } from '../../utils/delegationTemplateAccess';

const toLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const WorkerDelegationSignaturePage: React.FC = () => {
    const { loading, linkedWorker, profile } = useLinkedWorker();
    const [signatureUrl, setSignatureUrl] = useState('');
    const [publicBodyText, setPublicBodyText] = useState('');
    const [draftBodyText, setDraftBodyText] = useState(DEFAULT_DELEGATION_BODY_TEXT);
    const [isEditingTemplate, setIsEditingTemplate] = useState(false);
    const [isSavingTemplate, setIsSavingTemplate] = useState(false);
    const [templateFeedback, setTemplateFeedback] = useState('');
    const [templateLoadError, setTemplateLoadError] = useState(false);
    const canEditTemplate = canEditDelegationTemplate(profile);

    useDocumentMeta({
        title: '위임장 서명 | 청연ENG ERP',
        description: '작업자가 위임장 내용을 확인하고 동의한 뒤 직접 서명하는 페이지입니다.',
        canonicalUrl: '/worker/delegation-signature',
    });

    useEffect(() => {
        setSignatureUrl(String(linkedWorker?.signatureUrl ?? ''));
    }, [linkedWorker?.id, linkedWorker?.signatureUrl]);

    useEffect(() => {
        const unsubscribe = delegationLetterTemplateService.subscribePublicTemplate(
            (template) => {
                setPublicBodyText(template?.bodyText || '');
                setTemplateLoadError(false);
            },
            (error) => {
                console.warn('Unable to load the shared delegation template:', error);
                setTemplateLoadError(true);
            }
        );
        return unsubscribe;
    }, []);

    const today = useMemo(() => toLocalDate(new Date()), []);
    const consent = linkedWorker?.signatureConsent;
    const documentDate = consent?.documentDate || today;
    const selectedMonth = consent?.workMonth || documentDate.slice(0, 7);
    const delegationText = publicBodyText || consent?.documentText || DEFAULT_DELEGATION_BODY_TEXT;
    const editableBodyText = publicBodyText || DEFAULT_DELEGATION_BODY_TEXT;
    const siteName = consent?.siteName || linkedWorker?.siteName || linkedWorker?.teamName || '';
    const mandataryName = consent?.mandataryName || linkedWorker?.leaderName || '회사 지정 수임인';

    const workers = useMemo<DelegationConsentWorker[]>(() => {
        if (!linkedWorker?.id) return [];
        return [{
            workerId: linkedWorker.id,
            workerName: linkedWorker.name,
            idNumber: linkedWorker.idNumber || '',
            address: linkedWorker.address || '',
            signatureUrl,
        }];
    }, [linkedWorker, signatureUrl]);

    useEffect(() => {
        if (!isEditingTemplate) setDraftBodyText(editableBodyText);
    }, [editableBodyText, isEditingTemplate]);

    const startTemplateEdit = () => {
        setDraftBodyText(editableBodyText);
        setTemplateFeedback('');
        setIsEditingTemplate(true);
    };

    const cancelTemplateEdit = () => {
        setDraftBodyText(editableBodyText);
        setTemplateFeedback('');
        setIsEditingTemplate(false);
    };

    const saveTemplate = async () => {
        const nextBodyText = draftBodyText.trim();
        if (!nextBodyText) {
            setTemplateFeedback('위임장 내용을 입력해 주세요.');
            return;
        }

        setIsSavingTemplate(true);
        setTemplateFeedback('');
        try {
            await delegationLetterTemplateService.savePublicTemplate(nextBodyText);
            setPublicBodyText(nextBodyText);
            setIsEditingTemplate(false);
            setTemplateFeedback('저장했습니다. 작업자 위임장 화면에 즉시 반영됩니다.');
        } catch (error) {
            console.error('Unable to save the shared delegation template:', error);
            setTemplateFeedback('저장하지 못했습니다. 권한과 네트워크 상태를 확인해 주세요.');
        } finally {
            setIsSavingTemplate(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[70vh] items-center justify-center bg-slate-100 p-6">
                <div className="text-center text-slate-500" role="status">
                    <LoaderCircle className="mx-auto h-9 w-9 animate-spin text-blue-600" aria-hidden="true" />
                    <p className="mt-3 text-sm font-bold">내 위임장 정보를 불러오는 중입니다.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-full bg-slate-100">
            {canEditTemplate && (
                <section className="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8">
                    <div className="rounded-3xl border border-indigo-200 bg-white p-5 shadow-sm sm:p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex items-start gap-3">
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white">
                                    <FilePenLine className="h-5 w-5" aria-hidden="true" />
                                </span>
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="text-lg font-extrabold text-slate-950">공용 위임장 내용 관리</h2>
                                        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">관리자·매니저 전용</span>
                                    </div>
                                    <p className="mt-1 text-sm leading-6 text-slate-500">
                                        저장한 문구는 모든 작업자의 위임장 확인·서명 화면에 실시간으로 적용됩니다.
                                    </p>
                                </div>
                            </div>
                            {!isEditingTemplate && (
                                <button
                                    type="button"
                                    onClick={startTemplateEdit}
                                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-indigo-700"
                                >
                                    <FilePenLine className="h-4 w-4" aria-hidden="true" />
                                    위임장 내용 수정
                                </button>
                            )}
                        </div>

                        {isEditingTemplate ? (
                            <div className="mt-5">
                                <label htmlFor="delegation-public-body" className="text-sm font-extrabold text-slate-800">작업자에게 표시할 위임장 본문</label>
                                <textarea
                                    id="delegation-public-body"
                                    value={draftBodyText}
                                    onChange={(event) => setDraftBodyText(event.target.value)}
                                    rows={8}
                                    className="mt-2 w-full resize-y rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                                />
                                <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <button
                                        type="button"
                                        onClick={() => setDraftBodyText(DEFAULT_DELEGATION_BODY_TEXT)}
                                        disabled={isSavingTemplate}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                                    >
                                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                                        기본 문구 불러오기
                                    </button>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={cancelTemplateEdit}
                                            disabled={isSavingTemplate}
                                            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 sm:flex-none"
                                        >
                                            취소
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void saveTemplate()}
                                            disabled={isSavingTemplate}
                                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:bg-indigo-300 sm:flex-none"
                                        >
                                            {isSavingTemplate ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                                            {isSavingTemplate ? '저장 중' : '저장 및 전체 적용'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-5 whitespace-pre-line rounded-2xl border border-slate-200 bg-[#fbfaf7] p-4 text-sm leading-7 text-slate-700">
                                {editableBodyText}
                            </div>
                        )}

                        {(templateFeedback || templateLoadError) && (
                            <p className={`mt-3 text-sm font-bold ${templateFeedback.startsWith('저장했습니다') ? 'text-emerald-700' : 'text-amber-700'}`} role="status">
                                {templateFeedback || '공유 문구를 불러오지 못해 기본 문구를 표시하고 있습니다.'}
                            </p>
                        )}
                    </div>
                </section>
            )}

            <DelegationConsentSignaturePanel
                selfService
                workers={workers}
                delegationText={delegationText}
                documentDate={documentDate}
                selectedMonth={selectedMonth}
                siteName={siteName}
                mandataryName={mandataryName}
                onSignatureSaved={(_workerId, newUrl) => setSignatureUrl(newUrl)}
            />
        </div>
    );
};

export default WorkerDelegationSignaturePage;
