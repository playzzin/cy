import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faMoneyBillWave,
    faWonSign,
    faHandHoldingDollar,
    faFileInvoiceDollar,
    faSearch,
    faSave,
    faSpinner
} from '@fortawesome/free-solid-svg-icons';
import { useMasterData } from '../../contexts/MasterDataContext';
import { manpowerService, Worker } from '../../services/manpowerService';
import { teamService, Team } from '../../services/teamService';
import { confirm, toast } from '../../utils/swal';
import { db } from '../../config/firebase';
import { Timestamp, doc, serverTimestamp, writeBatch } from 'firebase/firestore';

type TabType = 'unit' | 'support' | 'service';
type BulkModelOption = 'keep' | 'man_day' | 'fixed';

const isDefined = <T,>(value: T | null | undefined): value is T => value !== null && value !== undefined;

const parseNonNegativeNumber = (value: string): number | null => {
    const trimmed = value.trim();
    if (trimmed === '') return null;

    const num = Number(trimmed);
    if (!Number.isFinite(num) || num < 0) return null;

    return num;
};

const PayrollRateManagementPage: React.FC = () => {
    const { teams, loading: teamsLoading, refreshTeams } = useMasterData();
    const [searchParams] = useSearchParams();

    const [activeTab, setActiveTab] = useState<TabType>('unit');

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'unit' || tab === 'support' || tab === 'service') {
            setActiveTab(tab);
        }
    }, [searchParams]);

    const [workers, setWorkers] = useState<Worker[]>([]);
    const [workersLoading, setWorkersLoading] = useState(false);

    const [unitSearchTerm, setUnitSearchTerm] = useState('');
    const [unitTeamIdFilter, setUnitTeamIdFilter] = useState<string>('');
    const [unitSalaryModelFilter, setUnitSalaryModelFilter] = useState<string>('');
    const [unitEdits, setUnitEdits] = useState<Record<string, { unitPrice: number }>>({});
    const [unitSaving, setUnitSaving] = useState(false);
    const [unitBulkApplying, setUnitBulkApplying] = useState(false);
    const [unitBulkValue, setUnitBulkValue] = useState<string>('');

    const [supportSearchTerm, setSupportSearchTerm] = useState('');
    const [supportTypeFilter, setSupportTypeFilter] = useState<string>('');
    const [supportEdits, setSupportEdits] = useState<Record<string, Partial<Team>>>({});
    const [supportSaving, setSupportSaving] = useState(false);
    const [supportBulkApplying, setSupportBulkApplying] = useState(false);
    const [supportBulkRate, setSupportBulkRate] = useState<string>('');
    const [supportBulkModel, setSupportBulkModel] = useState<BulkModelOption>('keep');
    const [supportBulkDescription, setSupportBulkDescription] = useState<string>('');

    const [serviceSearchTerm, setServiceSearchTerm] = useState('');
    const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('');
    const [serviceEdits, setServiceEdits] = useState<Record<string, Partial<Team>>>({});
    const [serviceSaving, setServiceSaving] = useState(false);
    const [serviceBulkApplying, setServiceBulkApplying] = useState(false);
    const [serviceBulkRate, setServiceBulkRate] = useState<string>('');
    const [serviceBulkModel, setServiceBulkModel] = useState<BulkModelOption>('keep');
    const [serviceBulkDescription, setServiceBulkDescription] = useState<string>('');

    const salaryModelOptions = useMemo(
        () => ['', '일급제', '주급제', '월급제', '지원팀', '용역팀', '가지급'],
        []
    );

    const teamTypeOptions = useMemo(() => {
        const types = Array.from(new Set(teams.map(t => t.type).filter(isDefined))).sort((a, b) => a.localeCompare(b));
        return [''].concat(types);
    }, [teams]);

    const fetchWorkers = async () => {
        setWorkersLoading(true);
        try {
            const data = await manpowerService.getWorkers();
            setWorkers(data);
        } catch (error) {
            console.error('작업자 목록 로드 실패:', error);
            toast.error('작업자 목록을 불러오지 못했습니다.');
        } finally {
            setWorkersLoading(false);
        }
    };

    useEffect(() => {
        fetchWorkers();
    }, []);

    const filteredWorkers = useMemo(() => {
        const term = unitSearchTerm.trim().toLowerCase();
        return workers.filter(w => {
            const matchesSearch =
                term === '' ||
                w.name.toLowerCase().includes(term) ||
                (w.teamName ?? '').toLowerCase().includes(term) ||
                (w.role ?? '').toLowerCase().includes(term);

            const matchesTeam = unitTeamIdFilter === '' || w.teamId === unitTeamIdFilter;
            const matchesSalaryModel = unitSalaryModelFilter === '' || (w.salaryModel ?? '') === unitSalaryModelFilter;

            return matchesSearch && matchesTeam && matchesSalaryModel;
        });
    }, [workers, unitSearchTerm, unitTeamIdFilter, unitSalaryModelFilter]);

    const unitChangedWorkerUpdates = useMemo(() => {
        const updates: Array<{ workerId: string; unitPrice: number }> = [];

        Object.entries(unitEdits).forEach(([workerId, edit]) => {
            const original = workers.find(w => w.id === workerId);
            if (!original) return;

            const originalUnitPrice = Number.isFinite(original.unitPrice) ? original.unitPrice : 0;
            if (edit.unitPrice !== originalUnitPrice) {
                updates.push({ workerId, unitPrice: edit.unitPrice });
            }
        });

        return updates;
    }, [unitEdits, workers]);

    const handleUnitPriceChange = (workerId: string, value: number) => {
        setUnitEdits(prev => ({
            ...prev,
            [workerId]: { unitPrice: value }
        }));
    };

    const saveUnitPriceChanges = async () => {
        if (unitChangedWorkerUpdates.length === 0) return;

        const result = await confirm.save('단가 변경사항 저장');
        if (!result.isConfirmed) return;

        setUnitSaving(true);
        try {
            const CHUNK_SIZE = 450;
            for (let i = 0; i < unitChangedWorkerUpdates.length; i += CHUNK_SIZE) {
                const chunk = unitChangedWorkerUpdates.slice(i, i + CHUNK_SIZE);
                const batch = writeBatch(db);
                chunk.forEach(u => {
                    batch.update(doc(db, 'workers', u.workerId), {
                        unitPrice: u.unitPrice,
                        updatedAt: serverTimestamp()
                    });
                });
                await batch.commit();
            }

            toast.updated('작업자');
            setUnitEdits({});
            await fetchWorkers();
        } catch (error) {
            console.error('단가 저장 실패:', error);
            toast.error('단가 저장 중 오류가 발생했습니다.');
        } finally {
            setUnitSaving(false);
        }
    };

    const applyBulkUnitPrice = async () => {
        const parsed = parseNonNegativeNumber(unitBulkValue);
        if (parsed === null) {
            toast.warning('유효한 단가를 입력해주세요.');
            return;
        }

        const targetIds = filteredWorkers.map(w => w.id).filter(isDefined);
        if (targetIds.length === 0) {
            toast.info('적용할 작업자가 없습니다.');
            return;
        }

        const result = await confirm.batch('작업자', targetIds.length);
        if (!result.isConfirmed) return;

        setUnitBulkApplying(true);
        try {
            await manpowerService.updateWorkersBatch(targetIds, { unitPrice: parsed });
            setUnitBulkValue('');
            setUnitEdits({});
            await fetchWorkers();
        } catch (error) {
            console.error('단가 일괄 적용 실패:', error);
            toast.error('단가 일괄 적용 중 오류가 발생했습니다.');
        } finally {
            setUnitBulkApplying(false);
        }
    };

    const filteredSupportTeams = useMemo(() => {
        const term = supportSearchTerm.trim().toLowerCase();
        return teams.filter(t => {
            const matchesSearch =
                term === '' ||
                t.name.toLowerCase().includes(term) ||
                t.type.toLowerCase().includes(term) ||
                (t.leaderName ?? '').toLowerCase().includes(term);

            const matchesType = supportTypeFilter === '' || t.type === supportTypeFilter;
            return matchesSearch && matchesType;
        });
    }, [teams, supportSearchTerm, supportTypeFilter]);

    const supportChangedTeamUpdates = useMemo(() => {
        const updates: Array<{ teamId: string; data: Partial<Team> }> = [];

        Object.entries(supportEdits).forEach(([teamId, edit]) => {
            const original = teams.find(t => t.id === teamId);
            if (!original) return;

            const nextData: Partial<Team> = {};
            const nextRate = edit.supportRate;
            const nextModel = edit.supportModel;
            const nextDesc = edit.supportDescription;

            if (nextRate !== undefined && nextRate !== original.supportRate) nextData.supportRate = nextRate;
            if (nextModel !== undefined && nextModel !== original.supportModel) nextData.supportModel = nextModel;
            if (nextDesc !== undefined && nextDesc !== original.supportDescription) nextData.supportDescription = nextDesc;

            if (Object.keys(nextData).length > 0) {
                updates.push({ teamId, data: nextData });
            }
        });

        return updates;
    }, [supportEdits, teams]);

    const handleSupportChange = (teamId: string, field: keyof Team, value: Team[keyof Team]) => {
        setSupportEdits(prev => ({
            ...prev,
            [teamId]: {
                ...prev[teamId],
                [field]: value
            }
        }));
    };

    const saveSupportChanges = async () => {
        if (supportChangedTeamUpdates.length === 0) return;

        const result = await confirm.save('지원비 변경사항 저장');
        if (!result.isConfirmed) return;

        setSupportSaving(true);
        try {
            const CHUNK_SIZE = 450;
            for (let i = 0; i < supportChangedTeamUpdates.length; i += CHUNK_SIZE) {
                const chunk = supportChangedTeamUpdates.slice(i, i + CHUNK_SIZE);
                const batch = writeBatch(db);
                chunk.forEach(u => {
                    batch.update(doc(db, 'teams', u.teamId), {
                        ...u.data,
                        updatedAt: Timestamp.now()
                    });
                });
                await batch.commit();
            }

            toast.updated('팀');
            setSupportEdits({});
            await refreshTeams();
        } catch (error) {
            console.error('지원비 저장 실패:', error);
            toast.error('지원비 저장 중 오류가 발생했습니다.');
        } finally {
            setSupportSaving(false);
        }
    };

    const applyBulkSupport = async () => {
        const parsedRate = parseNonNegativeNumber(supportBulkRate);
        if (parsedRate === null) {
            toast.warning('유효한 지원비 단가를 입력해주세요.');
            return;
        }

        const targetIds = filteredSupportTeams.map(t => t.id).filter(isDefined);
        if (targetIds.length === 0) {
            toast.info('적용할 팀이 없습니다.');
            return;
        }

        const result = await confirm.batch('팀', targetIds.length);
        if (!result.isConfirmed) return;

        const updates: Partial<Team> = { supportRate: parsedRate };
        if (supportBulkModel !== 'keep') updates.supportModel = supportBulkModel;
        if (supportBulkDescription.trim() !== '') updates.supportDescription = supportBulkDescription.trim();

        setSupportBulkApplying(true);
        try {
            await teamService.updateTeamsBatch(targetIds, updates);
            setSupportBulkRate('');
            setSupportBulkModel('keep');
            setSupportBulkDescription('');
            setSupportEdits({});
            await refreshTeams();
        } catch (error) {
            console.error('지원비 일괄 적용 실패:', error);
            toast.error('지원비 일괄 적용 중 오류가 발생했습니다.');
        } finally {
            setSupportBulkApplying(false);
        }
    };

    const filteredServiceTeams = useMemo(() => {
        const term = serviceSearchTerm.trim().toLowerCase();
        return teams.filter(t => {
            const matchesSearch =
                term === '' ||
                t.name.toLowerCase().includes(term) ||
                t.type.toLowerCase().includes(term) ||
                (t.leaderName ?? '').toLowerCase().includes(term);

            const matchesType = serviceTypeFilter === '' || t.type === serviceTypeFilter;
            return matchesSearch && matchesType;
        });
    }, [teams, serviceSearchTerm, serviceTypeFilter]);

    const serviceChangedTeamUpdates = useMemo(() => {
        const updates: Array<{ teamId: string; data: Partial<Team> }> = [];

        Object.entries(serviceEdits).forEach(([teamId, edit]) => {
            const original = teams.find(t => t.id === teamId);
            if (!original) return;

            const nextData: Partial<Team> = {};
            const nextRate = edit.serviceRate;
            const nextModel = edit.serviceModel;
            const nextDesc = edit.serviceDescription;

            if (nextRate !== undefined && nextRate !== original.serviceRate) nextData.serviceRate = nextRate;
            if (nextModel !== undefined && nextModel !== original.serviceModel) nextData.serviceModel = nextModel;
            if (nextDesc !== undefined && nextDesc !== original.serviceDescription) nextData.serviceDescription = nextDesc;

            if (Object.keys(nextData).length > 0) {
                updates.push({ teamId, data: nextData });
            }
        });

        return updates;
    }, [serviceEdits, teams]);

    const handleServiceChange = (teamId: string, field: keyof Team, value: Team[keyof Team]) => {
        setServiceEdits(prev => ({
            ...prev,
            [teamId]: {
                ...prev[teamId],
                [field]: value
            }
        }));
    };

    const saveServiceChanges = async () => {
        if (serviceChangedTeamUpdates.length === 0) return;

        const result = await confirm.save('용역비 변경사항 저장');
        if (!result.isConfirmed) return;

        setServiceSaving(true);
        try {
            const CHUNK_SIZE = 450;
            for (let i = 0; i < serviceChangedTeamUpdates.length; i += CHUNK_SIZE) {
                const chunk = serviceChangedTeamUpdates.slice(i, i + CHUNK_SIZE);
                const batch = writeBatch(db);
                chunk.forEach(u => {
                    batch.update(doc(db, 'teams', u.teamId), {
                        ...u.data,
                        updatedAt: Timestamp.now()
                    });
                });
                await batch.commit();
            }

            toast.updated('팀');
            setServiceEdits({});
            await refreshTeams();
        } catch (error) {
            console.error('용역비 저장 실패:', error);
            toast.error('용역비 저장 중 오류가 발생했습니다.');
        } finally {
            setServiceSaving(false);
        }
    };

    const applyBulkService = async () => {
        const parsedRate = parseNonNegativeNumber(serviceBulkRate);
        if (parsedRate === null) {
            toast.warning('유효한 용역비 단가를 입력해주세요.');
            return;
        }

        const targetIds = filteredServiceTeams.map(t => t.id).filter(isDefined);
        if (targetIds.length === 0) {
            toast.info('적용할 팀이 없습니다.');
            return;
        }

        const result = await confirm.batch('팀', targetIds.length);
        if (!result.isConfirmed) return;

        const updates: Partial<Team> = { serviceRate: parsedRate };
        if (serviceBulkModel !== 'keep') updates.serviceModel = serviceBulkModel;
        if (serviceBulkDescription.trim() !== '') updates.serviceDescription = serviceBulkDescription.trim();

        setServiceBulkApplying(true);
        try {
            await teamService.updateTeamsBatch(targetIds, updates);
            setServiceBulkRate('');
            setServiceBulkModel('keep');
            setServiceBulkDescription('');
            setServiceEdits({});
            await refreshTeams();
        } catch (error) {
            console.error('용역비 일괄 적용 실패:', error);
            toast.error('용역비 일괄 적용 중 오류가 발생했습니다.');
        } finally {
            setServiceBulkApplying(false);
        }
    };

    const renderUnitTab = () => {
        const changedCount = unitChangedWorkerUpdates.length;

        return (
            <div className="p-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col gap-3">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                                <div className="relative flex-1 max-w-sm">
                                    <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={unitSearchTerm}
                                        onChange={(e) => setUnitSearchTerm(e.target.value)}
                                        placeholder="작업자/팀/직책 검색..."
                                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>

                                <select
                                    value={unitTeamIdFilter}
                                    onChange={(e) => setUnitTeamIdFilter(e.target.value)}
                                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="">전체 팀</option>
                                    {teams.map(team => (
                                        <option key={team.id} value={team.id}>
                                            {team.name}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    value={unitSalaryModelFilter}
                                    onChange={(e) => setUnitSalaryModelFilter(e.target.value)}
                                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="">전체 구분</option>
                                    {salaryModelOptions.filter(v => v !== '').map(v => (
                                        <option key={v} value={v}>
                                            {v}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={saveUnitPriceChanges}
                                disabled={unitSaving || changedCount === 0}
                                className={`
                                    px-4 py-2 rounded-lg font-bold text-white shadow-md flex items-center gap-2 transition-all
                                    ${changedCount > 0
                                        ? 'bg-indigo-600 hover:bg-indigo-700'
                                        : 'bg-slate-300 cursor-not-allowed'}
                                `}
                            >
                                {unitSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                                {unitSaving ? '저장 중...' : `변경사항 저장 (${changedCount})`}
                            </button>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex items-center gap-2">
                                <FontAwesomeIcon icon={faWonSign} className="text-slate-500" />
                                <input
                                    type="number"
                                    value={unitBulkValue}
                                    onChange={(e) => setUnitBulkValue(e.target.value)}
                                    placeholder="필터된 작업자 단가 일괄 적용"
                                    className="w-56 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    min={0}
                                />
                            </div>

                            <button
                                onClick={applyBulkUnitPrice}
                                disabled={unitBulkApplying}
                                className="px-4 py-2 rounded-lg font-bold text-white bg-slate-700 hover:bg-slate-800 transition flex items-center gap-2 disabled:opacity-50"
                            >
                                {unitBulkApplying ? <FontAwesomeIcon icon={faSpinner} spin /> : null}
                                필터 적용 ({filteredWorkers.length})
                            </button>

                            <div className="text-xs text-slate-500">
                                현재 필터 결과: <span className="font-bold text-slate-700">{filteredWorkers.length}명</span>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3 font-semibold">작업자</th>
                                    <th className="px-6 py-3 font-semibold">팀</th>
                                    <th className="px-6 py-3 font-semibold">구분</th>
                                    <th className="px-6 py-3 font-semibold text-right">단가 (원)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {workersLoading ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                            <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                                            데이터를 불러오는 중입니다...
                                        </td>
                                    </tr>
                                ) : filteredWorkers.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500">검색 결과가 없습니다.</td>
                                    </tr>
                                ) : (
                                    filteredWorkers.map(worker => {
                                        if (!worker.id) return null;

                                        const edit = unitEdits[worker.id];
                                        const currentUnitPrice = edit?.unitPrice ?? (Number.isFinite(worker.unitPrice) ? worker.unitPrice : 0);
                                        const isEdited = edit !== undefined && currentUnitPrice !== worker.unitPrice;

                                        return (
                                            <tr key={worker.id} className={`hover:bg-slate-50 transition-colors ${isEdited ? 'bg-indigo-50/30' : ''}`}>
                                                <td className="px-6 py-3 font-medium text-slate-800">
                                                    {worker.name}
                                                    {isEdited && <span className="ml-2 w-2 h-2 inline-block rounded-full bg-indigo-500" />}
                                                </td>
                                                <td className="px-6 py-3 text-slate-500">{worker.teamName || '-'}</td>
                                                <td className="px-6 py-3 text-slate-500">{worker.salaryModel || '-'}</td>
                                                <td className="px-6 py-3">
                                                    <div className="relative max-w-[180px] ml-auto">
                                                        <input
                                                            type="number"
                                                            value={currentUnitPrice}
                                                            onChange={(e) => handleUnitPriceChange(worker.id!, Number(e.target.value))}
                                                            className="w-full border border-slate-200 rounded px-3 py-1.5 text-right pr-10 text-sm focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                                                            min={0}
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">원</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderSupportTab = () => {
        const changedCount = supportChangedTeamUpdates.length;

        return (
            <div className="p-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col gap-3">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                                <div className="relative flex-1 max-w-sm">
                                    <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={supportSearchTerm}
                                        onChange={(e) => setSupportSearchTerm(e.target.value)}
                                        placeholder="팀명/시공종목/팀장 검색..."
                                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>

                                <select
                                    value={supportTypeFilter}
                                    onChange={(e) => setSupportTypeFilter(e.target.value)}
                                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="">전체 팀 구분</option>
                                    {teamTypeOptions.filter(v => v !== '').map(v => (
                                        <option key={v} value={v}>
                                            {v}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={saveSupportChanges}
                                disabled={supportSaving || changedCount === 0}
                                className={`
                                    px-4 py-2 rounded-lg font-bold text-white shadow-md flex items-center gap-2 transition-all
                                    ${changedCount > 0
                                        ? 'bg-indigo-600 hover:bg-indigo-700'
                                        : 'bg-slate-300 cursor-not-allowed'}
                                `}
                            >
                                {supportSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                                {supportSaving ? '저장 중...' : `변경사항 저장 (${changedCount})`}
                            </button>
                        </div>

                        <div className="flex flex-col xl:flex-row xl:items-center gap-3">
                            <div className="flex items-center gap-2">
                                <FontAwesomeIcon icon={faHandHoldingDollar} className="text-slate-500" />
                                <input
                                    type="number"
                                    value={supportBulkRate}
                                    onChange={(e) => setSupportBulkRate(e.target.value)}
                                    placeholder="필터된 팀 지원비 단가"
                                    className="w-56 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    min={0}
                                />
                            </div>

                            <select
                                value={supportBulkModel}
                                onChange={(e) => setSupportBulkModel(e.target.value as BulkModelOption)}
                                className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="keep">방식 유지</option>
                                <option value="man_day">공수제 (Man-Day)</option>
                                <option value="fixed">고정급 (Fixed)</option>
                            </select>

                            <input
                                type="text"
                                value={supportBulkDescription}
                                onChange={(e) => setSupportBulkDescription(e.target.value)}
                                placeholder="비고(선택)"
                                className="flex-1 min-w-[180px] border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />

                            <button
                                onClick={applyBulkSupport}
                                disabled={supportBulkApplying}
                                className="px-4 py-2 rounded-lg font-bold text-white bg-slate-700 hover:bg-slate-800 transition flex items-center gap-2 disabled:opacity-50"
                            >
                                {supportBulkApplying ? <FontAwesomeIcon icon={faSpinner} spin /> : null}
                                필터 적용 ({filteredSupportTeams.length})
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3 font-semibold">팀명</th>
                                    <th className="px-6 py-3 font-semibold">시공종목</th>
                                    <th className="px-6 py-3 font-semibold">지원비 방식</th>
                                    <th className="px-6 py-3 font-semibold text-right">청구 단가 (원)</th>
                                    <th className="px-6 py-3 font-semibold">비고</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {teamsLoading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                            <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                                            데이터를 불러오는 중입니다...
                                        </td>
                                    </tr>
                                ) : filteredSupportTeams.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">검색 결과가 없습니다.</td>
                                    </tr>
                                ) : (
                                    filteredSupportTeams.map(team => {
                                        if (!team.id) return null;

                                        const edit = supportEdits[team.id] || {};
                                        const currentRate = edit.supportRate !== undefined ? edit.supportRate : team.supportRate;
                                        const currentModel = (edit.supportModel !== undefined ? edit.supportModel : team.supportModel) || 'man_day';
                                        const currentDesc = edit.supportDescription !== undefined ? edit.supportDescription : team.supportDescription;

                                        const isEdited = supportChangedTeamUpdates.some(u => u.teamId === team.id);

                                        return (
                                            <tr key={team.id} className={`hover:bg-slate-50 transition-colors ${isEdited ? 'bg-indigo-50/30' : ''}`}>
                                                <td className="px-6 py-3 font-medium text-slate-800">
                                                    {team.name}
                                                    {isEdited && <span className="ml-2 w-2 h-2 inline-block rounded-full bg-indigo-500" />}
                                                </td>
                                                <td className="px-6 py-3 text-slate-500">{team.type}</td>
                                                <td className="px-6 py-3">
                                                    <select
                                                        value={currentModel}
                                                        onChange={(e) => handleSupportChange(team.id!, 'supportModel', e.target.value as Team['supportModel'])}
                                                        className="border border-slate-200 rounded px-2 py-1 text-sm bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                                    >
                                                        <option value="man_day">공수제 (Man-Day)</option>
                                                        <option value="fixed">고정급 (Fixed)</option>
                                                    </select>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <div className="relative max-w-[180px] ml-auto">
                                                        <input
                                                            type="number"
                                                            value={currentRate || 0}
                                                            onChange={(e) => handleSupportChange(team.id!, 'supportRate', Number(e.target.value))}
                                                            className="w-full border border-slate-200 rounded px-3 py-1.5 text-right pr-10 text-sm focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                                                            min={0}
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">원</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <input
                                                        type="text"
                                                        value={currentDesc || ''}
                                                        onChange={(e) => handleSupportChange(team.id!, 'supportDescription', e.target.value)}
                                                        placeholder="비고..."
                                                        className="w-full border border-slate-200 rounded px-3 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderServiceTab = () => {
        const changedCount = serviceChangedTeamUpdates.length;

        return (
            <div className="p-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col gap-3">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                                <div className="relative flex-1 max-w-sm">
                                    <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={serviceSearchTerm}
                                        onChange={(e) => setServiceSearchTerm(e.target.value)}
                                        placeholder="팀명/시공종목/팀장 검색..."
                                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>

                                <select
                                    value={serviceTypeFilter}
                                    onChange={(e) => setServiceTypeFilter(e.target.value)}
                                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="">전체 팀 구분</option>
                                    {teamTypeOptions.filter(v => v !== '').map(v => (
                                        <option key={v} value={v}>
                                            {v}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={saveServiceChanges}
                                disabled={serviceSaving || changedCount === 0}
                                className={`
                                    px-4 py-2 rounded-lg font-bold text-white shadow-md flex items-center gap-2 transition-all
                                    ${changedCount > 0
                                        ? 'bg-indigo-600 hover:bg-indigo-700'
                                        : 'bg-slate-300 cursor-not-allowed'}
                                `}
                            >
                                {serviceSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                                {serviceSaving ? '저장 중...' : `변경사항 저장 (${changedCount})`}
                            </button>
                        </div>

                        <div className="flex flex-col xl:flex-row xl:items-center gap-3">
                            <div className="flex items-center gap-2">
                                <FontAwesomeIcon icon={faFileInvoiceDollar} className="text-slate-500" />
                                <input
                                    type="number"
                                    value={serviceBulkRate}
                                    onChange={(e) => setServiceBulkRate(e.target.value)}
                                    placeholder="필터된 팀 용역비 단가"
                                    className="w-56 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    min={0}
                                />
                            </div>

                            <select
                                value={serviceBulkModel}
                                onChange={(e) => setServiceBulkModel(e.target.value as BulkModelOption)}
                                className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="keep">방식 유지</option>
                                <option value="man_day">공수제 (Man-Day)</option>
                                <option value="fixed">고정급 (Fixed)</option>
                            </select>

                            <input
                                type="text"
                                value={serviceBulkDescription}
                                onChange={(e) => setServiceBulkDescription(e.target.value)}
                                placeholder="비고(선택)"
                                className="flex-1 min-w-[180px] border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />

                            <button
                                onClick={applyBulkService}
                                disabled={serviceBulkApplying}
                                className="px-4 py-2 rounded-lg font-bold text-white bg-slate-700 hover:bg-slate-800 transition flex items-center gap-2 disabled:opacity-50"
                            >
                                {serviceBulkApplying ? <FontAwesomeIcon icon={faSpinner} spin /> : null}
                                필터 적용 ({filteredServiceTeams.length})
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3 font-semibold">팀명</th>
                                    <th className="px-6 py-3 font-semibold">시공종목</th>
                                    <th className="px-6 py-3 font-semibold">용역비 방식</th>
                                    <th className="px-6 py-3 font-semibold text-right">청구 단가 (원)</th>
                                    <th className="px-6 py-3 font-semibold">비고</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {teamsLoading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                            <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                                            데이터를 불러오는 중입니다...
                                        </td>
                                    </tr>
                                ) : filteredServiceTeams.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">검색 결과가 없습니다.</td>
                                    </tr>
                                ) : (
                                    filteredServiceTeams.map(team => {
                                        if (!team.id) return null;

                                        const edit = serviceEdits[team.id] || {};
                                        const currentRate = edit.serviceRate !== undefined ? edit.serviceRate : team.serviceRate;
                                        const currentModel = (edit.serviceModel !== undefined ? edit.serviceModel : team.serviceModel) || 'man_day';
                                        const currentDesc = edit.serviceDescription !== undefined ? edit.serviceDescription : team.serviceDescription;

                                        const isEdited = serviceChangedTeamUpdates.some(u => u.teamId === team.id);

                                        return (
                                            <tr key={team.id} className={`hover:bg-slate-50 transition-colors ${isEdited ? 'bg-indigo-50/30' : ''}`}>
                                                <td className="px-6 py-3 font-medium text-slate-800">
                                                    {team.name}
                                                    {isEdited && <span className="ml-2 w-2 h-2 inline-block rounded-full bg-indigo-500" />}
                                                </td>
                                                <td className="px-6 py-3 text-slate-500">{team.type}</td>
                                                <td className="px-6 py-3">
                                                    <select
                                                        value={currentModel}
                                                        onChange={(e) => handleServiceChange(team.id!, 'serviceModel', e.target.value as Team['serviceModel'])}
                                                        className="border border-slate-200 rounded px-2 py-1 text-sm bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                                    >
                                                        <option value="man_day">공수제 (Man-Day)</option>
                                                        <option value="fixed">고정급 (Fixed)</option>
                                                    </select>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <div className="relative max-w-[180px] ml-auto">
                                                        <input
                                                            type="number"
                                                            value={currentRate || 0}
                                                            onChange={(e) => handleServiceChange(team.id!, 'serviceRate', Number(e.target.value))}
                                                            className="w-full border border-slate-200 rounded px-3 py-1.5 text-right pr-10 text-sm focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                                                            min={0}
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">원</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <input
                                                        type="text"
                                                        value={currentDesc || ''}
                                                        onChange={(e) => handleServiceChange(team.id!, 'serviceDescription', e.target.value)}
                                                        placeholder="비고..."
                                                        className="w-full border border-slate-200 rounded px-3 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'unit':
                return renderUnitTab();
            case 'support':
                return renderSupportTab();
            case 'service':
                return renderServiceTab();
            default:
                return renderUnitTab();
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f1f5f9]">
            <div className="bg-white border-b border-slate-200 px-6 py-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-blue-100 p-2 rounded-lg">
                        <FontAwesomeIcon icon={faMoneyBillWave} className="text-blue-600 text-xl" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">단가/지원비/용역비 관리</h1>
                        <p className="text-sm text-slate-500">전체/팀/개별 단가를 검색하고 일괄 적용할 수 있습니다.</p>
                    </div>
                </div>

                <div className="flex gap-1 overflow-x-auto pb-1">
                    <button
                        onClick={() => setActiveTab('unit')}
                        className={`
                            px-4 py-2 rounded-t-lg text-sm font-bold transition-colors flex items-center gap-2 whitespace-nowrap
                            ${activeTab === 'unit'
                                ? 'bg-white text-blue-600 border-t border-x border-slate-200 shadow-[0_-2px_3px_rgba(0,0,0,0.02)]'
                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border-transparent'
                            }
                        `}
                    >
                        <FontAwesomeIcon icon={faWonSign} />
                        단가관리
                    </button>
                    <button
                        onClick={() => setActiveTab('support')}
                        className={`
                            px-4 py-2 rounded-t-lg text-sm font-bold transition-colors flex items-center gap-2 whitespace-nowrap
                            ${activeTab === 'support'
                                ? 'bg-white text-blue-600 border-t border-x border-slate-200 shadow-[0_-2px_3px_rgba(0,0,0,0.02)]'
                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border-transparent'
                            }
                        `}
                    >
                        <FontAwesomeIcon icon={faHandHoldingDollar} />
                        지원비관리
                    </button>
                    <button
                        onClick={() => setActiveTab('service')}
                        className={`
                            px-4 py-2 rounded-t-lg text-sm font-bold transition-colors flex items-center gap-2 whitespace-nowrap
                            ${activeTab === 'service'
                                ? 'bg-white text-blue-600 border-t border-x border-slate-200 shadow-[0_-2px_3px_rgba(0,0,0,0.02)]'
                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border-transparent'
                            }
                        `}
                    >
                        <FontAwesomeIcon icon={faFileInvoiceDollar} />
                        용역비관리
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto">{renderContent()}</div>
        </div>
    );
};

export default PayrollRateManagementPage;
