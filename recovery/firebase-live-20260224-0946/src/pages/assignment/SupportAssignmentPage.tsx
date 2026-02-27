import React, { useState, useEffect } from 'react';
import {
    DndContext,
    DragOverlay,
    useDraggable,
    useDroppable,
    DragStartEvent,
    DragEndEvent,
    useSensor,
    useSensors,
    PointerSensor,
    closestCenter
} from '@dnd-kit/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faArrowRight, faExchangeAlt, faCalendarAlt, faSearch } from '@fortawesome/free-solid-svg-icons';
import { teamService, Team } from '../../services/teamService';
import { dailyReportService, DailyReport } from '../../services/dailyReportService';
import { manpowerService, Worker } from '../../services/manpowerService';

// --- Types ---
interface SupportWorker {
    reportId: string;
    workerId: string;
    workerName: string;
    manDay: number;
    originalTeamId: string;
    originalTeamName: string;
    currentTeamId: string; // The team they are currently assigned to in the report
    currentTeamName: string;
    isSupport: boolean;
}

interface TeamColumn {
    teamId: string;
    teamName: string;
    workers: SupportWorker[];
    totalManDay: number;
}

// --- Draggable Worker Card ---
const WorkerCard: React.FC<{ worker: SupportWorker; isOverlay?: boolean }> = ({ worker, isOverlay }) => {
    const uniqueId = `${worker.reportId}_${worker.workerId}`;
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: uniqueId,
        data: { worker }
    });

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={`
                p-3 rounded-lg border shadow-sm mb-2 cursor-grab flex justify-between items-center
                ${isOverlay ? 'bg-blue-50 border-blue-500 shadow-xl scale-105 z-50' : 'bg-white border-slate-200 hover:border-blue-300'}
                ${isDragging ? 'opacity-50' : 'opacity-100'}
            `}
        >
            <div>
                <div className="font-bold text-slate-700">{worker.workerName}</div>
                <div className="text-xs text-slate-500">
                    {worker.isSupport ? (
                        <span className="text-orange-600 font-medium">지원중 ({worker.currentTeamName})</span>
                    ) : (
                        <span>{worker.originalTeamName}</span>
                    )}
                </div>
            </div>
            <div className="bg-slate-100 px-2 py-1 rounded text-sm font-bold text-slate-600">
                {worker.manDay}공수
            </div>
        </div>
    );
};

// --- Droppable Column ---
const TeamColumn: React.FC<{ column: TeamColumn; isSource?: boolean }> = ({ column, isSource }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: column.teamId,
        data: { teamId: column.teamId, isSource }
    });

    return (
        <div
            ref={setNodeRef}
            className={`
                flex-1 min-w-[300px] bg-slate-50 rounded-xl border-2 p-4 flex flex-col
                ${isOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200'}
                transition-colors
            `}
        >
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200">
                <div>
                    <h3 className={`font-bold text-lg ${isSource ? 'text-slate-800' : 'text-blue-700'}`}>
                        {column.teamName}
                    </h3>
                    <p className="text-xs text-slate-500">{isSource ? '내 팀 (출력)' : '지원 받을 팀'}</p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-slate-800">{column.totalManDay.toFixed(1)}</div>
                    <div className="text-xs text-slate-500">총 공수</div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[200px]">
                {column.workers.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                        데이터 없음
                    </div>
                ) : (
                    column.workers.map(w => (
                        <WorkerCard key={`${w.reportId}_${w.workerId}`} worker={w} />
                    ))
                )}
            </div>
        </div>
    );
};

