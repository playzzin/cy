import React, { useState } from 'react';
import { DailyReport, DailyReportWorker } from '../../../services/dailyReportService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding, faUsers, faUser, faTrash, faComment, faUserShield, faUserGear, faCoins, faClock
} from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';

interface DailyReportCardProps {
    report: DailyReport;
    onUpdateWorker: (reportId: string, workerId: string, field: keyof DailyReportWorker, value: any) => Promise<void>;
    onDeleteWorker: (reportId: string, workerId: string, workerName: string) => Promise<void>;
    onUpdateReport?: (reportId: string, field: keyof DailyReport, value: any) => Promise<void>; // Optional for now
}

const DailyReportCard: React.FC<DailyReportCardProps> = ({
    report,
    onUpdateWorker,
    onDeleteWorker,
    onUpdateReport
}) => {
    const [editingCell, setEditingCell] = useState<string | null>(null);

    const getRoleIcon = (role?: string) => {
        if (!role) return faUser;
        if (role.includes('사장') || role.includes('대표')) return faUserShield;
        if (role.includes('팀장') || role.includes('반장')) return faUserGear;
        return faUser;
    };

    const handleInlineSave = async (workerId: string, field: keyof DailyReportWorker, value: any) => {
        if (!report.id) return;
        try {
            await onUpdateWorker(report.id, workerId, field, value);
            setEditingCell(null);
        } catch (error) {
            console.error("Failed to update worker", error);
            Swal.fire('Error', '수정 중 오류가 발생했습니다.', 'error');
        }
    };

    return (
        <div className="bg-white border border-slate-300 rounded-lg overflow-hidden shadow-sm flex flex-col w-full hover:shadow-md transition-shadow">
            {/* Header */}
            <div className="bg-[#4A192C] text-white px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2" title="현장">
                        <FontAwesomeIcon icon={faBuilding} className="text-white/70 text-xs" />
                        <span className="font-bold text-sm tracking-tight">{report.siteName}</span>
                    </div>
                    <div className="w-px h-3 bg-white/30"></div>
                    <div className="flex items-center gap-2" title="작업팀">
                        <FontAwesomeIcon icon={faUsers} className="text-white/70 text-xs" />
                        <span className="font-bold text-sm tracking-tight">{report.teamName}</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold" title="총 공수">
                        {report.totalManDay.toFixed(1)}공수
                    </span>
                </div>
            </div>

            {/* Site Metadata / Partners */}
            {(report.companyName || report.partnerName) && (
                <div className="bg-[#5d253b] px-3 py-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/90 border-t border-white/10">
                    {report.companyName && (
                        <div className="flex items-center gap-1.5 opacity-80">
                            <span className="font-light">발주:</span>
                            <span className="font-medium">{report.companyName}</span>
                        </div>
                    )}
                    {report.partnerName && (
                        <div className="flex items-center gap-1.5 opacity-80">
                            <span className="font-light">협력:</span>
                            <span className="font-medium">{report.partnerName}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Workers Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase">
                        <tr>
                            <th className="px-3 py-2 border-b w-24">이름</th>
                            <th className="px-3 py-2 border-b w-20 text-center">공수</th>
                            <th className="px-3 py-2 border-b w-24 text-right">단가</th>
                            <th className="px-3 py-2 border-b w-24">급여구분</th>
                            <th className="px-3 py-2 border-b">작업내용</th>
                            <th className="px-3 py-2 border-b w-8"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {report.workers.map((worker) => (
                            <tr key={worker.workerId} className="group hover:bg-slate-50 transition-colors">
                                {/* Name */}
                                <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                            <FontAwesomeIcon icon={getRoleIcon(worker.role)} className="text-slate-400 text-xs" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-700 leading-tight">{worker.name}</div>
                                            <div className="text-[10px] text-slate-400">{worker.role || '작업자'}</div>
                                        </div>
                                    </div>
                                </td>

                                {/* ManDay */}
                                <td className="px-3 py-2 text-center">
                                    {editingCell === `${worker.workerId}-manDay` ? (
                                        <input
                                            type="number"
                                            step="0.1"
                                            autoFocus
                                            defaultValue={worker.manDay}
                                            onBlur={(e) => handleInlineSave(worker.workerId, 'manDay', parseFloat(e.target.value) || 0)}
                                            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                            className="w-16 px-1 py-1 text-center border-2 border-brand-500 rounded font-bold text-brand-600 outline-none bg-white"
                                        />
                                    ) : (
                                        <button
                                            onClick={() => setEditingCell(`${worker.workerId}-manDay`)}
                                            className="px-2 py-1 rounded hover:bg-white hover:shadow-sm hover:ring-1 hover:ring-slate-200 transition-all font-bold text-slate-600"
                                        >
                                            {worker.manDay.toFixed(1)}
                                        </button>
                                    )}
                                </td>

                                {/* Unit Price */}
                                <td className="px-3 py-2 text-right">
                                    {editingCell === `${worker.workerId}-unitPrice` ? (
                                        <input
                                            type="number"
                                            autoFocus
                                            defaultValue={worker.unitPrice || 0}
                                            onBlur={(e) => handleInlineSave(worker.workerId, 'unitPrice', parseInt(e.target.value) || 0)}
                                            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                            className="w-20 px-1 py-1 text-right border-2 border-brand-500 rounded font-medium outline-none bg-white"
                                        />
                                    ) : (
                                        <button
                                            onClick={() => setEditingCell(`${worker.workerId}-unitPrice`)}
                                            className="px-2 py-1 rounded hover:bg-white hover:shadow-sm hover:ring-1 hover:ring-slate-200 transition-all font-mono text-slate-500"
                                        >
                                            {(worker.unitPrice || 0).toLocaleString()}
                                        </button>
                                    )}
                                </td>

                                {/* Salary Model */}
                                <td className="px-3 py-2">
                                    <select
                                        value={worker.salaryModel || '일급제'}
                                        onChange={(e) => handleInlineSave(worker.workerId, 'salaryModel', e.target.value)}
                                        className={`w-full px-2 py-1 text-xs border rounded cursor-pointer outline-none appearance-none font-medium text-center
                                            ${worker.salaryModel === '일급제' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                worker.salaryModel === '월급제' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                    worker.salaryModel === '지원팀' ? 'bg-green-50 text-green-700 border-green-200' :
                                                        worker.salaryModel === '용역팀' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                            'bg-slate-50 text-slate-700 border-slate-200'}`}
                                    >
                                        <option value="일급제">일급제</option>
                                        <option value="월급제">월급제</option>
                                        <option value="지원팀">지원팀</option>
                                        <option value="용역팀">용역팀</option>
                                    </select>
                                </td>

                                {/* Work Content */}
                                <td className="px-3 py-2">
                                    <input
                                        type="text"
                                        defaultValue={worker.workContent || ''}
                                        placeholder="작업 내용"
                                        onBlur={(e) => handleInlineSave(worker.workerId, 'workContent', e.target.value)}
                                        className="w-full px-2 py-1 text-xs bg-transparent border border-transparent rounded hover:bg-white hover:border-slate-200 focus:bg-white focus:border-brand-500 outline-none transition-all placeholder-slate-300"
                                    />
                                </td>

                                {/* Actions */}
                                <td className="px-3 py-2 text-right">
                                    <button
                                        onClick={() => report.id && onDeleteWorker(report.id, worker.workerId, worker.name)}
                                        className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                        title="삭제"
                                    >
                                        <FontAwesomeIcon icon={faTrash} className="text-xs" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer / Report Level Info */}
            <div className="bg-slate-50 border-t border-slate-200 px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                    <FontAwesomeIcon icon={faComment} className="text-slate-400 text-xs" />
                    <input
                        type="text"
                        defaultValue={report.workContent || ''}
                        placeholder="이 장부의 전체 작업 내용 (선택사항)"
                        onBlur={(e) => report.id && onUpdateReport && onUpdateReport(report.id, 'workContent', e.target.value)}
                        className="flex-1 bg-transparent text-xs font-medium text-slate-700 placeholder-slate-400 outline-none border-b border-transparent focus:border-brand-500 transition-colors py-0.5"
                    />
                </div>
            </div>
        </div>
    );
};

export default DailyReportCard;
