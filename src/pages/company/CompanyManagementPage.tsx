import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faPlus, faTrash, faEdit, faSearch, faHardHat, faBriefcase, faPhone, faMapMarkerAlt, faUserTie } from '@fortawesome/free-solid-svg-icons';
import { companyService, Company } from '../../services/companyService';

const CompanyManagementPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'contractor' | 'client'>('contractor');
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<Company>>({
        name: '',
        code: '',
        businessNumber: '',
        ceoName: '',
        address: '',
        phone: '',
        type: '협력사', // Default based on tab
        status: 'active'
    });

    useEffect(() => {
        fetchCompanies();
    }, [activeTab]);

    const fetchCompanies = async () => {
        setLoading(true);
        try {
            // Map tab to DB type
            const type = activeTab === 'contractor' ? '협력사' : '건설사';
            const data = await companyService.getCompaniesByType(type);
            setCompanies(data);
        } catch (error) {
            console.error("Failed to fetch companies", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (company?: Company) => {
        if (company) {
            setEditingCompany(company);
            setFormData(company);
        } else {
            setEditingCompany(null);
            setFormData({
                name: '',
                code: `C${Date.now().toString().slice(-6)}`, // Simple auto-gen code
                businessNumber: '',
                ceoName: '',
                address: '',
                phone: '',
                type: activeTab === 'contractor' ? '협력사' : '건설사',
                status: 'active'
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCompany(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return;

        try {
            if (editingCompany && editingCompany.id) {
                await companyService.updateCompany(editingCompany.id, formData);
            } else {
                await companyService.addCompany(formData as any);
            }
            await fetchCompanies();
            handleCloseModal();
        } catch (error) {
            console.error("Failed to save company", error);
            alert("저장에 실패했습니다.");
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (window.confirm(`'${name}' 회사를 삭제하시겠습니까?`)) {
            try {
                await companyService.deleteCompany(id);
                await fetchCompanies();
            } catch (error) {
                console.error("Failed to delete company", error);
                alert("삭제에 실패했습니다.");
            }
        }
    };

    const filteredCompanies = companies.filter(company =>
        company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.ceoName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.businessNumber.includes(searchTerm)
    );

    return (
        <div className="p-6 max-w-7xl mx-auto h-full flex flex-col">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faBuilding} className="text-blue-600" />
                        회사 관리
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        협력 업체(시공사)와 발주처(건설사)를 관리합니다.
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-bold shadow-sm"
                >
                    <FontAwesomeIcon icon={faPlus} />
                    회사 등록
                </button>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl mb-6 flex-shrink-0 w-fit">
                <button
                    onClick={() => setActiveTab('contractor')}
                    className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'contractor'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <FontAwesomeIcon icon={faHardHat} />
                    시공사 (지원팀)
                </button>
                <button
                    onClick={() => setActiveTab('client')}
                    className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'client'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <FontAwesomeIcon icon={faBriefcase} />
                    건설사 (발주사)
                </button>
            </div>

            {/* Search & Content */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1 overflow-hidden">
                {/* Search Bar */}
                <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                    <div className="relative flex-1 max-w-md">
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="회사명, 대표자, 사업자번호 검색..."
                            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="text-sm text-slate-500">
                        총 <span className="font-bold text-blue-600">{filteredCompanies.length}</span>개 업체
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center items-center h-full text-slate-400">
                            데이터를 불러오는 중...
                        </div>
                    ) : filteredCompanies.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                            <FontAwesomeIcon icon={faBuilding} className="text-4xl opacity-20" />
                            <p>등록된 회사가 없습니다.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                            {filteredCompanies.map(company => (
                                <div key={company.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow group relative">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${activeTab === 'contractor' ? 'bg-orange-50 text-orange-600' : 'bg-indigo-50 text-indigo-600'
                                                }`}>
                                                <FontAwesomeIcon icon={activeTab === 'contractor' ? faHardHat : faBriefcase} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-800 text-lg">{company.name}</h3>
                                                <span className="text-xs text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                                    {company.code}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleOpenModal(company)}
                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                            >
                                                <FontAwesomeIcon icon={faEdit} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(company.id!, company.name)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                            >
                                                <FontAwesomeIcon icon={faTrash} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-sm text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <FontAwesomeIcon icon={faUserTie} className="w-4 text-slate-400" />
                                            <span>{company.ceoName || '-'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <FontAwesomeIcon icon={faPhone} className="w-4 text-slate-400" />
                                            <span>{company.phone || '-'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <FontAwesomeIcon icon={faMapMarkerAlt} className="w-4 text-slate-400" />
                                            <span className="truncate">{company.address || '-'}</span>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                                        <span className="text-slate-400">사업자번호: {company.businessNumber || '-'}</span>
                                        <span className={`px-2 py-0.5 rounded-full font-medium ${company.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                            {company.status === 'active' ? '거래중' : '중지'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <FontAwesomeIcon icon={editingCompany ? faEdit : faPlus} className="text-blue-600" />
                                {editingCompany ? '회사 정보 수정' : '새 회사 등록'}
                            </h2>
                            <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600">
                                <FontAwesomeIcon icon={faBuilding} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">회사명 <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm p-2.5 border"
                                        placeholder="(주)회사명"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">대표자명</label>
                                    <input
                                        type="text"
                                        value={formData.ceoName}
                                        onChange={(e) => setFormData({ ...formData, ceoName: e.target.value })}
                                        className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm p-2.5 border"
                                        placeholder="홍길동"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">사업자번호</label>
                                    <input
                                        type="text"
                                        value={formData.businessNumber}
                                        onChange={(e) => setFormData({ ...formData, businessNumber: e.target.value })}
                                        className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm p-2.5 border"
                                        placeholder="000-00-00000"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">주소</label>
                                    <input
                                        type="text"
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm p-2.5 border"
                                        placeholder="서울특별시 강남구..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">연락처</label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm p-2.5 border"
                                        placeholder="02-0000-0000"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">상태</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                        className="w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm p-2.5 border"
                                    >
                                        <option value="active">거래중</option>
                                        <option value="inactive">거래중지</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-md"
                                >
                                    저장
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CompanyManagementPage;
