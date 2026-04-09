import React, { useState, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCloudUploadAlt, faSpinner, faCheck, faTimes, faIdCard,
    faExclamationTriangle, faPlus, faSync, faUserPlus, faEdit
} from '@fortawesome/free-solid-svg-icons';
import { geminiService, AnalyzedIdCard } from '../../services/geminiService';
import { Worker } from '../../services/manpowerService';

interface IdCardAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    existingWorkers: Worker[];
    onAddWorkers: (newWorkers: {
        name: string,
        idNumber: string,
        address: string,
        file: File,
        matchType: 'new' | 'update' | 'duplicate',
        matchedWorkerId?: string
    }[]) => Promise<void>;
}

// 주민번호 정규화 함수
const normalizeIdNumber = (id: string): string => {
    if (!id) return '';
    return id.replace(/[-\s]/g, '').trim();
};

// 주민번호 비교 함수
const isSameIdNumber = (a: string, b: string): boolean => {
    const normA = normalizeIdNumber(a);
    const normB = normalizeIdNumber(b);
    if (!normA || !normB || normA.length < 6 || normB.length < 6) return false;
    return normA === normB;
};

interface AnalysisResult {
    file: File;
    status: 'idle' | 'analyzing' | 'success' | 'error';
    data?: AnalyzedIdCard;
    error?: string;
    // 개선된 매칭 정보
    matchType: 'new' | 'update' | 'duplicate' | 'pending';
    matchedWorker?: Worker;
    changes?: {
        name: boolean;
        idNumber: boolean;
        address: boolean;
        photo: boolean;
    };
}

