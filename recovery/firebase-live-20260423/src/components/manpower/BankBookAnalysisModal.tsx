import React, { useState, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudUploadAlt, faSpinner, faCheck, faTimes, faMoneyCheck, faSearch, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { geminiService, AnalyzedBankBook } from '../../services/geminiService';
import { Worker } from '../../services/manpowerService';

interface BankBookAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    workers: Worker[]; // Filtered workers from parent
    onUpdateWorkers: (updates: { workerId: string, bankName: string, accountNumber: string, accountHolder: string }[]) => Promise<void>;
}

interface AnalysisResult {
    file: File;
    status: 'idle' | 'analyzing' | 'success' | 'error';
    data?: AnalyzedBankBook;
    matchedWorkerId?: string;
    error?: string;
}

const BankBookAnalysisModal: React.FC<BankBookAnalysisModalProps> = ({ isOpen, onClose, workers, onUpdateWorkers }) => {
    const [results, setResults] = useState<AnalysisResult[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const fileList = Array.from(e.target.files);
            const newFiles = fileList.map(file => ({
                file,
                status: 'idle' as const
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
            const fileList = Array.from(e.dataTransfer.files);
            const newFiles = fileList.map(file => ({
                file,
                status: 'idle' as const
            }));
            setResults(prev => [...prev, ...newFiles]);
        }
    };

    const runAnalysis = async () => {
        setIsAnalyzing(true);
        const newResults = [...results];

        // Process sequentially to avoid rate limits or overwhelming UI
        for (let i = 0; i < newResults.length; i++) {
            if (newResults[i].status === 'success') continue;

            newResults[i].status = 'analyzing';
            setResults([...newResults]);

            try {
                // 1. AI Analysis
                const data = await geminiService.analyzeBankBook(newResults[i].file);
                newResults[i].data = data;
                newResults[i].status = 'success';

                // 2. Auto-match Worker by Filename
                // Remove extension and trim
                const fileNameNoExt = newResults[i].file.name.replace(/\.[^/.]+$/, "").trim();

                // Find exact match first
                const exactMatch = workers.find(w => w.name === fileNameNoExt);
                if (exactMatch) {
                    newResults[i].matchedWorkerId = exactMatch.id;
                } else {
                    // Try to match by "Account Holder" name from AI if available
                    if (data.accountHolder) {
                        const holderMatch = workers.find(w => w.name === data.accountHolder);
                        if (holderMatch) {
                            newResults[i].matchedWorkerId = holderMatch.id;
                        }
                    }
                }

                // Add delay to prevent rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error: any) {
                newResults[i].status = 'error';
                newResults[i].error = error.message || '인식 실패';
            }
            setResults([...newResults]);
        }
        setIsAnalyzing(false);
    };

    const handleWorkerSelect = (index: number, workerId: string) => {
        const newResults = [...results];
        newResults[index].matchedWorkerId = workerId;
        setResults(newResults);
    };

    const handleSave = async () => {
        const validUpdates = results
            .filter(r => r.status === 'success' && r.matchedWorkerId && r.data)
            .map(r => ({
                workerId: r.matchedWorkerId!,
                bankName: r.data!.bankName || '',
                accountNumber: r.data!.accountNumber || '',
                accountHolder: r.data!.accountHolder || ''
            }));

        if (validUpdates.length === 0) {
            alert('저장할 데이터가 없습니다. 매칭된 항목이 있는지 확인해주세요.');
            return;
        }

        if (window.confirm(`${validUpdates.length}명의 계좌정보를 업데이트하시겠습니까?`)) {
            await onUpdateWorkers(validUpdates);
            onClose();
        }
    };

    const handleRemoveResult = (index: number) => {
        setResults(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faMoneyCheck} className="text-orange-500" />
                        AI 통장사본 자동 인식
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <FontAwesomeIcon icon={faTimes} size="lg" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        multiple
                        accept="image/*"
                        onChange={handleFileSelect}
                    />
                    {/* Drag & Drop Zone - 파일이 없을 때 표시 */}
                    {results.length === 0 && (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
                                ${isDragging
                                    ? 'border-orange-400 bg-orange-50'
                                    : 'border-slate-300 hover:border-orange-300 hover:bg-slate-100'
                                }`}
                        >
                            <FontAwesomeIcon icon={faCloudUploadAlt} className="text-5xl text-slate-400 mb-4" />
                            <p className="text-lg font-medium text-slate-600 mb-2">
                                통장사본 이미지를 드래그하거나 클릭하여 업로드
                            </p>
                            <p className="text-sm text-slate-400">
                                여러 장의 이미지를 한 번에 업로드할 수 있습니다
                            </p>
                        </div>
                    )}

                    {/* Results List */}
                    {results.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <div className="text-sm text-slate-500">
                                    총 {results.length}장 / 인식 성공 {results.filter(r => r.status === 'success').length}건
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
                                        className={`px-4 py-1.5 text-sm font-bold text-white rounded-lg flex items-center gap-2 ${isAnalyzing ? 'bg-slate-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'
                                            }`}
                                    >
                                        {isAnalyzing ? <><FontAwesomeIcon icon={faSpinner} spin /> 분석 중...</> : 'AI 분석 시작'}
                                    </button>
                                </div>
                            </div>

                            {results.map((result, idx) => (
                                <div key={idx} className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center">
                                    {/* Image Preview */}
                                    <div className="w-16 h-16 rounded overflow-hidden bg-slate-100 flex-shrink-0 relative group">
                                        <img src={URL.createObjectURL(result.file)} alt="preview" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center cursor-pointer text-white text-xs" onClick={() => window.open(URL.createObjectURL(result.file), '_blank')}>확대</div>
                                    </div>

                                    {/* Status & File Info */}
                                    <div className="w-40 flex-shrink-0">
                                        <div className="text-xs text-slate-400 mb-1 truncate" title={result.file.name}>{result.file.name}</div>
                                        {result.status === 'idle' && <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">대기 중</span>}
                                        {result.status === 'analyzing' && <span className="text-xs text-blue-500 flex items-center gap-1"><FontAwesomeIcon icon={faSpinner} spin /> 분석 중</span>}
                                        {result.status === 'error' && <span className="text-xs text-red-500 flex items-center gap-1"><FontAwesomeIcon icon={faExclamationTriangle} /> {result.error}</span>}
                                        {result.status === 'success' && <span className="text-xs text-green-600 flex items-center gap-1"><FontAwesomeIcon icon={faCheck} /> 인식 완료</span>}
                                    </div>

                                    {/* Recognized Data */}
                                    <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-2">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-slate-400">은행명</span>
                                            <input
                                                type="text"
                                                className="border rounded px-2 py-1 text-sm bg-slate-50"
                                                value={result.data?.bankName || ''}
                                                readOnly
                                                placeholder="-"
                                            />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-slate-400">계좌번호</span>
                                            <input
                                                type="text"
                                                className="border rounded px-2 py-1 text-sm bg-slate-50"
                                                value={result.data?.accountNumber || ''}
                                                readOnly
                                                placeholder="-"
                                            />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-slate-400">예금주</span>
                                            <input
                                                type="text"
                                                className="border rounded px-2 py-1 text-sm bg-slate-50"
                                                value={result.data?.accountHolder || ''}
                                                readOnly
                                                placeholder="-"
                                            />
                                        </div>
                                    </div>

                                    {/* Worker Matching */}
                                    <div className="w-full md:w-48 flex-shrink-0">
                                        <span className="text-[10px] text-slate-400 block mb-1">매칭 대상 (목록 내 검색)</span>
                                        <select
                                            className={`w-full border rounded px-2 py-1.5 text-sm ${result.matchedWorkerId ? 'border-green-300 bg-green-50 text-green-800 font-bold' : 'border-red-300 bg-red-50 text-red-800'}`}
                                            value={result.matchedWorkerId || ''}
                                            onChange={(e) => handleWorkerSelect(idx, e.target.value)}
                                        >
                                            <option value="">대상 선택 필요</option>
                                            {workers.map(w => (
                                                <option key={w.id} value={w.id!}>{w.name} ({w.teamName || '미배정'})</option>
                                            ))}
                                        </select>
                                    </div>

                                    <button onClick={() => handleRemoveResult(idx)} className="text-slate-300 hover:text-red-500">
                                        <FontAwesomeIcon icon={faTimes} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
                    <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 transition-colors shadow-lg shadow-orange-200"
                    >
                        적용하기
                    </button>
                </div>
            </div>
        </div >
    );
};

export default BankBookAnalysisModal;
