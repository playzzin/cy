import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding,
    faPlus,
    faTrash,
    faEdit,
    faSearch,
    faHardHat,
    faBriefcase,
    faPhone,
    faMapMarkerAlt,
    faUserTie,
    faChartPie,
    faCheckCircle,
    faTimesCircle,
    faFileContract
} from '@fortawesome/free-solid-svg-icons';
import { companyService, Company } from '../../services/companyService';
import { motion, AnimatePresence } from 'framer-motion';

interface CompanyManagementPageProps {
    defaultOpenModal?: boolean;
}

const CompanyManagementPage: React.FC<CompanyManagementPageProps> = ({ defaultOpenModal = false }) => {
    const [activeTab, setActiveTab] = useState<'contractor' | 'client'>('contractor');
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(defaultOpenModal);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<Company>>({
        name: '',
        businessNumber: '',
        ceoName: '',
        address: '',
        phone: '',
        type: '협력사',
        status: 'active'
    });

    useEffect(() => {
        fetchCompanies();
    }, [activeTab]);

    useEffect(() => {
        if (defaultOpenModal) {
            handleOpenModal();
        }
    }, [defaultOpenModal]);

    const fetchCompanies = async () => {
        setLoading(true);
        try {
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

    // Statistics
    const stats = {
        total: companies.length,
        active: companies.filter(c => c.status === 'active').length,
        inactive: companies.filter(c => c.status !== 'active').length
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto h-full flex flex-col font-['Pretendard']">
            {/* Header Area */}
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <span className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                            <FontAwesomeIcon icon={faBuilding} />
                        </span>
                        {activeTab === 'contractor' ? '파트너사(협력사) 관리' : '발주처(건설사) 관리'}
                    </h1>
                    <p className="text-slate-500 mt-2 ml-1">
                        등록된 업체들의 정보와 계약 상태를 통합 관리합니다.
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('contractor')}
                        className={`px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 border ${activeTab === 'contractor'
                                ? 'bg-slate-800 text-white border-slate-800 shadow-md transform scale-105'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                            }`}
                    >
                        <FontAwesomeIcon icon={faHardHat} />
                        협력사
                    </button>
                    <button
                        onClick={() => setActiveTab('client')}
                        className={`px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 border ${activeTab === 'client'
                                ? 'bg-slate-800 text-white border-slate-800 shadow-md transform scale-105'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                            }`}
                    >
                        <FontAwesomeIcon icon={faBriefcase} />
                        건설사
                    </button>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 text-xl">
                        <FontAwesomeIcon icon={faFileContract} />
                    </div>
                    <div>
                        <div className="text-sm text-slate-500 font-medium">총 등록업체</div>
                        <div className="text-2xl font-black text-slate-800">{stats.total}<span className="text-sm text-slate-400 ml-1">개사</span></div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-600 text-xl">
                        <FontAwesomeIcon icon={faCheckCircle} />
                    </div>
                    <div>
                        <div className="text-sm text-slate-500 font-medium">거래 중</div>
                        <div className="text-2xl font-black text-slate-800">{stats.active}<span className="text-sm text-slate-400 ml-1">개사</span></div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-red-400 text-xl">
                        <FontAwesomeIcon icon={faTimesCircle} />
                    </div>
                    <div>
                        <div className="text-sm text-slate-500 font-medium">거래 중지/만료</div>
                        <div className="text-2xl font-black text-slate-800">{stats.inactive}<span className="text-sm text-slate-400 ml-1">개사</span></div>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex justify-between items-center mb-6">
                <div className="relative w-96">
                    <FontAwesomeIcon icon={faSearch} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="업체명, 대표자, 사업자번호 검색"
                        className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
                    />
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-200 transition-all font-bold flex items-center gap-2"
                >
                    <FontAwesomeIcon icon={faPlus} />
                    새 업체 등록
                </button>
            </div>

            {/* Grid Content */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {loading ? (
                    <div className="flex justify-center items-center h-64 text-slate-400">
                        <div className="animate-spin mr-2"><FontAwesomeIcon icon={faChartPie} /></div>
                        데이터를 불러오는 중...
                    </div>
                ) : filteredCompanies.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-white rounded-2xl border border-slate-200 border-dashed">
                        <FontAwesomeIcon icon={faBuilding} className="text-4xl opacity-20 mb-4" />
                        <p>검색 결과가 없습니다.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
                        <AnimatePresence>
                            {filteredCompanies.map((company, idx) => (
                                <motion.div
                                    key={company.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all border border-slate-100 group relative overflow-hidden"
                                >
                                    <div className={`absolute top-0 left-0 w-1 h-full ${company.status === 'active' ? 'bg-green-500' : 'bg-red-400'}`} />

                                    <div className="flex justify-between items-start mb-4 pl-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                {company.status === 'active' ? (
                                                    <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100">Active</span>
                                                ) : (
                                                    <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-100">Inactive</span>
                                                )}
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-800">{company.name}</h3>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => handleOpenModal(company)}
                                                className="w-8 h-8 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition-colors"
                                            >
                                                <FontAwesomeIcon icon={faEdit} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(company.id!, company.name)}
                                                className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors"
                                            >
                                                <FontAwesomeIcon icon={faTrash} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-3 pl-3">
                                        <div className="flex items-center gap-3 text-slate-600">
                                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 text-sm">
                                                <FontAwesomeIcon icon={faUserTie} />
                                            </div>
                                            <div>
                                                <div className="text-xs text-slate-400">대표자</div>
                                                <div className="font-medium">{company.ceoName || '-'}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 text-slate-600">
                                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 text-sm">
                                                <FontAwesomeIcon icon={faPhone} />
                                            </div>
                                            <div>
                                                <div className="text-xs text-slate-400">연락처</div>
                                                <div className="font-medium">{company.phone || '-'}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 text-slate-600">
                                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 text-sm">
                                                <FontAwesomeIcon icon={faMapMarkerAlt} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs text-slate-400">주소</div>
                                                <div className="font-medium truncate">{company.address || '-'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-slate-50 pl-3">
                                        <div className="flex justify-between text-xs text-slate-400">
                                            <span>사업자번호</span>
                                            <span className="font-mono">{company.businessNumber || '-'}</span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Premium Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                            onClick={handleCloseModal}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden relative z-10 font-['Pretendard']"
                        >
                            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 text-sm">
                                        <FontAwesomeIcon icon={editingCompany ? faEdit : faPlus} />
                                    </div>
                                    {editingCompany ? '업체 정보 수정' : '새 업체 등록'}
                                </h2>
                                <button onClick={handleCloseModal} className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors shadow-sm border border-slate-100">
                                    <FontAwesomeIcon icon={faTimesCircle} />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="p-8">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-bold text-slate-700 mb-2">회사명 <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                            className="w-full border-slate-200 bg-slate-50/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm p-3.5 transition-all"
                                            placeholder="법인명 또는 상호명을 입력하세요"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">대표자명</label>
                                        <div className="relative">
                                            <FontAwesomeIcon icon={faUserTie} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                value={formData.ceoName}
                                                onChange={(e) => setFormData({ ...formData, ceoName: e.target.value })}
                                                className="w-full border-slate-200 bg-slate-50/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm p-3.5 pl-10 transition-all"
                                                placeholder="예: 홍길동"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">사업자번호</label>
                                        <div className="relative">
                                            <FontAwesomeIcon icon={faFileContract} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                value={formData.businessNumber}
                                                onChange={(e) => setFormData({ ...formData, businessNumber: e.target.value })}
                                                className="w-full border-slate-200 bg-slate-50/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm p-3.5 pl-10 transition-all"
                                                placeholder="000-00-00000"
                                            />
                                        </div>
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-sm font-bold text-slate-700 mb-2">주소</label>
                                        <div className="relative">
                                            <FontAwesomeIcon icon={faMapMarkerAlt} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                value={formData.address}
                                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                                className="w-full border-slate-200 bg-slate-50/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm p-3.5 pl-10 transition-all"
                                                placeholder="상세 주소를 입력하세요"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">연락처</label>
                                        <div className="relative">
                                            <FontAwesomeIcon icon={faPhone} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                className="w-full border-slate-200 bg-slate-50/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm p-3.5 pl-10 transition-all"
                                                placeholder="02-0000-0000"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">거래 상태</label>
                                        <select
                                            value={formData.status}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                            className="w-full border-slate-200 bg-slate-50/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm p-3.5 transition-all appearance-none"
                                        >
                                            <option value="active">🟢 거래중</option>
                                            <option value="inactive">🔴 거래중지</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={handleCloseModal}
                                        className="px-6 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                                    >
                                        취소
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-8 py-3 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 hover:scale-[1.02]"
                                    >
                                        저장하기
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CompanyManagementPage;
