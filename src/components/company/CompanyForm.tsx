import React, { useState, useEffect } from 'react';
import { Company } from '../../services/companyService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faCheck, faTimes } from '@fortawesome/free-solid-svg-icons';

interface CompanyFormProps {
    initialData?: Company | null;
    onSave: (company: Omit<Company, 'id'> | Partial<Company>) => Promise<void>;
    onCancel: () => void;
    isEditMode?: boolean;
    allCompanies?: Company[]; // (현재는 사용하지 않음)
    defaultType?: Company['type'];
}

const CompanyForm: React.FC<CompanyFormProps> = ({ initialData, onSave, onCancel, isEditMode = false, allCompanies, defaultType = '협력사' }) => {
    const [formData, setFormData] = useState<Partial<Company>>({
        name: '',
        businessNumber: '',
        ceoName: '',
        ceoResidentNumber: '', // 주민번호
        address: '',
        phone: '',
        email: '',
        type: defaultType,
        bankName: '',
        accountNumber: '',
        accountHolder: '',
        color: '#4f46e5'
    });

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        } else {
            setFormData({
                name: '',
                businessNumber: '',
                ceoName: '',
                ceoResidentNumber: '', // 주민번호
                address: '',
                phone: '',
                email: '',
                type: defaultType,
                bankName: '',
                accountNumber: '',
                accountHolder: '',
                color: '#4f46e5'
            });
        }
    }, [initialData, defaultType]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) {
            alert('대표팀(회사명)은 필수입니다.');
            return;
        }
        await onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-xl overflow-hidden max-w-3xl mx-auto border border-slate-200">
            {/* Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600">
                        <FontAwesomeIcon icon={faBuilding} className="text-sm" />
                    </span>
                    <span>{isEditMode ? '회사 정보 수정' : '신규 회사 등록'}</span>
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
                        {/* Row 1: Company Name */}
                        <div className="col-span-12 grid grid-cols-12">
                            <div className="col-span-3 md:col-span-2 bg-slate-50 flex items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                                회사명 <span className="text-red-500 ml-1">*</span>
                            </div>
                            <div className="col-span-9 md:col-span-10 p-2">
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name || ''}
                                    onChange={handleChange}
                                    required
                                    className="w-full border-slate-200 bg-white rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-3 shadow-sm placeholder:text-slate-300"
                                    placeholder="예: 청연건설"
                                />
                            </div>
                        </div>

                        {/* Row 2: Type & Business Number */}
                        <div className="col-span-12 grid grid-cols-12">
                            <div className="col-span-3 md:col-span-2 bg-slate-50 flex items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                                구분
                            </div>
                            <div className="col-span-9 md:col-span-4 p-2 border-r border-slate-200">
                                <select
                                    name="type"
                                    value={formData.type || '미지정'}
                                    onChange={handleChange}
                                    className="w-full border-slate-200 rounded text-sm py-1.5 px-3 font-medium cursor-pointer focus:ring-1 focus:ring-brand-500 focus:border-brand-500 bg-white"
                                >
                                    <option value="미지정">미지정</option>
                                    <option value="시공사">시공사</option>
                                    <option value="협력사">협력사</option>
                                    <option value="건설사">건설사</option>
                                    <option value="임대사">임대사</option>
                                    <option value="기타">기타</option>
                                </select>
                            </div>
                            <div className="hidden md:flex col-span-3 md:col-span-2 bg-slate-50 items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200 border-t md:border-t-0">
                                사업자번호
                            </div>
                            <div className="col-span-12 md:col-span-4 p-2 border-t md:border-t-0">
                                <input
                                    type="text"
                                    name="businessNumber"
                                    value={formData.businessNumber || ''}
                                    onChange={handleChange}
                                    className="w-full border-slate-200 bg-white rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-3 shadow-sm placeholder:text-slate-300"
                                    placeholder="000-00-00000"
                                />
                            </div>
                        </div>

                        {/* Row 3: CEO Name & Resident Number */}
                        <div className="col-span-12 grid grid-cols-12">
                            <div className="col-span-3 md:col-span-2 bg-slate-50 flex items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                                대표자명
                            </div>
                            <div className="col-span-9 md:col-span-4 p-2 border-r border-slate-200">
                                <input
                                    type="text"
                                    name="ceoName"
                                    value={formData.ceoName || ''}
                                    onChange={handleChange}
                                    className="w-full border-slate-200 bg-white rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-3 shadow-sm placeholder:text-slate-300"
                                    placeholder="대표자 성명"
                                />
                            </div>
                            {formData.type !== '협력사' && (
                                <>
                                    <div className="hidden md:flex col-span-3 md:col-span-2 bg-slate-50 items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200 border-t md:border-t-0">
                                        대표자 주민번호
                                    </div>
                                    <div className="col-span-12 md:col-span-4 p-2 border-t md:border-t-0">
                                        <input
                                            type="text"
                                            name="ceoResidentNumber"
                                            value={formData.ceoResidentNumber || ''}
                                            onChange={handleChange}
                                            className="w-full border-slate-200 bg-white rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-3 shadow-sm placeholder:text-slate-300"
                                            placeholder="000000-0000000 (노무신고용)"
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Row 4: Address */}
                        <div className="col-span-12 grid grid-cols-12">
                            <div className="col-span-3 md:col-span-2 bg-slate-50 flex items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                                주소
                            </div>
                            <div className="col-span-9 md:col-span-10 p-2">
                                <input
                                    type="text"
                                    name="address"
                                    value={formData.address || ''}
                                    onChange={handleChange}
                                    className="w-full border-slate-200 bg-white rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-3 shadow-sm placeholder:text-slate-300"
                                    placeholder="회사 주소 입력"
                                />
                            </div>
                        </div>

                        {/* Row 5: Contact & Email */}
                        <div className="col-span-12 grid grid-cols-12">
                            <div className="col-span-3 md:col-span-2 bg-slate-50 flex items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                                연락처
                            </div>
                            <div className="col-span-9 md:col-span-4 p-2 border-r border-slate-200">
                                <input
                                    type="text"
                                    name="phone"
                                    value={formData.phone || ''}
                                    onChange={handleChange}
                                    className="w-full border-slate-200 bg-white rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-3 shadow-sm placeholder:text-slate-300"
                                    placeholder="02-000-0000"
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
                                    placeholder="example@company.com"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* 2. Financial & Management */}
                <section className="border border-slate-300 rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-slate-800 px-4 py-2.5 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                            재무 및 관리 (Financial & Management)
                        </h3>
                    </div>

                    <div className="grid grid-cols-12 text-sm divide-y divide-slate-200 border-t border-slate-200">
                        {/* Row 1: Bank Info */}
                        <div className="col-span-12 grid grid-cols-12">
                            <div className="col-span-3 md:col-span-2 bg-slate-50 flex items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                                계좌정보
                            </div>
                            <div className="col-span-9 md:col-span-10 p-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                                <input
                                    type="text"
                                    name="bankName"
                                    value={formData.bankName || ''}
                                    onChange={handleChange}
                                    className="w-full border-slate-200 bg-white rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-3 shadow-sm placeholder:text-slate-300"
                                    placeholder="은행명 (예: 국민은행)"
                                />
                                <input
                                    type="text"
                                    name="accountNumber"
                                    value={formData.accountNumber || ''}
                                    onChange={handleChange}
                                    className="w-full border-slate-200 bg-white rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-3 shadow-sm placeholder:text-slate-300"
                                    placeholder="계좌번호"
                                />
                                <input
                                    type="text"
                                    name="accountHolder"
                                    value={formData.accountHolder || ''}
                                    onChange={handleChange}
                                    className="w-full border-slate-200 bg-white rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-3 shadow-sm placeholder:text-slate-300"
                                    placeholder="예금주"
                                />
                            </div>
                        </div>

                        {/* Row 2: Company Color */}
                        <div className="col-span-12 grid grid-cols-12">
                            <div className="col-span-3 md:col-span-2 bg-slate-50 flex items-center px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">
                                회사 색상
                            </div>
                            <div className="col-span-9 md:col-span-10 p-2">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        name="color"
                                        value={formData.color || '#4f46e5'}
                                        onChange={handleChange}
                                        className="h-8 w-8 rounded border border-slate-200 cursor-pointer p-0 shadow-sm"
                                    />
                                    <input
                                        type="text"
                                        value={formData.color || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                                        placeholder="#4f46e5"
                                        className="w-32 border-slate-200 rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-sm py-1.5 px-3 font-mono shadow-sm"
                                    />
                                    <span className="text-xs text-slate-400">일정 및 현황판에서 표시될 색상입니다.</span>
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

export default CompanyForm;