const IdCardAnalysisModal: React.FC<IdCardAnalysisModalProps> = ({ isOpen, onClose, existingWorkers, onAddWorkers }) => {
    const [results, setResults] = useState<AnalysisResult[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).map(file => ({
                file,
                status: 'idle' as const,
                matchType: 'pending' as const
            }));
            setResults(prev => [...prev, ...newFiles]);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const newFiles = Array.from(e.dataTransfer.files).map(file => ({
                file,
                status: 'idle' as const,
                matchType: 'pending' as const
            }));
            setResults(prev => [...prev, ...newFiles]);
        }
    };

    // 기존 작업자와 매칭 로직
    const matchWithExistingWorkers = (data: AnalyzedIdCard): {
        matchType: 'new' | 'update' | 'duplicate';
        matchedWorker?: Worker;
        changes?: { name: boolean; idNumber: boolean; address: boolean; photo: boolean };
    } => {
        if (!data.idNumber && !data.name) {
            return { matchType: 'new' };
        }

        // 1. 주민번호로 정확 매칭 시도
        const idMatch = existingWorkers.find(w => isSameIdNumber(w.idNumber || '', data.idNumber || ''));

        if (idMatch) {
            // 기존 작업자 발견 - 채울 필드 확인
            const changes = {
                name: !idMatch.name && !!data.name,
                idNumber: !idMatch.idNumber && !!data.idNumber,
                address: !idMatch.address && !!data.address,
                photo: !idMatch.fileNameSaved // 사진 없으면 업데이트
            };

            const hasChanges = changes.name || changes.address || changes.photo;

            if (hasChanges) {
                return { matchType: 'update', matchedWorker: idMatch, changes };
            } else {
                return { matchType: 'duplicate', matchedWorker: idMatch, changes };
            }
        }

        // 2. 이름으로만 매칭 시도 (경고용)
        const nameMatch = existingWorkers.find(w =>
            w.name && data.name && w.name.trim() === data.name.trim()
        );

        if (nameMatch) {
            // 이름만 같음 - 주민번호가 다르면 다른 사람일 수 있음
            // 일단 신규로 처리하되 경고 표시
            return { matchType: 'new', matchedWorker: nameMatch };
        }

        // 3. 매칭 없음 - 신규 작업자
        return { matchType: 'new' };
    };

    // AI 분석 + 재시도 로직
    const analyzeWithRetry = async (file: File, retries = 2): Promise<AnalyzedIdCard> => {
        for (let i = 0; i <= retries; i++) {
            try {
                return await geminiService.analyzeImage(file);
            } catch (e: any) {
                if (i === retries || !e.message?.includes('429')) throw e;
                await new Promise(r => setTimeout(r, 3000 * (i + 1)));
            }
        }
        throw new Error('분석 실패');
    };

    const runAnalysis = async () => {
        const apiKey = geminiService.getKey();
        if (!apiKey) {
            alert('API 키가 설정되지 않았습니다. /settings/ai 에서 Gemini API 키를 등록해주세요.');
            return;
        }

        setIsAnalyzing(true);
        const newResults = [...results];

        for (let i = 0; i < newResults.length; i++) {
            if (newResults[i].status === 'success') continue;

            newResults[i].status = 'analyzing';
            setResults([...newResults]);

            try {
                // AI 분석 (재시도 포함)
                const data = await analyzeWithRetry(newResults[i].file);

                newResults[i].data = {
                    name: data.name || '',
                    idNumber: data.idNumber || '',
                    address: data.address || ''
                };
                newResults[i].status = 'success';

                // 기존 작업자 매칭
                const matchResult = matchWithExistingWorkers(newResults[i].data!);
                newResults[i].matchType = matchResult.matchType;
                newResults[i].matchedWorker = matchResult.matchedWorker;
                newResults[i].changes = matchResult.changes;

                // Rate limit 방지 지연
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (error: any) {
                newResults[i].status = 'error';
                const message = error?.message || '인식 실패';
                if (/API Key Missing|API key not valid|403|PERMISSION_DENIED|referer|blocked/i.test(message)) {
                    newResults[i].error = `${message} (/settings/ai 확인)`;
                } else {
                    newResults[i].error = message;
                }
                newResults[i].matchType = 'pending';
            }
            setResults([...newResults]);
        }
        setIsAnalyzing(false);
    };

    const handleDataChange = (index: number, field: keyof AnalyzedIdCard, value: string) => {
        const newResults = [...results];
        if (newResults[index].data) {
            newResults[index].data![field] = value;

            // 데이터 변경 시 매칭 재계산
            const matchResult = matchWithExistingWorkers(newResults[index].data!);
            newResults[index].matchType = matchResult.matchType;
            newResults[index].matchedWorker = matchResult.matchedWorker;
            newResults[index].changes = matchResult.changes;
        }
        setResults(newResults);
    };

    const handleSave = async () => {
        const validItems = results
            .filter(r => r.status === 'success' && r.data && r.matchType !== 'pending')
            .map(r => ({
                name: r.data!.name || '',
                idNumber: r.data!.idNumber || '',
                address: r.data!.address || '',
                file: r.file,
                matchType: r.matchType as 'new' | 'update' | 'duplicate',
                matchedWorkerId: r.matchedWorker?.id
            }));

        if (validItems.length === 0) {
            alert('저장할 데이터가 없습니다.');
            return;
        }

        const newCount = validItems.filter(i => i.matchType === 'new').length;
        const updateCount = validItems.filter(i => i.matchType === 'update').length;
        const dupCount = validItems.filter(i => i.matchType === 'duplicate').length;

        const message = [
            newCount > 0 ? `신규 ${newCount}명` : '',
            updateCount > 0 ? `업데이트 ${updateCount}명` : '',
            dupCount > 0 ? `중복(사진만) ${dupCount}명` : ''
        ].filter(Boolean).join(', ');

        if (!window.confirm(`${message}을 처리하시겠습니까?`)) {
            return;
        }

        await onAddWorkers(validItems);
        onClose();
    };

    const handleRemoveResult = (index: number) => {
        setResults(prev => prev.filter((_, i) => i !== index));
    };

    // 매칭 타입별 UI 정보
    const getMatchTypeInfo = (matchType: string, matchedWorker?: Worker) => {
        switch (matchType) {
            case 'new':
                return {
                    icon: faUserPlus,
                    label: '신규 등록',
                    color: 'text-green-600',
                    bgColor: 'bg-green-50',
                    borderColor: 'border-green-200'
                };
            case 'update':
                return {
                    icon: faEdit,
                    label: `업데이트: ${matchedWorker?.name || ''}`,
                    color: 'text-blue-600',
                    bgColor: 'bg-blue-50',
                    borderColor: 'border-blue-200'
                };
            case 'duplicate':
                return {
                    icon: faSync,
                    label: `사진만 업데이트: ${matchedWorker?.name || ''}`,
                    color: 'text-amber-600',
                    bgColor: 'bg-amber-50',
                    borderColor: 'border-amber-200'
                };
            default:
                return {
                    icon: faExclamationTriangle,
                    label: '대기 중',
                    color: 'text-slate-500',
                    bgColor: 'bg-slate-50',
                    borderColor: 'border-slate-200'
                };
        }
    };

    // 통계
    const stats = {
        total: results.length,
        success: results.filter(r => r.status === 'success').length,
        new: results.filter(r => r.matchType === 'new' && r.status === 'success').length,
        update: results.filter(r => r.matchType === 'update').length,
        duplicate: results.filter(r => r.matchType === 'duplicate').length,
        error: results.filter(r => r.status === 'error').length
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faIdCard} className="text-indigo-600" />
                        AI 신분증 자동 인식 (미리보기)
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <FontAwesomeIcon icon={faTimes} size="lg" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">

                    {/* Upload Section */}
                    {results.length === 0 && (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer group ${isDragging
                                ? 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-100'
                                : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50'
                                }`}
                        >
                            <div className="w-16 h-16 bg-indigo-100 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                <FontAwesomeIcon icon={faCloudUploadAlt} size="2x" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700 mb-2">
                                {isDragging ? '파일을 여기에 놓으세요' : '신분증 이미지를 업로드하세요'}
                            </h3>
                            <p className="text-slate-500 text-sm">클릭하거나 파일을 드래그하여 업로드 (여러 장 가능)</p>
                            <p className="text-slate-400 text-xs mt-2">* 이름, 주민번호, 주소가 자동으로 인식됩니다.</p>
                            <p className="text-indigo-500 text-xs mt-1">* 기존 작업자는 자동 매칭되어 정보가 업데이트됩니다.</p>
                        </div>
                    )}

                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        multiple
                        accept="image/*"
                        onChange={handleFileSelect}
                    />

                    {/* Results List */}
                    {results.length > 0 && (
                        <div className="space-y-4">
                            {/* 통계 및 버튼 */}
                            <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                                <div className="flex gap-3 text-sm">
                                    <span className="text-slate-500">총 {stats.total}장</span>
                                    {stats.success > 0 && (
                                        <>
                                            <span className="text-green-600">🆕 신규 {stats.new}</span>
                                            <span className="text-blue-600">🔄 업데이트 {stats.update}</span>
                                            <span className="text-amber-600">⚠️ 중복 {stats.duplicate}</span>
                                        </>
                                    )}
                                    {stats.error > 0 && <span className="text-red-600">❌ 실패 {stats.error}</span>}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="px-3 py-1.5 text-sm bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                                    >
                                        + 파일 추가
                                    </button>
                                    <button
                                        onClick={runAnalysis}
                                        disabled={isAnalyzing}
                                        className={`px-4 py-1.5 text-sm font-bold text-white rounded-lg flex items-center gap-2 ${isAnalyzing ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                                            }`}
                                    >
                                        {isAnalyzing ? <><FontAwesomeIcon icon={faSpinner} spin /> 분석 중...</> : 'AI 분석 시작'}
                                    </button>
                                </div>
                            </div>

                            {results.map((result, idx) => {
                                const matchInfo = getMatchTypeInfo(result.matchType, result.matchedWorker);

                                return (
                                    <div key={idx} className={`bg-white rounded-lg border p-4 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center ${matchInfo.borderColor}`}>
                                        {/* Image Preview */}
                                        <div className="w-20 h-20 rounded overflow-hidden bg-slate-100 flex-shrink-0 relative group">
                                            <img src={URL.createObjectURL(result.file)} alt="preview" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center cursor-pointer text-white text-xs" onClick={() => window.open(URL.createObjectURL(result.file), '_blank')}>확대</div>
                                        </div>

                                        {/* Status & Match Type */}
                                        <div className="w-36 flex-shrink-0">
                                            <div className="text-xs text-slate-400 mb-1 truncate" title={result.file.name}>{result.file.name}</div>
                                            {result.status === 'idle' && <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">대기 중</span>}
                                            {result.status === 'analyzing' && <span className="text-xs text-blue-500 flex items-center gap-1"><FontAwesomeIcon icon={faSpinner} spin /> 분석 중</span>}
                                            {result.status === 'error' && <span className="text-xs text-red-500 flex items-center gap-1"><FontAwesomeIcon icon={faExclamationTriangle} /> {result.error}</span>}
                                            {result.status === 'success' && (
                                                <span className={`text-xs ${matchInfo.color} flex items-center gap-1 font-medium`}>
                                                    <FontAwesomeIcon icon={matchInfo.icon} />
                                                    {result.matchType === 'new' ? '신규 등록' :
                                                        result.matchType === 'update' ? '정보 업데이트' :
                                                            result.matchType === 'duplicate' ? '사진만 업데이트' : '대기'}
                                                </span>
                                            )}
                                            {result.matchedWorker && result.matchType !== 'new' && (
                                                <div className="text-[10px] text-slate-400 mt-0.5">
                                                    → {result.matchedWorker.name}
                                                </div>
                                            )}
                                        </div>

                                        {/* Recognized Data */}
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2 w-full">
                                            <div>
                                                <label className="block text-[10px] text-slate-400 mb-0.5">
                                                    이름 {result.changes?.name && <span className="text-blue-500">(채움)</span>}
                                                </label>
                                                <input
                                                    type="text"
                                                    className="w-full border rounded px-2 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                                    value={result.data?.name || ''}
                                                    onChange={(e) => handleDataChange(idx, 'name', e.target.value)}
                                                    placeholder="이름"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-slate-400 mb-0.5">
                                                    주민번호 {result.changes?.idNumber && <span className="text-blue-500">(채움)</span>}
                                                </label>
                                                <input
                                                    type="text"
                                                    className="w-full border rounded px-2 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                                    value={result.data?.idNumber || ''}
                                                    onChange={(e) => handleDataChange(idx, 'idNumber', e.target.value)}
                                                    placeholder="000000-0000000"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-slate-400 mb-0.5">
                                                    주소 {result.changes?.address && <span className="text-blue-500">(채움)</span>}
                                                </label>
                                                <input
                                                    type="text"
                                                    className="w-full border rounded px-2 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                                    value={result.data?.address || ''}
                                                    onChange={(e) => handleDataChange(idx, 'address', e.target.value)}
                                                    placeholder="주소"
                                                />
                                            </div>
                                        </div>

                                        <button onClick={() => handleRemoveResult(idx)} className="text-slate-300 hover:text-red-500 p-2">
                                            <FontAwesomeIcon icon={faTimes} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center bg-white">
                    <div className="text-xs text-slate-400">
                        🆕 신규: 새 작업자 생성 | 🔄 업데이트: 기존 작업자 정보 보충 | ⚠️ 중복: 사진만 업데이트
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                            취소
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={stats.success === 0}
                            className={`px-6 py-2 font-bold rounded-lg transition-colors shadow-lg flex items-center gap-2 ${stats.success === 0
                                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                                }`}
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            일괄 처리하기 ({stats.success}건)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IdCardAnalysisModal;