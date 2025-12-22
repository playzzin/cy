import React, { useState, useEffect } from 'react';
import { Worker } from '../../services/manpowerService';
import { Team } from '../../services/teamService';
import { Company } from '../../services/companyService';
import { geminiService } from '../../services/geminiService';
import { storage } from '../../config/firebase';
import { ref, uploadBytes, getDownloadURL, updateMetadata } from 'firebase/storage';
import { Position } from '../../services/positionService';

interface WorkerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (worker: Omit<Worker, 'id'> | Partial<Worker>) => Promise<void>;
    initialData?: Partial<Worker> | null;
    teams: Team[];
    companies: Company[];
    positions: Position[];
}

const WorkerModal: React.FC<WorkerModalProps> = ({ isOpen, onClose, onSave, initialData, teams, companies, positions }) => {
    const [formData, setFormData] = useState<Partial<Worker>>({
        name: '',
        idNumber: '',
        address: '',
        contact: '',
        email: '',
        role: '작업자',
        teamType: '미배정',
        teamName: '',
        teamId: '',
        companyName: '',
        companyId: '',
        status: '미배정',
        unitPrice: 0,
        bankName: '',
        accountNumber: '',
        accountHolder: '',
        fileNameSaved: '',
        color: '#0f766e'
    });

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
            setSelectedFile(null);
        } else {
            // Reset form for new entry
            setFormData({
                name: '',
                idNumber: '',
                address: '',
                contact: '',
                email: '',
                role: '작업자',
                teamType: '미배정',
                teamName: '',
                teamId: '',
                companyName: '',
                companyId: '',
                status: '미배정',
                unitPrice: 0,
                bankName: '',
                accountNumber: '',
                accountHolder: '',
                fileNameSaved: '',
                color: '#0f766e'
            });
            setSelectedFile(null);
        }
    }, [initialData, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const updates = { ...prev, [name]: value };

            if (name === 'unitPrice') {
                updates.unitPrice = parseInt(value) || 0;
            }

            if (name === 'teamId') {
                const team = teams.find(t => t.id === value);
                if (team) {
                    updates.teamName = team.name;
                    updates.teamType = team.type;
                    // 팀의 기본 지급구분이 설정되어 있고 현재 salaryModel이 비어있으면 자동 설정
                    if (!formData.salaryModel && team.defaultSalaryModel) {
                        updates.salaryModel = team.defaultSalaryModel;
                    }
                } else {
                    updates.teamName = '';
                    updates.teamType = '미배정';
                }
            }

            if (name === 'companyId') {
                const company = companies.find(c => c.id === value);
                if (company) {
                    updates.companyName = company.name;
                } else {
                    updates.companyName = '';
                }
            }

            return updates;
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setFormData(prev => ({
                ...prev,
                fileNameSaved: file.name
            }));
        }
    };

    const handleAiClick = () => {
        document.getElementById('aiInput')?.click();
    };

    const handleAiFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setIsAnalyzing(true);
            // Set the file to be uploaded
            setSelectedFile(file);

            const result = await geminiService.analyzeImage(file);

            setFormData(prev => ({
                ...prev,
                name: result.name || prev.name,
                idNumber: result.idNumber || prev.idNumber,
                address: result.address || prev.address,
                fileNameSaved: file.name // Show filename in UI
            }));

            alert('신분증 정보가 인식되었습니다.');
        } catch (error: any) {
            console.error(error);
            alert('인식 실패: ' + error.message);
            setSelectedFile(null); // Reset if failed
        } finally {
            setIsAnalyzing(false);
            // Reset input
            e.target.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.idNumber) {
            alert('이름과 주민번호는 필수입니다.');
            return;
        }

        try {
            let finalFormData = { ...formData };

            // Upload file if selected
            if (selectedFile) {
                const storagePath = `id_cards/${Date.now()}_${selectedFile.name}`;
                const storageRef = ref(storage, storagePath);
                await uploadBytes(storageRef, selectedFile);
                finalFormData.fileNameSaved = storagePath;
            }

            await onSave(finalFormData);
            onClose();
        } catch (error) {
            console.error("Failed to save worker:", error);
            alert("저장 중 오류가 발생했습니다.");
        }
    };

    const handleDownload = async () => {
        if (!formData.fileNameSaved) return;
        try {
            const fileRef = ref(storage, formData.fileNameSaved);
            const url = await getDownloadURL(fileRef);

            // Fetch as blob to force download with correct name
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `${formData.name}_${formData.idNumber}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            window.URL.revokeObjectURL(blobUrl);

        } catch (error) {
            console.error("Download failed:", error);
            alert("다운로드에 실패했습니다. (권한 부족 또는 파일 없음)");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">

                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <i className="fa-solid fa-user-tag text-brand-600"></i>
                        <span>{initialData ? '근로자 정보 수정' : '신규 근로자 등록'}</span>
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
                        <i className="fa-solid fa-xmark text-xl"></i>
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto flex-1 bg-white">
                    <form id="workerForm" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Section 1: Basic Info */}
                        <div className="md:col-span-2 bg-brand-50 rounded-xl p-4 border border-brand-100 relative">
                            <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
                                {/* AI Button */}
                                <input type="file" id="aiInput" accept="image/*" className="hidden" onChange={handleAiFileChange} disabled={isAnalyzing} />
                                <button
                                    type="button"
                                    onClick={handleAiClick}
                                    disabled={isAnalyzing}
                                    className={`bg-white text-brand-600 border border-brand-200 hover:bg-brand-600 hover:text-white p-2 rounded-lg text-lg font-medium transition flex items-center justify-center shadow-sm w-10 h-10 ${isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    title="Google AI 신분증 인식"
                                >
                                    <i className="fa-solid fa-camera"></i>
                                </button>
                                {isAnalyzing && (
                                    <div className="w-32 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                        <div className="bg-brand-600 h-1.5 rounded-full animate-progress-indeterminate"></div>
                                    </div>
                                )}
                            </div>
                            <h3 className="text-sm font-bold text-brand-800 mb-3 flex items-center gap-2">
                                <i className="fa-solid fa-id-card"></i> 기본 정보
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">이름 <span className="text-red-500">*</span></label>
                                    <input type="text" name="name" value={formData.name || ''} onChange={handleChange} required className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">주민등록번호 (13자리) <span className="text-red-500">*</span></label>
                                    <input type="text" name="idNumber" value={formData.idNumber || ''} onChange={handleChange} required placeholder="000000-0000000" className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">주소</label>
                                    <input type="text" name="address" value={formData.address || ''} onChange={handleChange} className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">연락처</label>
                                    <input type="text" name="contact" value={formData.contact || ''} onChange={handleChange} placeholder="010-0000-0000" className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">이메일</label>
                                    <input type="email" name="email" value={formData.email || ''} onChange={handleChange} placeholder="example@email.com" className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">작업자 색상</label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="color"
                                            name="color"
                                            value={formData.color || '#0f766e'}
                                            onChange={handleChange}
                                            className="h-9 w-9 rounded border border-slate-300 cursor-pointer bg-white"
                                        />
                                        <input
                                            type="text"
                                            value={formData.color || ''}
                                            onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                                            placeholder="#0f766e"
                                            className="flex-1 border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border font-mono"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2 & 3: Work Status & Finance (Side by Side) */}
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Section 2: Work Status */}
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 h-full">
                                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                    <i className="fa-solid fa-briefcase"></i> 근무 정보
                                </h3>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 mb-1">팀 선택</label>
                                            <select name="teamId" value={formData.teamId || ''} onChange={handleChange} className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border">
                                                <option value="">미배정</option>
                                                {teams.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 mb-1">소속 회사</label>
                                            <select name="companyId" value={formData.companyId || ''} onChange={handleChange} className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border">
                                                <option value="">미배정</option>
                                                {companies.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>


                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">재직 상태</label>
                                        <select name="status" value={formData.status || '미배정'} onChange={handleChange} className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border">
                                            <option value="미배정">미배정</option>
                                            <option value="재직">재직</option>
                                            <option value="퇴사">퇴사</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">직책</label>
                                        <select name="role" value={formData.role || '작업자'} onChange={handleChange} className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border">
                                            {positions.length > 0 ? (
                                                positions.map(pos => (
                                                    <option key={pos.id} value={pos.name}>{pos.name}</option>
                                                ))
                                            ) : (
                                                <>
                                                    <option value="작업자">작업자</option>
                                                    <option value="팀장">팀장</option>
                                                    <option value="관리자">관리자</option>
                                                </>
                                            )}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">현재 단가 (원)</label>
                                        <input type="number" name="unitPrice" value={formData.unitPrice || 0} onChange={handleChange} placeholder="0" className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border text-right" />
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Finance & Attachments */}
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 h-full flex flex-col">
                                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                    <i className="fa-solid fa-file-invoice-dollar"></i> 급여 및 첨부
                                </h3>
                                <div className="space-y-4 flex-1">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">급여방식</label>
                                        <select
                                            name="salaryModel"
                                            value={formData.salaryModel || '일급제'}
                                            onChange={handleChange}
                                            className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border bg-white"
                                        >
                                            <option value="일급제">일급제</option>
                                            <option value="주급제">주급제</option>
                                            <option value="월급제">월급제</option>
                                            <option value="지원팀">지원팀</option>
                                            <option value="용역팀">용역팀</option>
                                            <option value="가지급">가지급</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">은행명</label>
                                        <input type="text" name="bankName" value={formData.bankName || ''} onChange={handleChange} className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">계좌번호</label>
                                        <input type="text" name="accountNumber" value={formData.accountNumber || ''} onChange={handleChange} className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">예금주</label>
                                        <input type="text" name="accountHolder" value={formData.accountHolder || ''} onChange={handleChange} className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2.5 border" />
                                    </div>
                                    <div className="pt-4 border-t border-slate-200 mt-auto">
                                        <label className="block text-xs font-semibold text-slate-500 mb-2">신분증 / 통장사본</label>

                                        {formData.fileNameSaved ? (
                                            <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 mb-2">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <i className="fa-solid fa-image text-brand-500"></i>
                                                    <span className="text-xs text-slate-600 truncate max-w-[150px]">{formData.fileNameSaved.split('/').pop()}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleDownload}
                                                    className="text-xs bg-brand-50 text-brand-600 px-2 py-1 rounded hover:bg-brand-100 transition"
                                                >
                                                    다운로드
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="text-xs text-slate-400 mb-2 text-center py-2 bg-slate-100 rounded-lg border border-dashed border-slate-300">
                                                등록된 파일 없음
                                            </div>
                                        )}

                                        <input
                                            type="file"
                                            onChange={handleFileChange}
                                            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200 transition">취소</button>
                    <button onClick={handleSubmit} className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-md transition">저장하기</button>
                </div>
            </div>
        </div>
    );
};

export default WorkerModal;
