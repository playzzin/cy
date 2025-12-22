import React from 'react';
import { Company } from '../../services/companyService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare, faTrash, faBuilding } from '@fortawesome/free-solid-svg-icons';

interface CompanyTableProps {
    companies: Company[];
    handleEditCompany: (company: Company) => void;
    handleDeleteClick: (e: React.MouseEvent, company: Company) => void;
}

const CompanyTable: React.FC<CompanyTableProps> = ({
    companies,
    handleEditCompany,
    handleDeleteClick
}) => {
    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex-1 overflow-hidden flex flex-col">
            <div className="overflow-auto flex-1">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-3 font-bold text-slate-600 whitespace-nowrap">회사명</th>
                            <th className="px-4 py-3 font-bold text-slate-600 whitespace-nowrap">코드</th>
                            <th className="px-4 py-3 font-bold text-slate-600 whitespace-nowrap">사업자번호</th>
                            <th className="px-4 py-3 font-bold text-slate-600 whitespace-nowrap">대표자명</th>
                            <th className="px-4 py-3 font-bold text-slate-600 whitespace-nowrap">연락처</th>
                            <th className="px-4 py-3 font-bold text-slate-600 whitespace-nowrap">구분</th>
                            <th className="px-4 py-3 font-bold text-slate-600 whitespace-nowrap">주소</th>
                            <th className="px-4 py-3 text-right">관리</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {companies.map((company) => (
                            <tr key={company.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-slate-200 bg-slate-100 flex-shrink-0"
                                            style={{ backgroundColor: company.color || '#e5e7eb' }}
                                        >
                                            <FontAwesomeIcon icon={faBuilding} className="text-white text-xs" />
                                        </span>
                                        <span>{company.name}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                    {company.code}
                                </td>
                                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                    {company.businessNumber}
                                </td>
                                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                    {company.ceoName}
                                </td>
                                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                    {company.phone}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${company.type === '시공사' ? 'bg-blue-100 text-blue-800' :
                                            company.type === '협력사' ? 'bg-green-100 text-green-800' :
                                                company.type === '건설사' ? 'bg-indigo-100 text-indigo-800' :
                                                    'bg-slate-100 text-slate-800'
                                        }`}>
                                        {company.type}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-slate-600 whitespace-nowrap max-w-[200px] truncate" title={company.address}>
                                    {company.address}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => handleEditCompany(company)}
                                            className="text-slate-400 hover:text-brand-600 transition"
                                        >
                                            <FontAwesomeIcon icon={faPenToSquare} />
                                        </button>
                                        <button
                                            onClick={(e) => handleDeleteClick(e, company)}
                                            className="text-slate-400 hover:text-red-600 transition"
                                        >
                                            <FontAwesomeIcon icon={faTrash} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {companies.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                                    <div className="flex flex-col items-center justify-center">
                                        <FontAwesomeIcon icon={faBuilding} className="text-4xl text-slate-300 mb-4" />
                                        <p>등록된 회사가 없습니다.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="bg-slate-50 border-t border-slate-200 p-3 text-xs text-slate-500 flex justify-between items-center">
                <span>총 {companies.length}개 회사</span>
            </div>
        </div>
    );
};

export default CompanyTable;
