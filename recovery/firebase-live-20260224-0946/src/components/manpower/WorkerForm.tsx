import React, { useState, useEffect } from 'react';
import { teamService } from '../../services/teamService';
import { Worker } from '../../services/manpowerService';
import { Team } from '../../services/teamService';
import { Company } from '../../services/companyService';
import { Position } from '../../services/positionService';
import { geminiService } from '../../services/geminiService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserTag, faCamera, faCheck, faTimes } from '@fortawesome/free-solid-svg-icons';
import { showSuccessAlert, showErrorAlert } from '../../utils/swal';

interface WorkerFormProps {
    initialData?: Worker | null;
    teams: Team[];
    companies: Company[];
    positions: Position[];
    onSave: (worker: Omit<Worker, 'id'> | Partial<Worker>, file?: File | null) => Promise<void>;
    onCancel: () => void;
    isEditMode?: boolean;
}

const WorkerForm: React.FC<WorkerFormProps> = ({ initialData, teams, companies, positions, onSave, onCancel, isEditMode = false }) => {
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
        companyId: '',
        companyName: '',
        status: '미배정',
        unitPrice: 0,
        bankName: '',
        accountNumber: '',
        accountHolder: '',
        fileNameSaved: '',
        salaryModel: '일급제',
        color: '#0f766e',
        bloodType: ''
    });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [affiliationType, setAffiliationType] = useState<'시공사' | '협력사'>('시공사');
    const [isNewTeam, setIsNewTeam] = useState(false);
    const [newTeamName, setNewTeamName] = useState('');

    // companyId가 변경되면 affiliationType을 동기화
    useEffect(() => {
        if (formData.companyId) {
            const comp = companies.find(c => c.id === formData.companyId);
            if (comp && (comp.type === '시공사' || comp.type === '협력사')) {
                setAffiliationType(comp.type as '시공사' | '협력사');
            }
        }
    }, [formData.companyId, companies]);

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
                companyId: '',
                companyName: '',
                status: '미배정',
                unitPrice: 0,
                bankName: '',
                accountNumber: '',
                accountHolder: '',
                fileNameSaved: '',
                salaryModel: '일급제',
                color: '#0f766e',
                bloodType: ''
            });
            setSelectedFile(null);
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

                    // 소속 회사 자동 설정 (팀에 연결된 회사가 있는 경우)
                    if (team.companyId) {
                        const comp = companies.find(c => c.id === team.companyId);
                        if (comp) {
                            updates.companyId = comp.id;
                            updates.companyName = comp.name;
                        }
                    }

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

        let finalData = { ...formData };

        if (!finalData.name || !finalData.idNumber) {
            await showErrorAlert('입력 오류', '이름과 주민번호는 필수입니다.');
            return;
        }

        // 새 팀 생성 로직 (팀장인 경우만)
        if (isNewTeam && finalData.role === '팀장') {
            if (!newTeamName.trim()) {
                await showErrorAlert('입력 오류', '팀명을 입력해주세요.');
                return;
            }
            try {
                const newTeamId = await teamService.addTeam({
                    name: newTeamName,
                    type: affiliationType,
                    companyId: finalData.companyId,
                    companyName: finalData.companyName,
                    leaderName: finalData.name,
                    status: 'active'
                } as any);

                finalData.teamId = newTeamId;
                finalData.teamName = newTeamName;
                finalData.teamType = affiliationType;
            } catch (err: any) {
                await showErrorAlert('팀 생성 실패', err.message);
                return;
            }
        }

        await onSave(finalData, selectedFile);
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-xl overflow-hidden max-w-5xl mx-auto border border-slate-200">
            {/* Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600">
                        <FontAwesomeIcon icon={faUserTag} className="text-sm" />
                    </span>
                    <span>{isEditMode ? '근로자 정보 수정' : '신규 근로자 등록'}</span>
                </h3>
                {!isEditMode && (
                    <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition">
                        <FontAwesomeIcon icon={faTimes} className="text-xl" />
                    </button>
                )}
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                {/* 1. Basic Information */}
                <section className="border border-slate-300 rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-slate-800 px-4 py-2.5 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-brand-400"></span>
                            기본 정보 (Basic Information)
                        </h3>
                    </div>

                    <div className="grid grid-cols-12 text-sm divide-y divide-slate-200">
                        {/* Row 1: Name & ID Number */}
                        <div className="col-span-12 grid grid-cols-12">
                            <div className="col-span-3 md:col-span-2 bg-slate-50 flex items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                                이름 <span className="text-red-500 ml-1">*</span>
                            </div>
                            <div className="col-span-9 md:col-span-4 p-2 border-r border-slate-200">
                                <div className="relative flex items-center">
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name || ''}
                                        onChange={handleChange}
                                        required
                                        className="w-full border-slate-200 bg-white rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-3 pr-9 shadow-sm placeholder:text-slate-300"
                                        placeholder="이름 입력"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAiClick}
                                        className="absolute right-2 text-brand-500 hover:text-brand-700 p-1"
                                        title="AI 신분증 인식"
                                    >
                                        <FontAwesomeIcon icon={faCamera} />
                                    </button>
                                    <input type="file" id="aiInput" accept="image/*" className="hidden" onChange={handleAiFileChange} />
                                </div>
                            </div>
                            <div className="hidden md:flex col-span-3 md:col-span-2 bg-slate-50 items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200 border-t md:border-t-0">
                                주민번호
                            </div>
                            <div className="col-span-12 md:col-span-4 p-2 border-t md:border-t-0">
                                <input
                                    type="text"
                                    name="idNumber"
                                    value={formData.idNumber || ''}
                                    onChange={handleChange}
                                    required
                                    className="w-full border-slate-200 bg-white rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-3 shadow-sm placeholder:text-slate-300"
                                    placeholder="000000-0000000"
                                />
                            </div>
                        </div>

                        {/* Row 2: Contact & Email */}
                        <div className="col-span-12 grid grid-cols-12">
                            <div className="col-span-3 md:col-span-2 bg-slate-50 flex items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                                연락처
                            </div>
                            <div className="col-span-9 md:col-span-4 p-2 border-r border-slate-200">
                                <input
                                    type="text"
                                    name="contact"
                                    value={formData.contact || ''}
                                    onChange={handleChange}
                                    className="w-full border-slate-200 bg-white rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-3 shadow-sm placeholder:text-slate-300"
                                    placeholder="010-0000-0000"
                                />
                            </div>
                            <div className="hidden md:flex col-span-3 md:col-span-2 bg-slate-50 items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200 border-t md:border-t-0">
                                이메일
                            </div>
                            <div className="col-span-12 md:col-span-4 p-2 border-t md:border-t-0">
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email || ''}
                                    onChange={handleChange}
                                    className="w-full border-slate-200 bg-white rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-3 shadow-sm placeholder:text-slate-300"
                                    placeholder="example@email.com"
                                />
                            </div>
                        </div>

                        {/* Row 3: Address & Blood Type */}
                        <div className="col-span-12 grid grid-cols-12">
                            <div className="col-span-3 md:col-span-2 bg-slate-50 flex items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                                주소
                            </div>
                            <div className="col-span-9 md:col-span-4 p-2 border-r border-slate-200">
                                <input
                                    type="text"
                                    name="address"
                                    value={formData.address || ''}
                                    onChange={handleChange}
                                    className="w-full border-slate-200 bg-white rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-3 shadow-sm placeholder:text-slate-300"
                                    placeholder="주소 입력"
                                />
                            </div>
                            <div className="hidden md:flex col-span-3 md:col-span-2 bg-slate-50 items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200 border-t md:border-t-0">
                                혈액형
                            </div>
                            <div className="col-span-12 md:col-span-4 p-2 border-t md:border-t-0">
                                <select
                                    name="bloodType"
                                    value={formData.bloodType || ''}
                                    onChange={handleChange}
                                    className="w-full border-slate-200 rounded text-sm py-1.5 px-3 font-medium cursor-pointer focus:ring-1 focus:ring-brand-500 focus:border-brand-500 bg-white"
                                >
                                    <option value="">선택 안함</option>
                                    <option value="A">A형</option>
                                    <option value="B">B형</option>
                                    <option value="O">O형</option>
                                    <option value="AB">AB형</option>
                                    <option value="기타">기타</option>
                                </select>
                            </div>
                        </div>

                        {/* Row 4: Status */}
                        <div className="col-span-12 grid grid-cols-12">
                            <div className="col-span-3 md:col-span-2 bg-slate-50 flex items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                                상태
                            </div>
                            <div className="col-span-9 md:col-span-10 p-2">
                                <select
                                    name="status"
                                    value={formData.status || '미배정'}
                                    onChange={handleChange}
                                    className="w-full md:w-1/2 border-slate-200 rounded text-sm py-1.5 px-3 font-medium cursor-pointer focus:ring-1 focus:ring-brand-500 focus:border-brand-500 bg-white"
                                >
                                    <option value="미배정">미배정</option>
                                    <option value="재직">재직</option>
                                    <option value="퇴사">퇴사</option>
                                    <option value="휴직">휴직</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 2. Work Information */}
                <section className="border border-slate-300 rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-slate-800 px-4 py-2.5 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            근로 정보 (Work Information)
                        </h3>
                    </div>

                    <div className="grid grid-cols-12 text-sm divide-y divide-slate-200 border-t border-slate-200">
                        {/* Row 1: Company & Team (Swapped) */}
                        <div className="col-span-12 grid grid-cols-12">
                            {/* 1. Company Selection (Now on Left) */}
                            <div className="col-span-3 md:col-span-2 bg-slate-50 flex items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                                소속 회사
                            </div>
                            <div className="col-span-9 md:col-span-4 p-2 border-r border-slate-200">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="affiliationType"
                                                checked={affiliationType === '시공사'}
                                                onChange={() => {
                                                    setAffiliationType('시공사');
                                                    setFormData(prev => ({ ...prev, companyId: '', companyName: '', teamId: '', teamName: '' }));
                                                }}
                                                disabled={isNewTeam}
                                                className="text-brand-600 focus:ring-brand-500"
                                            />
                                            <span className="text-sm text-slate-700">시공사</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="affiliationType"
                                                checked={affiliationType === '협력사'}
                                                onChange={() => {
                                                    setAffiliationType('협력사');
                                                    setFormData(prev => ({ ...prev, companyId: '', companyName: '', teamId: '', teamName: '' }));
                                                }}
                                                disabled={isNewTeam}
                                                className="text-brand-600 focus:ring-brand-500"
                                            />
                                            <span className="text-sm text-slate-700">협력사</span>
                                        </label>
                                    </div>
                                    <select
                                        name="companyId"
                                        value={formData.companyId || ''}
                                        onChange={(e) => {
                                            // Handle Change locally to ensure Team reset
                                            const val = e.target.value;
                                            const comp = companies.find(c => c.id === val);
                                            setFormData(prev => ({
                                                ...prev,
                                                companyId: val,
                                                companyName: comp ? comp.name : '',
                                                teamId: '',
                                                teamName: ''
                                            }));
                                        }}
                                        className="w-full border-slate-200 rounded text-sm py-1.5 px-3 font-medium cursor-pointer focus:ring-1 focus:ring-brand-500 focus:border-brand-500 bg-white"
                                    >
                                        <option value="">
                                            {affiliationType === '시공사' ? '시공사 선택' : '협력사 선택'}
                                        </option>
                                        {companies
                                            .filter(c => c.type === affiliationType)
                                            .map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))
                                        }
                                    </select>
                                </div>
                            </div>

                            {/* 2. Team Assignment (Now on Right) */}
                            <div className="hidden md:flex col-span-3 md:col-span-2 bg-slate-50 items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200 border-t md:border-t-0">
                                팀 배정
                            </div>
                            <div className="col-span-12 md:col-span-4 p-2 border-t md:border-t-0">
                                <select
                                    name="teamId"
                                    value={formData.teamId || ''}
                                    onChange={handleChange}
                                    disabled={isNewTeam || !formData.companyId}
                                    className={`w-full border-slate-200 rounded text-sm py-1.5 px-3 font-medium focus:ring-1 focus:ring-brand-500 focus:border-brand-500 bg-white ${(isNewTeam || !formData.companyId) ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                    <option value="">
                                        {isNewTeam ? '새 팀 생성 예정' : (!formData.companyId ? '회사 먼저 선택' : '미배정 (선택)')}
                                    </option>
                                    {teams
                                        .filter(t => t.companyId === formData.companyId)
                                        .map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))
                                    }
                                </select>
                            </div>
                        </div>

                        {/* Row 2: Role & Unit Price */}
                        <div className="col-span-12 grid grid-cols-12">
                            <div className="col-span-3 md:col-span-2 bg-slate-50 flex items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                                직책
                            </div>
                            <div className="col-span-9 md:col-span-4 p-2 border-r border-slate-200">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="role"
                                                checked={formData.role !== '팀장'}
                                                onChange={() => {
                                                    setFormData(prev => ({ ...prev, role: '일반' }));
                                                    setIsNewTeam(false);
                                                }}
                                                className="text-brand-600 focus:ring-brand-500"
                                            />
                                            <span className="text-sm text-slate-700">일반</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="role"
                                                checked={formData.role === '팀장'}
                                                onChange={() => {
                                                    setFormData(prev => ({ ...prev, role: '팀장' }));
                                                    // 팀장 선택 시 팀명 기본제안
                                                    if (!formData.teamId) {
                                                        setNewTeamName(`${formData.name || ''}팀`);
                                                    }
                                                }}
                                                className="text-brand-600 focus:ring-brand-500"
                                            />
                                            <span className="text-sm font-bold text-slate-700">팀장</span>
                                        </label>
                                    </div>

                                    {formData.role === '팀장' && (
                                        <div className="bg-slate-50 p-2 rounded border border-slate-200">
                                            <label className="flex items-center gap-2 mb-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={isNewTeam}
                                                    onChange={(e) => {
                                                        setIsNewTeam(e.target.checked);
                                                        if (e.target.checked) {
                                                            setNewTeamName(`${formData.name || ''}팀`);
                                                            setFormData(prev => ({ ...prev, teamId: '', teamName: '' }));
                                                        }
                                                    }}
                                                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                                />
                                                <span className="text-xs font-bold text-slate-700">새 팀 등록 (팀 생성)</span>
                                            </label>
                                            {isNewTeam && (
                                                <input
                                                    type="text"
                                                    value={newTeamName}
                                                    onChange={(e) => setNewTeamName(e.target.value)}
                                                    placeholder="팀명 입력"
                                                    className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded"
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="hidden md:flex col-span-3 md:col-span-2 bg-slate-50 items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200 border-t md:border-t-0">
                                단가
                            </div>
                            <div className="col-span-12 md:col-span-4 p-2 border-t md:border-t-0">
                                <input
                                    type="number"
                                    name="unitPrice"
                                    value={formData.unitPrice || 0}
                                    onChange={handleChange}
                                    placeholder="0"
                                    className="w-full border-slate-200 bg-white rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-3 shadow-sm text-right font-mono"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. Financial & Management */}
                <section className="border border-slate-300 rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-slate-800 px-4 py-2.5 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                            재무 및 관리 (Financial & Management)
                        </h3>
                    </div>

                    <div className="grid grid-cols-12 text-sm divide-y divide-slate-200 border-t border-slate-200">
                        {/* Row 1: Salary Model & Bank Info */}
                        <div className="col-span-12 grid grid-cols-12">
                            <div className="col-span-3 md:col-span-2 bg-slate-50 flex items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                                지급 구분
                            </div>
                            <div className="col-span-9 md:col-span-4 p-2 border-r border-slate-200">
                                <select
                                    name="salaryModel"
                                    value={formData.salaryModel || '일급제'}
                                    onChange={handleChange}
                                    className="w-full border-slate-200 rounded text-sm py-1.5 px-3 font-medium cursor-pointer focus:ring-1 focus:ring-brand-500 focus:border-brand-500 bg-white"
                                >
                                    <option value="일급제">일급제</option>
                                    <option value="주급제">주급제</option>
                                    <option value="월급제">월급제</option>
                                    <option value="지원팀">지원팀</option>
                                    <option value="용역팀">용역팀</option>
                                    <option value="가지급">가지급</option>
                                </select>
                            </div>
                            <div className="col-span-12 md:col-span-6 p-2 border-t md:border-t-0 grid grid-cols-3 gap-2">
                                <input
                                    type="text"
                                    name="bankName"
                                    value={formData.bankName || ''}
                                    onChange={handleChange}
                                    placeholder="은행명"
                                    className="w-full border-slate-200 bg-white rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-3 shadow-sm"
                                />
                                <input
                                    type="text"
                                    name="accountNumber"
                                    value={formData.accountNumber || ''}
                                    onChange={handleChange}
                                    placeholder="계좌번호"
                                    className="w-full border-slate-200 bg-white rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-3 shadow-sm"
                                />
                                <input
                                    type="text"
                                    name="accountHolder"
                                    value={formData.accountHolder || ''}
                                    onChange={handleChange}
                                    placeholder="예금주"
                                    className="w-full border-slate-200 bg-white rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-3 shadow-sm"
                                />
                            </div>
                        </div>

                        {/* Row 2: File & Color */}
                        <div className="col-span-12 grid grid-cols-12">
                            <div className="col-span-3 md:col-span-2 bg-slate-50 flex items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                                첨부 파일
                            </div>
                            <div className="col-span-9 md:col-span-4 p-2 border-r border-slate-200 flex items-center">
                                <input
                                    type="file"
                                    onChange={handleFileChange}
                                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
                                />
                            </div>
                            <div className="hidden md:flex col-span-3 md:col-span-2 bg-slate-50 items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200 border-t md:border-t-0">
                                작업자 색상
                            </div>
                            <div className="col-span-12 md:col-span-4 p-2 border-t md:border-t-0">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        name="color"
                                        value={formData.color || '#0f766e'}
                                        onChange={handleChange}
                                        className="h-8 w-8 rounded border border-slate-200 cursor-pointer p-0 shadow-sm"
                                    />
                                    <input
                                        type="text"
                                        value={formData.color || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                                        placeholder="#0f766e"
                                        className="w-32 border-slate-200 rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-3 font-mono shadow-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-white hover:border-slate-300 border border-transparent transition-all"
                >
                    취소
                </button>
                <button
                    type="submit"
                    className="px-8 py-2.5 rounded-lg text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-lg hover:shadow-brand-500/30 transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
                >
                    <FontAwesomeIcon icon={faCheck} />
                    <span>{isEditMode ? '변경사항 저장' : '등록 완료'}</span>
                </button>
            </div>
        </form>
    );
};

export default WorkerForm;