// --- Main Page ---
const SupportAssignmentPage: React.FC = () => {
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [myTeamId, setMyTeamId] = useState<string>('');
    const [teams, setTeams] = useState<Team[]>([]);
    const [reports, setReports] = useState<DailyReport[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Derived State
    const [sourceColumn, setSourceColumn] = useState<TeamColumn | null>(null);
    const [targetColumns, setTargetColumns] = useState<TeamColumn[]>([]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (myTeamId && date) {
            fetchDailyData();
        }
    }, [myTeamId, date]);

    const fetchInitialData = async () => {
        try {
            const [teamsData, workersData] = await Promise.all([
                teamService.getTeams(),
                manpowerService.getWorkers()
            ]);
            setTeams(teamsData);
            setWorkers(workersData);
            if (teamsData.length > 0) {
                setMyTeamId(teamsData[0].id!); // Default to first team
            }
        } catch (error) {
            console.error("Failed to fetch initial data", error);
        }
    };

    const fetchDailyData = async () => {
        setLoading(true);
        try {
            // Fetch reports for the date
            // Note: In a real app, we should query by date. 
            // For now, fetching all and filtering (optimization needed for production)
            const allReports = await dailyReportService.getAllReports();
            const dailyReports = allReports.filter(r => r.date === date);
            setReports(dailyReports);

            processColumns(dailyReports, myTeamId);
        } catch (error) {
            console.error("Failed to fetch daily data", error);
        } finally {
            setLoading(false);
        }
    };

    const processColumns = (currentReports: DailyReport[], currentMyTeamId: string) => {
        const newTargetColumns: TeamColumn[] = [];
        let newSourceColumn: TeamColumn | null = null;

        // Group workers by team (report)
        const teamWorkersMap = new Map<string, SupportWorker[]>();
        const teamManDayMap = new Map<string, number>();

        // Initialize maps for all teams
        teams.forEach(team => {
            teamWorkersMap.set(team.id!, []);
            teamManDayMap.set(team.id!, 0);
        });

        currentReports.forEach(report => {
            const teamId = report.teamId;
            if (!teamWorkersMap.has(teamId)) {
                teamWorkersMap.set(teamId, []);
                teamManDayMap.set(teamId, 0);
            }

            report.workers.forEach(worker => {
                const originalWorker = workers.find(w => w.id === worker.workerId);
                const originalTeamId = originalWorker?.teamId || 'unknown';
                const originalTeam = teams.find(t => t.id === originalTeamId);
                const originalTeamName = originalTeam?.name || '미배정';

                const supportWorker: SupportWorker = {
                    reportId: report.id!,
                    workerId: worker.workerId,
                    workerName: worker.name,
                    manDay: worker.manDay,
                    originalTeamId: originalTeamId,
                    originalTeamName: originalTeamName,
                    currentTeamId: teamId,
                    currentTeamName: report.teamName,
                    isSupport: originalTeamId !== teamId
                };

                teamWorkersMap.get(teamId)?.push(supportWorker);
                teamManDayMap.set(teamId, (teamManDayMap.get(teamId) || 0) + worker.manDay);
            });
        });

        // Build columns
        teams.forEach(team => {
            const column: TeamColumn = {
                teamId: team.id!,
                teamName: team.name,
                workers: teamWorkersMap.get(team.id!) || [],
                totalManDay: teamManDayMap.get(team.id!) || 0
            };

            if (team.id === currentMyTeamId) {
                newSourceColumn = column;
            } else {
                newTargetColumns.push(column);
            }
        });

        setSourceColumn(newSourceColumn);
        setTargetColumns(newTargetColumns);
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const worker = active.data.current?.worker as SupportWorker;
        const targetTeamId = over.id as string;

        if (worker.currentTeamId === targetTeamId) return;

        const sourceReport = reports.find(r => r.id === worker.reportId);
        const targetReport = reports.find(r => r.teamId === targetTeamId && r.date === date);

        if (!sourceReport) return;

        if (!targetReport) {
            alert("해당 팀의 금일 일보가 존재하지 않아 이동할 수 없습니다. 먼저 일보를 생성해주세요.");
            return;
        }

        if (window.confirm(`${worker.workerName} 님을 ${worker.currentTeamName}에서 ${targetReport.teamName}(으)로 이동하시겠습니까?`)) {
            try {
                // 1. Remove from source report
                await dailyReportService.removeWorkerFromReport(sourceReport.id!, worker.workerId);

                // 2. Add to target report
                const workerDetails = sourceReport.workers.find(w => w.workerId === worker.workerId);
                if (workerDetails) {
                    await dailyReportService.addWorkerToReport(
                        targetReport.date,
                        targetReport.teamId,
                        targetReport.teamName,
                        targetReport.siteId,
                        targetReport.siteName,
                        workerDetails
                    );
                }

                fetchDailyData();

            } catch (error) {
                console.error("Failed to move worker", error);
                alert("이동 중 오류가 발생했습니다.");
            }
        }
    };

    const activeWorker = activeId
        ? (sourceColumn?.workers.find(w => w.reportId === activeId) || targetColumns.flatMap(c => c.workers).find(w => w.reportId === activeId))
        : null;

    return (
        <div className="p-6 h-full flex flex-col max-w-[1800px] mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faExchangeAlt} className="text-blue-600" />
                        지원 공수 관리
                    </h1>
                    <p className="text-slate-600 mt-1">
                        내 팀의 공수를 다른 팀으로 지원 보낼 수 있습니다.
                    </p>
                </div>
                <div className="flex gap-4">
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200">
                        <FontAwesomeIcon icon={faCalendarAlt} className="text-slate-400" />
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="border-none focus:ring-0 text-sm text-slate-700"
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200">
                        <FontAwesomeIcon icon={faUsers} className="text-slate-400" />
                        <select
                            value={myTeamId}
                            onChange={(e) => setMyTeamId(e.target.value)}
                            className="border-none focus:ring-0 text-sm text-slate-700 min-w-[150px]"
                        >
                            {teams.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="flex gap-8 flex-1 min-h-0 overflow-x-auto pb-4">
                    {/* Source Column (My Team) */}
                    {sourceColumn && (
                        <div className="flex-shrink-0 w-80">
                            <TeamColumn column={sourceColumn} isSource />
                        </div>
                    )}

                    {/* Arrow Divider */}
                    <div className="flex flex-col justify-center items-center text-slate-300">
                        <FontAwesomeIcon icon={faArrowRight} className="text-4xl" />
                        <span className="text-sm font-bold mt-2">지원 이동</span>
                    </div>

                    {/* Target Columns (Other Teams) */}
                    <div className="flex gap-4 flex-1 overflow-x-auto">
                        {targetColumns.map(col => (
                            <div key={col.teamId} className="flex-shrink-0 w-80">
                                <TeamColumn column={col} />
                            </div>
                        ))}
                    </div>
                </div>

                <DragOverlay>
                    {activeWorker ? <WorkerCard worker={activeWorker} isOverlay /> : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
};

export default SupportAssignmentPage;
