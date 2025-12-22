import React from 'react';
import { Worker } from '../../services/manpowerService';
import { Team } from '../../services/teamService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare, faTrash, faImages, faUsers, faUser, faDownload } from '@fortawesome/free-solid-svg-icons';
import { storage } from '../../config/firebase';
import { ref, getDownloadURL } from 'firebase/storage';

interface Column {
    id: string;
    label: string;
    fixed?: boolean;
}

interface WorkerTableProps {
    workers: Worker[];
    columns: Column[];
    visibleColumns: string[];
    selectedWorkerIds: string[];
    toggleSelectAll: () => void;
    toggleSelectWorker: (id: string) => void;
    handleEditWorker: (worker: Worker) => void;
    handleDeleteClick: (e: React.MouseEvent, worker: Worker) => void;
    teams: Team[];
    stats: {
        total: number;
        active: number;
        unassigned: number;
    };
    onStatusToggle: (id: string, currentStatus: string) => void;
}

const WorkerTable: React.FC<WorkerTableProps> = ({
    workers,
    columns,
    visibleColumns,
    selectedWorkerIds,
    toggleSelectAll,
    toggleSelectWorker,
    handleEditWorker,
    handleDeleteClick,
    teams,
    stats,
    onStatusToggle
}) => {
    const triggerDownloadFromUrl = (url: string, filename: string) => {
        const downloadUrl = new URL(url);
        const encodedFilename = encodeURIComponent(filename);
        downloadUrl.searchParams.set(
            'response-content-disposition',
            `attachment; filename*=UTF-8''${encodedFilename}`
        );

        const anchor = document.createElement('a');
        anchor.href = downloadUrl.toString();
        anchor.rel = 'noopener noreferrer';
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    };

    const getStorageErrorMessage = (error: unknown): string => {
        if (!error || typeof error !== 'object') return '알 수 없는 오류';

        const maybe = error as { code?: unknown; message?: unknown };
        const code = typeof maybe.code === 'string' ? maybe.code : undefined;
        const message = typeof maybe.message === 'string' ? maybe.message : undefined;

        if (code === 'storage/unauthorized') return '권한이 없습니다.';
        if (code === 'storage/object-not-found') return '파일이 존재하지 않습니다.';
        return message ?? '다운로드에 실패했습니다.';
    };

    const handleDownloadIdCard = async (worker: Worker) => {
        const path = worker.fileNameSaved;
        if (!path) {
            alert('등록된 신분증 이미지가 없습니다.');
            return;
        }

        try {
            const url = await getDownloadURL(ref(storage, path));
            const ext = path.split('.').pop() || 'jpg';
            const safeIdNumber = worker.idNumber || '미등록';
            const filename = `${worker.name}_${safeIdNumber}.${ext}`;
            triggerDownloadFromUrl(url, filename);
        } catch (error) {
            console.error('Download failed', error);
            alert(getStorageErrorMessage(error));
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex-1 overflow-hidden flex flex-col">
            <div className="overflow-auto flex-1">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10">
                        <tr>
                            <th className="p-4 w-4">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 text-brand-600 bg-gray-100 border-gray-300 rounded focus:ring-brand-500"
                                        checked={selectedWorkerIds.length === workers.length && workers.length > 0}
                                        onChange={toggleSelectAll}
                                    />
                                </div>
                            </th>
                            {columns.filter(col => visibleColumns.includes(col.id) || col.fixed).map(col => (
                                <th key={col.id} className="px-4 py-3 font-bold text-slate-600 whitespace-nowrap">
                                    {col.label}
                                </th>
                            ))}
                            <th className="px-4 py-3 text-right">관리</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {workers.map((worker) => {
                            const team = worker.teamId ? teams.find(t => t.id === worker.teamId) : undefined;
                            const iconColor = team?.color || worker.color || '#e5e7eb';

                            return (
                                <tr key={worker.id} className={`hover:bg-slate-50 transition-colors ${selectedWorkerIds.includes(worker.id!) ? 'bg-indigo-50/50' : ''}`}>
                                    <td className="p-4 w-4">
                                        <div className="flex items-center">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 text-brand-600 bg-gray-100 border-gray-300 rounded focus:ring-brand-500"
                                                checked={selectedWorkerIds.includes(worker.id!)}
                                                onChange={() => toggleSelectWorker(worker.id!)}
                                            />
                                        </div>
                                    </td>

                                    {columns.filter(col => visibleColumns.includes(col.id) || col.fixed).map(col => {
                                        if (col.id === 'name') return (
                                            <td key={col.id} className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-slate-200 flex-shrink-0"
                                                        style={{ backgroundColor: iconColor }}
                                                    >
                                                        <FontAwesomeIcon icon={faUser} className="text-white text-xs" />
                                                    </span>
                                                    <span>{worker.name}</span>
                                                </div>
                                            </td>
                                        );
                                        if (col.id === 'idNumber') return (
                                            <td key={col.id} className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                                {worker.idNumber}
                                            </td>
                                        );
                                        if (col.id === 'teamName') return (
                                            <td key={col.id} className="px-4 py-3 whitespace-nowrap">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                                                    {worker.teamName || '-'}
                                                </span>
                                            </td>
                                        );
                                        if (col.id === 'teamType') return (
                                            <td key={col.id} className="px-4 py-3 whitespace-nowrap">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                                                    {worker.teamType || '미배정'}
                                                </span>
                                            </td>
                                        );
                                        if (col.id === 'siteName') return (
                                            <td key={col.id} className="px-4 py-3 whitespace-nowrap">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                                                    {worker.siteName || '-'}
                                                </span>
                                            </td>
                                        );
                                        if (col.id === 'companyName') return (
                                            <td key={col.id} className="px-4 py-3 whitespace-nowrap">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                                                    {worker.companyName || '-'}
                                                </span>
                                            </td>
                                        );
                                        if (col.id === 'salaryModel') return (
                                            <td key={col.id} className="px-4 py-3 whitespace-nowrap">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                                                    {worker.salaryModel || '일급제'}
                                                </span>
                                            </td>
                                        );
                                        if (col.id === 'role') return (
                                            <td key={col.id} className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                                {worker.role || '작업자'}
                                            </td>
                                        );
                                        if (col.id === 'status') return (
                                            <td key={col.id} className="px-4 py-3 whitespace-nowrap">
                                                <button
                                                    onClick={() => onStatusToggle(worker.id!, worker.status)}
                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${worker.status === '재직' ? 'bg-green-500' : 'bg-slate-300'
                                                        }`}
                                                >
                                                    <span className="sr-only">상태 변경</span>
                                                    <span
                                                        className={`${worker.status === '재직' ? 'translate-x-5' : 'translate-x-1'
                                                            } inline-block h-3 w-3 transform rounded-full bg-white transition duration-200 ease-in-out`}
                                                    />
                                                </button>
                                                <span className="ml-2 text-xs text-slate-500">{worker.status}</span>
                                            </td>
                                        );
                                        if (col.id === 'contact') return (
                                            <td key={col.id} className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                                {worker.contact}
                                            </td>
                                        );
                                        if (col.id === 'email') return (
                                            <td key={col.id} className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                                {worker.email}
                                            </td>
                                        );
                                        if (col.id === 'address') return (
                                            <td key={col.id} className="px-4 py-3 text-slate-600 whitespace-nowrap max-w-[200px] truncate" title={worker.address}>
                                                {worker.address}
                                            </td>
                                        );
                                        if (col.id === 'unitPrice') return (
                                            <td key={col.id} className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                                {worker.unitPrice?.toLocaleString()}원
                                            </td>
                                        );
                                        if (col.id === 'bankInfo') return (
                                            <td key={col.id} className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                                {worker.bankName} {worker.accountNumber}
                                                {worker.accountHolder && <span className="text-xs text-slate-400 ml-1">({worker.accountHolder})</span>}
                                            </td>
                                        );
                                        if (col.id === 'accountStatus') return (
                                            <td key={col.id} className="px-4 py-3 whitespace-nowrap">
                                                <span className="text-slate-400 text-xs">미연동</span>
                                            </td>
                                        );
                                        if (col.id === 'fileNameSaved') return (
                                            <td key={col.id} className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                                {worker.fileNameSaved ? (
                                                    <button
                                                        onClick={() => handleDownloadIdCard(worker)}
                                                        className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-md transition-colors"
                                                    >
                                                        <FontAwesomeIcon icon={faDownload} /> 다운로드
                                                    </button>
                                                ) : '-'}
                                            </td>
                                        );
                                        return null;
                                    })}

                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleEditWorker(worker)}
                                                className="text-slate-400 hover:text-brand-600 transition"
                                            >
                                                <FontAwesomeIcon icon={faPenToSquare} />
                                            </button>
                                            <button
                                                onClick={(e) => handleDeleteClick(e, worker)}
                                                className="text-slate-400 hover:text-red-600 transition"
                                            >
                                                <FontAwesomeIcon icon={faTrash} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {workers.length === 0 && (
                            <tr>
                                <td colSpan={100} className="px-6 py-12 text-center text-slate-500">
                                    <div className="flex flex-col items-center justify-center">
                                        <FontAwesomeIcon icon={faUsers} className="text-4xl text-slate-300 mb-4" />
                                        <p>등록된 근로자가 없습니다.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="bg-slate-50 border-t border-slate-200 p-3 text-xs text-slate-500 flex justify-between items-center">
                <span>총 {stats.total}명 (재직: {stats.active}명, 미배정: {stats.unassigned}명)</span>
            </div>
        </div >
    );
};

export default WorkerTable;
