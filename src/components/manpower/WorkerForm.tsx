import React, { useState, useEffect } from 'react';
import { Worker } from '../../services/manpowerService';
import { Team } from '../../services/teamService';
import { geminiService } from '../../services/geminiService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserTag, faIdCard, faBriefcase, faFileInvoiceDollar, faCamera, faCheck, faTimes } from '@fortawesome/free-solid-svg-icons';
import { showSuccessAlert, showErrorAlert } from '../../utils/swal';

interface WorkerFormProps {
    initialData?: Worker | null;
    teams: Team[];
    onSave: (worker: Omit<Worker, 'id'> | Partial<Worker>) => Promise<void>;
    onCancel: () => void;
    isEditMode?: boolean;
}

const WorkerForm: React.FC<WorkerFormProps> = ({ initialData, teams, onSave, onCancel, isEditMode = false }) => {
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
        status: '미배정',
        unitPrice: 0,
        bankName: '',
        accountNumber: '',
        accountHolder: '',
        fileNameSaved: '',
        salaryModel: '일급제',
        color: '#0f766e'
    });

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        } else {
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
                status: '미배정',
                unitPrice: 0,
                bankName: '',
                accountNumber: '',
                accountHolder: '',
                fileNameSaved: '',
                salaryModel: '일급제',
                color: '#0f766e'
            });
        }
    }, [initialData]);

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

            return updates;
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFormData(prev => ({
                ...prev,
                fileNameSaved: e.target.files![0].name
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
            const result = await geminiService.analyzeImage(file);
            setFormData(prev => ({
                ...prev,
                name: result.name || prev.name,
                idNumber: result.idNumber || prev.idNumber,
                address: result.address || prev.address
            }));
            await showSuccessAlert('인식 성공', '신분증 정보가 인식되었습니다.');
        } catch (error: any) {
            console.error(error);
            await showErrorAlert('인식 실패', error.message);
        } finally {
            e.target.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.idNumber) {
            await showErrorAlert('입력 오류', '이름과 주민번호는 필수입니다.');
            return;
        }
        await onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <FontAwesomeIcon icon={faUserTag} className="text-brand-600" />
                    <span>{isEditMode ? '근로자 정보 수정' : '신규 근로자 등록'}</span>
                </h3>
                {!isEditMode && (
                    <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition">
                        <FontAwesomeIcon icon={faTimes} className="text-xl" />
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
                {/* Row 1 */}
                <div className="lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">이름 <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <input type="text" name="name" value={formData.name || ''} onChange={handleChange} required className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2 border" />
                        <button type="button" onClick={handleAiClick} className="absolute right-1 top-1 text-brand-600 hover:text-brand-800 p-1" title="AI 신분증 인식">
                            <FontAwesomeIcon icon={faCamera} />
                        </button>
                        <input type="file" id="aiInput" accept="image/*" className="hidden" onChange={handleAiFileChange} />
                    </div>
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">주민번호 <span className="text-red-500">*</span></label>
                    <input type="text" name="idNumber" value={formData.idNumber || ''} onChange={handleChange} required placeholder="000000-0000000" className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2 border" />
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">연락처</label>
                    <input type="text" name="contact" value={formData.contact || ''} onChange={handleChange} placeholder="010-0000-0000" className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2 border" />
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">팀 선택</label>
                    <select name="teamId" value={formData.teamId || ''} onChange={handleChange} className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2 border">
                        <option value="">미배정</option>
                        {teams.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">팀 유형</label>
                    <select
                        name="teamType"
                        value={formData.teamType || '미배정'}
                        onChange={handleChange}
                        className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2 border"
                    >
                        <option value="미배정">미배정</option>
                        <option value="본팀">본팀</option>
                        <option value="관리팀">관리팀</option>
                        <option value="새끼팀">새끼팀</option>
                        <option value="지원팀">지원팀</option>
                        <option value="용역팀">용역팀</option>
                    </select>
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">구분</label>
                    <select
                        name="salaryModel"
                        value={formData.salaryModel || '일급제'}
                        onChange={handleChange}
                        className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2 border"
                    >
                        <option value="일급제">일급제</option>
                        <option value="주급제">주급제</option>
                        <option value="월급제">월급제</option>
                        <option value="지원팀">지원팀</option>
                        <option value="용역팀">용역팀</option>
                        <option value="가지급">가지급</option>
                    </select>
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">직책</label>
                    <select name="role" value={formData.role || '일반'} onChange={handleChange} className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2 border">
                        <option value="사장">사장</option>
                        <option value="실장">실장</option>
                        <option value="팀장">팀장</option>
                        <option value="반장">반장</option>
                        <option value="기공">기공</option>
                        <option value="일반">일반</option>
                        <option value="신규">신규</option>
                        <option value="미배정">미배정</option>
                    </select>
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">상태</label>
                    <select name="status" value={formData.status || '미배정'} onChange={handleChange} className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2 border">
                        <option value="미배정">미배정</option>
                        <option value="재직">재직</option>
                        <option value="퇴사">퇴사</option>
                    </select>
                </div>

                {/* Row 2 */}
                <div className="lg:col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">주소</label>
                    <input type="text" name="address" value={formData.address || ''} onChange={handleChange} className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2 border" />
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">단가</label>
                    <input type="number" name="unitPrice" value={formData.unitPrice || 0} onChange={handleChange} placeholder="0" className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2 border text-right" />
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">은행명</label>
                    <input type="text" name="bankName" value={formData.bankName || ''} onChange={handleChange} className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2 border" />
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">계좌번호</label>
                    <input type="text" name="accountNumber" value={formData.accountNumber || ''} onChange={handleChange} className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2 border" />
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">예금주</label>
                    <input type="text" name="accountHolder" value={formData.accountHolder || ''} onChange={handleChange} className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2 border" />
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">파일</label>
                    <input type="file" onChange={handleFileChange} className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">작업자 색상</label>
                    <div className="flex items-center gap-3">
                        <input
                            type="color"
                            name="color"
                            value={formData.color || '#0f766e'}
                            onChange={handleChange}
                            className="h-9 w-9 rounded border border-slate-300 cursor-pointer"
                        />
                        <input
                            type="text"
                            value={formData.color || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                            placeholder="#0f766e"
                            className="flex-1 border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2 border font-mono"
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition">취소</button>
                <button type="submit" className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-md transition flex items-center gap-2">
                    <FontAwesomeIcon icon={faCheck} />
                    <span>저장하기</span>
                </button>
            </div>
        </form>
    );
};

export default WorkerForm;
