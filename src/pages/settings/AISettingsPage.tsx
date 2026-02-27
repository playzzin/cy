import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowLeft,
    faBrain,
    faCheckCircle,
    faFloppyDisk,
    faImage,
    faKey,
    faRobot,
    faTableList
} from '@fortawesome/free-solid-svg-icons';
import {
    aiSettingsService,
    AI_IMAGE_MODEL_OPTIONS,
    AI_MANAGED_PAGES,
    AI_TEXT_MODEL_OPTIONS,
    AiModelSettings,
    AiModelScope
} from '../../services/aiSettingsService';

const scopeLabelMap: Record<AiModelScope, string> = {
    textModel: '공통 분석 모델',
    analyticsModel: '통계 분석 모델',
    imageModel: '이미지 생성 모델',
    server: '서버 함수'
};

const AISettingsPage: React.FC = () => {
    const [apiKey, setApiKey] = useState('');
    const [models, setModels] = useState<AiModelSettings>({
        textModel: '',
        analyticsModel: '',
        imageModel: ''
    });
    const [pageEnabledById, setPageEnabledById] = useState<Record<string, boolean>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<string>('');

    useEffect(() => {
        const settings = aiSettingsService.getSettings();
        setApiKey(aiSettingsService.getApiKey());
        setModels(settings.models);
        setPageEnabledById(settings.pageEnabledById);
        setSavedAt(settings.updatedAt);
    }, []);

    const maskedApiKey = useMemo(() => {
        if (!apiKey) return '미설정';
        if (apiKey.length <= 8) return `${apiKey.slice(0, 2)}****`;
        return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
    }, [apiKey]);

    const resolveModelByScope = (scope: AiModelScope): string => {
        if (scope === 'textModel') return models.textModel;
        if (scope === 'analyticsModel') return models.analyticsModel;
        if (scope === 'imageModel') return models.imageModel;
        return 'server-managed';
    };

    const currentModelBindings = useMemo(
        () => [
            {
                id: 'binding-gemini-service',
                service: 'geminiService (문서/텍스트/이미지 분석)',
                model: models.textModel,
                note: '일보/신분증/통장/작업자 등록 분석'
            },
            {
                id: 'binding-analytics-agent',
                service: 'analyticsAgent + agentOrchestrator',
                model: models.textModel,
                note: '관리자 에이전트 대화형 분석'
            },
            {
                id: 'binding-gemini-analytics',
                service: 'geminiAnalyticsService',
                model: models.analyticsModel,
                note: '일보 통계 질문/인사이트 생성'
            },
            {
                id: 'binding-gemini-image',
                service: 'geminiImageService',
                model: models.imageModel,
                note: 'AI 이미지 스튜디오/카카오 이미지 생성'
            },
            {
                id: 'binding-card-billing',
                service: 'CardBillingManager (Cloud Function)',
                model: 'server-managed',
                note: '서버 함수 내부 모델 정책 사용'
            }
        ],
        [models]
    );

    const setAllPagesEnabled = (enabled: boolean) => {
        const next = AI_MANAGED_PAGES.reduce<Record<string, boolean>>((acc, page) => {
            acc[page.id] = enabled;
            return acc;
        }, {});
        setPageEnabledById(next);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            aiSettingsService.setApiKey(apiKey);
            const next = aiSettingsService.saveSettings({
                models,
                pageEnabledById
            });
            setSavedAt(next.updatedAt);
            alert('AI 설정이 저장되었습니다.');
        } catch (error) {
            console.error('[AISettingsPage] save failed:', error);
            alert('AI 설정 저장 중 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 xl:p-10">
            <div className="max-w-6xl mx-auto space-y-6">
                <header className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 text-slate-500 text-sm font-bold mb-2">
                                <FontAwesomeIcon icon={faRobot} />
                                AI Configuration
                            </div>
                            <h1 className="text-2xl font-extrabold text-slate-900">AI 설정 관리</h1>
                            <p className="text-sm text-slate-500 mt-2">
                                Gemini 모델 선택, 현재 사용 모델 확인, AI 사용 페이지별 ON/OFF를 한 곳에서 관리합니다.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link
                                to="/settings"
                                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-bold"
                            >
                                <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
                                설정으로 돌아가기
                            </Link>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving}
                                className={`px-4 py-2.5 rounded-xl text-sm font-bold text-white flex items-center gap-2 ${
                                    isSaving ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                                }`}
                            >
                                <FontAwesomeIcon icon={faFloppyDisk} />
                                {isSaving ? '저장 중...' : '저장'}
                            </button>
                        </div>
                    </div>
                    <div className="mt-4 text-xs text-slate-500">
                        마지막 저장: {savedAt ? new Date(savedAt).toLocaleString('ko-KR') : '없음'}
                    </div>
                </header>

                <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                        <FontAwesomeIcon icon={faKey} className="text-amber-500" />
                        Gemini API Key
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        입력한 키는 브라우저 로컬 스토리지에 저장됩니다.
                    </p>
                    <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-center">
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Gemini API Key"
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        />
                        <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                            현재 키: <span className="font-mono text-slate-700">{maskedApiKey}</span>
                        </div>
                    </div>
                </section>

                <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                        <FontAwesomeIcon icon={faBrain} className="text-indigo-500" />
                        Gemini 모델 선택
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        서비스별 기본 모델을 분리해 설정할 수 있습니다. 커스텀 모델명이 있으면 직접 입력하세요.
                    </p>

                    <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">공통 분석 모델</label>
                            <select
                                value={models.textModel}
                                onChange={(e) => setModels((prev) => ({ ...prev, textModel: e.target.value }))}
                                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold"
                            >
                                {AI_TEXT_MODEL_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="text"
                                value={models.textModel}
                                onChange={(e) => setModels((prev) => ({ ...prev, textModel: e.target.value }))}
                                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono"
                                placeholder="커스텀 모델명"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">통계 분석 모델</label>
                            <select
                                value={models.analyticsModel}
                                onChange={(e) => setModels((prev) => ({ ...prev, analyticsModel: e.target.value }))}
                                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold"
                            >
                                {AI_TEXT_MODEL_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="text"
                                value={models.analyticsModel}
                                onChange={(e) => setModels((prev) => ({ ...prev, analyticsModel: e.target.value }))}
                                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono"
                                placeholder="커스텀 모델명"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">이미지 생성 모델</label>
                            <select
                                value={models.imageModel}
                                onChange={(e) => setModels((prev) => ({ ...prev, imageModel: e.target.value }))}
                                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold"
                            >
                                {AI_IMAGE_MODEL_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="text"
                                value={models.imageModel}
                                onChange={(e) => setModels((prev) => ({ ...prev, imageModel: e.target.value }))}
                                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono"
                                placeholder="커스텀 모델명"
                            />
                        </div>
                    </div>
                </section>

                <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                        <FontAwesomeIcon icon={faImage} className="text-emerald-500" />
                        현재 사용중인 모델
                    </h2>
                    <div className="mt-4 overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-3 text-left">서비스</th>
                                    <th className="px-4 py-3 text-left">현재 모델</th>
                                    <th className="px-4 py-3 text-left">설명</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {currentModelBindings.map((binding) => (
                                    <tr key={binding.id} className="hover:bg-slate-50/60">
                                        <td className="px-4 py-3 font-bold text-slate-700">{binding.service}</td>
                                        <td className="px-4 py-3">
                                            <span className="font-mono text-xs bg-slate-100 border border-slate-200 rounded px-2 py-1 text-slate-700">
                                                {binding.model}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500">{binding.note}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                                <FontAwesomeIcon icon={faTableList} className="text-cyan-500" />
                                AI 사용 페이지 관리
                            </h2>
                            <p className="text-sm text-slate-500 mt-1">
                                페이지를 비활성화하면 해당 경로에서 AI 호출을 차단합니다.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setAllPagesEnabled(true)}
                                className="px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-bold"
                            >
                                전체 활성화
                            </button>
                            <button
                                type="button"
                                onClick={() => setAllPagesEnabled(false)}
                                className="px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold"
                            >
                                전체 비활성화
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-3 text-left">페이지</th>
                                    <th className="px-4 py-3 text-left">경로</th>
                                    <th className="px-4 py-3 text-left">모델 소스</th>
                                    <th className="px-4 py-3 text-left">현재 모델</th>
                                    <th className="px-4 py-3 text-center">사용 여부</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {AI_MANAGED_PAGES.map((page) => {
                                    const enabled = pageEnabledById[page.id] !== false;
                                    const model = resolveModelByScope(page.modelScope);

                                    return (
                                        <tr key={page.id} className="hover:bg-slate-50/60">
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-slate-700">{page.name}</div>
                                                <div className="text-xs text-slate-500 mt-1">{page.description}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-1">
                                                    {page.paths.map((path) => (
                                                        <code
                                                            key={`${page.id}:${path}`}
                                                            className="text-[11px] bg-slate-100 border border-slate-200 rounded px-2 py-0.5 text-slate-700"
                                                        >
                                                            {path}
                                                        </code>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">{scopeLabelMap[page.modelScope]}</td>
                                            <td className="px-4 py-3">
                                                <code className="text-[11px] bg-slate-100 border border-slate-200 rounded px-2 py-1 text-slate-700">
                                                    {model}
                                                </code>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <label className="inline-flex items-center justify-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={enabled}
                                                        onChange={(e) =>
                                                            setPageEnabledById((prev) => ({
                                                                ...prev,
                                                                [page.id]: e.target.checked
                                                            }))
                                                        }
                                                        className="sr-only"
                                                    />
                                                    <span
                                                        className={`w-11 h-6 rounded-full relative transition ${
                                                            enabled ? 'bg-emerald-500' : 'bg-slate-300'
                                                        }`}
                                                    >
                                                        <span
                                                            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition ${
                                                                enabled ? 'left-5' : 'left-0.5'
                                                            }`}
                                                        />
                                                    </span>
                                                </label>
                                                <div className={`text-[11px] mt-1 font-bold ${enabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                    {enabled ? 'ON' : 'OFF'}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>

                <div className="text-xs text-slate-500 bg-slate-100 border border-slate-200 rounded-xl px-4 py-3">
                    <FontAwesomeIcon icon={faCheckCircle} className="text-emerald-600 mr-2" />
                    페이지 OFF 시 해당 경로의 AI 호출은 서비스 레벨에서 차단됩니다.
                </div>
            </div>
        </div>
    );
};

export default AISettingsPage;

