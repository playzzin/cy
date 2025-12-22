import React, { useState, useEffect } from 'react';
import { companyService, Company } from '../../services/companyService';
import CompanyForm from './CompanyForm';
import CompanyTable from './CompanyTable';
import CompanyModal from './CompanyModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faPlus } from '@fortawesome/free-solid-svg-icons';

const CompanyManagement: React.FC = () => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
    const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        const filtered = companies.filter(c =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.ceoName.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredCompanies(filtered);
    }, [companies, searchQuery]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const data = await companyService.getCompanies();
            setCompanies(data);
        } catch (error) {
            console.error("Failed to fetch companies", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveCompany = async (companyData: Omit<Company, 'id'> | Partial<Company>) => {
        try {
            if (currentCompany && currentCompany.id) {
                await companyService.updateCompany(currentCompany.id, companyData);
            } else {
                await companyService.addCompany(companyData as Omit<Company, 'id'>);
            }
            fetchData();
            setIsModalOpen(false);
            setIsRegistrationOpen(false);
        } catch (error) {
            console.error("Failed to save company", error);
            alert("저장에 실패했습니다.");
        }
    };

    const handleDeleteClick = async (e: React.MouseEvent, company: Company) => {
        e.stopPropagation();
        if (!company.id) return;
        if (window.confirm(`[${company.name}] 회사를 정말 삭제하시겠습니까?`)) {
            try {
                await companyService.deleteCompany(company.id);
                await fetchData();
                alert("삭제되었습니다.");
            } catch (error) {
                console.error("Failed to delete company", error);
                alert("삭제에 실패했습니다.");
            }
        }
    };

    const handleEditCompany = (company: Company) => {
        setCurrentCompany(company);
        setIsModalOpen(true);
    };

    const handleNewCompany = () => {
        setCurrentCompany(null);
        setIsRegistrationOpen(!isRegistrationOpen);
    };

    return (
        <div className="h-full flex flex-col gap-4 p-4 max-w-full mx-auto w-full">
            {/* Toolbar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-none sm:w-64">
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="회사명, 코드, 대표자명 검색..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={handleNewCompany}
                        title="회사 등록"
                        className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 whitespace-nowrap"
                    >
                        <FontAwesomeIcon icon={faPlus} />
                        <span>회사 등록</span>
                    </button>
                </div>
            </div>

            {/* Registration Accordion */}
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isRegistrationOpen ? 'max-h-[800px] opacity-100 mb-4' : 'max-h-0 opacity-0'}`}>
                <CompanyForm
                    onCancel={() => setIsRegistrationOpen(false)}
                    onSave={handleSaveCompany}
                />
            </div>

            {/* Table Container */}
            <CompanyTable
                companies={filteredCompanies}
                handleEditCompany={handleEditCompany}
                handleDeleteClick={handleDeleteClick}
            />

            {/* Modal */}
            {isModalOpen && (
                <CompanyModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSaveCompany}
                    initialData={currentCompany || undefined}
                />
            )}
        </div>
    );
};

export default CompanyManagement;
