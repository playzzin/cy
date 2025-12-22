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
        code: '',
        businessNumber: '',
        ceoName: '',
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
                code: '',
                businessNumber: '',
                ceoName: '',
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
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <FontAwesomeIcon icon={faBuilding} className="text-brand-600" />
                    <span>{isEditMode ? '회사 정보 수정' : '신규 회사 등록'}</span>
                </h3>
                {!isEditMode && (
                    <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition">
                        <FontAwesomeIcon icon={faTimes} className="text-xl" />
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">회사명 <span className="text-red-500">*</span></label>
                    <input type="text" name="name" value={formData.name || ''} onChange={handleChange} required className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2 border" placeholder="예: 청연건설" />
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">회사코드</label>
                    <input type="text" name="code" value={formData.code || ''} onChange={handleChange} className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2 border" placeholder="예: CY001" />
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">사업자번호</label>
                    <input type="text" name="businessNumber" value={formData.businessNumber || ''} onChange={handleChange} className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2 border" placeholder="000-00-00000" />
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">대표자명</label>
                    <input type="text" name="ceoName" value={formData.ceoName || ''} onChange={handleChange} className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2 border" />
                </div>

                <div className="lg:col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">주소</label>
                    <input type="text" name="address" value={formData.address || ''} onChange={handleChange} className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2 border" />
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">연락처</label>
                    <input type="text" name="phone" value={formData.phone || ''} onChange={handleChange} className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2 border" placeholder="02-000-0000" />
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">이메일</label>
                    <input type="email" name="email" value={formData.email || ''} onChange={handleChange} className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2 border" />
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">구분</label>
                    <select name="type" value={formData.type || '미지정'} onChange={handleChange} className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2 border">
                        <option value="미지정">미지정</option>
                        <option value="시공사">시공사</option>
                        <option value="협력사">협력사</option>
                        <option value="건설사">건설사</option>
                        <option value="기타">기타</option>
                    </select>
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">은행명</label>
                    <input type="text" name="bankName" value={formData.bankName || ''} onChange={handleChange} className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2 border" placeholder="예: 국민은행" />
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">계좌번호</label>
                    <input type="text" name="accountNumber" value={formData.accountNumber || ''} onChange={handleChange} className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2 border" placeholder="000-00-000000" />
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">예금주</label>
                    <input type="text" name="accountHolder" value={formData.accountHolder || ''} onChange={handleChange} className="w-full border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 text-sm p-2 border" />
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">회사 색상</label>
                    <div className="flex items-center gap-3">
                        <input
                            type="color"
                            name="color"
                            value={formData.color || '#4f46e5'}
                            onChange={handleChange}
                            className="h-9 w-9 rounded border border-slate-300 cursor-pointer"
                        />
                        <input
                            type="text"
                            value={formData.color || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                            placeholder="#4f46e5"
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

export default CompanyForm;
