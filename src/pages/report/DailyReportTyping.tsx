import React, { useState, useEffect } from 'react';
import { Site } from '../../services/siteService';
import { Team } from '../../services/teamService';
import { manpowerService, Worker } from '../../services/manpowerService';
import { dailyReportService } from '../../services/dailyReportService';
import { geminiService } from '../../services/geminiService';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSave, faCalendarAlt, faComment, faMinus, faFileExcel, faFileImport, faFileExport } from '@fortawesome/free-solid-svg-icons';
import * as XLSX from 'xlsx';
import TypingTable, { TypingTableData, TypingRow } from './TypingTable';
import { confirm } from '../../utils/swal';

interface DailyReportTypingProps {
    sites: Site[];
    teams: Team[];
}

const DailyReportTyping: React.FC<DailyReportTypingProps> = ({ sites, teams }) => {
    const { currentUser } = useAuth();
    const [tables, setTables] = useState<TypingTableData[]>([]);
    const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        const fetchWorkers = async () => {
            try {
                const data = await manpowerService.getWorkers();
                setAllWorkers(data);
            } catch (error) {
                console.error("Failed to fetch workers", error);
            }
        };
        fetchWorkers();
        // Initialize with 1 table
        addTable();
    }, []);

    const createEmptyRows = (count: number, startId: number, siteId: string): TypingRow[] => {
        const currentSite = sites.find(s => s.id === siteId);
        const initialSiteTeamName = currentSite?.responsibleTeamName || '';
        const newRows: TypingRow[] = [];
        for (let i = 0; i < count; i++) {
            newRows.push({
                id: startId + i,
                name: '',
                manDay: 1.0,
                teamId: '',
                teamName: '',
                siteTeamName: initialSiteTeamName,
            });
        }
        return newRows;
    };


    const addTable = () => {
        setTables(prev => {
            const tableId = prev.length > 0 ? Math.max(...prev.map(t => t.id)) + 1 : 1;
            // Find max row ID across all tables to ensure uniqueness
            const maxRowId = prev.reduce((max, t) => {
                const tableMax = t.rows.length > 0 ? Math.max(...t.rows.map(r => r.id)) : 0;
                return Math.max(max, tableMax);
            }, 0);

            return [...prev, {
                id: tableId,
                siteId: '',
                rows: createEmptyRows(10, maxRowId + 1, '')
            }];
        });
    };

    const removeLastTable = () => {
        setTables(prev => {
            if (prev.length <= 1) {
                alert("최소 1개의 장부는 있어야 합니다.");
                return prev;
            }
            return prev.slice(0, -1);
        });
    };

    const addRowsToTable = (tableId: number, count: number) => {
        setTables(prev => prev.map(table => {
            if (table.id !== tableId) return table;

            // Find max row ID globally to be safe
            const maxRowId = prev.reduce((max, t) => {
                const tableMax = t.rows.length > 0 ? Math.max(...t.rows.map(r => r.id)) : 0;
                return Math.max(max, tableMax);
            }, 0);

            const newRows = createEmptyRows(count, maxRowId + 1, table.siteId);
            return { ...table, rows: [...table.rows, ...newRows] };
        }));
    };

    const handleTableSiteChange = (tableId: number, siteId: string) => {
        const site = sites.find(s => s.id === siteId);
        const responsibleTeamName = site?.responsibleTeamName || '';

        setTables(prev => prev.map(table => {
            if (table.id !== tableId) return table;
            return {
                ...table,
                siteId,
                rows: table.rows.map(row => ({
                    ...row,
                    siteTeamName: responsibleTeamName
                }))
            };
        }));
    };

    const handleNameChange = (tableId: number, rowId: number, name: string) => {
        setTables(prev => prev.map(table => {
            if (table.id !== tableId) return table;

            return {
                ...table,
                rows: table.rows.map(row => {
                    if (row.id !== rowId) return row;

                    const worker = allWorkers.find(w => w.name === name);
                    let teamName = row.teamName;
                    let teamId = row.teamId;
                    let unitPrice = row.unitPrice || 0;
                    let role = row.role || '작업자';
                    let payType = row.payType || '일급제';
                    let workerId = row.workerId;

                    if (worker) {
                        const team = teams.find(t => t.id === worker.teamId);

                        // Check for Support Team Logic
                        if (team?.type === '지원팀' || worker.teamType === '지원팀') {
                            teamName = '지원';
                        } else {
                            teamName = team?.name || '';
                        }

                        teamId = worker.teamId || '';
                        unitPrice = worker.unitPrice || 0;
                        role = worker.role || '작업자';
                        payType = worker.payType || '일급제';
                        workerId = worker.id;
                    }

                    return {
                        ...row,
                        name,
                        teamName,
                        teamId,
                        unitPrice,
                        role,
                        payType,
                        workerId
                    };
                })
            };
        }));
    };

    const handleRowChange = (tableId: number, rowId: number, field: keyof TypingRow, value: any) => {
        setTables(prev => prev.map(table => {
            if (table.id !== tableId) return table;
            return {
                ...table,
                rows: table.rows.map(row => row.id === rowId ? { ...row, [field]: value } : row)
            };
        }));
    };

    const handleSave = async () => {
        // Validate that all tables with data have a site selected
        for (const table of tables) {
            const hasData = table.rows.some(r => r.name.trim() !== '');
            if (hasData && !table.siteId) {
                alert('데이터가 입력된 장부의 현장을 선택해주세요.');
                return;
            }
        }

        // Flatten all rows from all tables, but keep track of siteId
        const allRowsWithSite = tables.flatMap(t => t.rows.map(r => ({ ...r, siteId: t.siteId })));
        const validRows = allRowsWithSite.filter(r => r.name.trim() !== '');

        if (validRows.length === 0) {
            alert('저장할 데이터가 없습니다.');
            return;
        }

        // Check for missing teams
        const rowsWithoutTeam = validRows.filter(r => !r.teamId);
        if (rowsWithoutTeam.length > 0) {
            alert('팀 정보가 없는 작업자가 있습니다. 이름을 정확히 입력하거나 팀을 확인해주세요.');
            return;
        }

        setIsSaving(true);
        try {
            // Group by team AND site
            // Key format: "siteId_teamId"
            const rowsByGroup: { [key: string]: typeof validRows } = {};
            validRows.forEach(row => {
                const key = `${row.siteId}_${row.teamId}`;
                if (!rowsByGroup[key]) rowsByGroup[key] = [];
                rowsByGroup[key].push(row);
            });

            const savePromises = Object.entries(rowsByGroup).map(async ([key, groupRows]) => {
                const [siteId, teamId] = key.split('_');

                // Check if report exists
                const exists = await dailyReportService.checkReportExists(date, teamId, siteId);
                if (exists) {
                    console.warn(`Report already exists for team ${teamId} on site ${siteId} date ${date}.`);
                    const teamName = groupRows[0].teamName;
                    const site = sites.find(s => s.id === siteId);
                    const result = await confirm.overwrite(`${site?.name} - ${teamName}`);
                    if (!result.isConfirmed) {
                        return;
                    }
                }

                const team = teams.find(t => t.id === teamId);
                const site = sites.find(s => s.id === siteId);
                const totalManDay = groupRows.reduce((sum, r) => sum + r.manDay, 0);

                const workers = groupRows.map(r => ({
                    workerId: r.workerId || 'unknown',
                    name: r.name,
                    role: r.role || '작업자',
                    status: 'attendance' as const,
                    manDay: r.manDay,
                    workContent: r.content || '',
                    teamId: teamId,
                    unitPrice: r.unitPrice || 0,
                    payType: r.payType || '일급제',
                    salaryModel: (() => {
                        const matchedWorker = allWorkers.find(w => w.id === r.workerId);
                        if (matchedWorker?.teamType === '지원팀') return '지원팀';
                        if (matchedWorker?.teamType === '용역팀') return '용역팀';
                        return matchedWorker?.salaryModel || r.payType || '일급제';
                    })()
                }));

                return dailyReportService.addReport({
                    date,
                    teamId,
                    teamName: team?.name || '',
                    siteId: siteId,
                    siteName: site?.name || '',
                    companyId: site?.companyId, // Added companyId
                    companyName: site?.companyName, // Added companyName
                    writerId: currentUser?.uid || 'unknown',
                    workers: workers,
                    totalManDay,
                    responsibleTeamId: site?.responsibleTeamId,
                    responsibleTeamName: site?.responsibleTeamName
                });
            });

            await Promise.all(savePromises);
            alert('저장되었습니다.');
            // Reset tables to initial state
            setTables([{
                id: 1,
                siteId: '',
                rows: createEmptyRows(10, 1, '')
            }]);
        } catch (error) {
            console.error("Failed to save", error);
            alert("저장 중 오류가 발생했습니다.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleKakaoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const apiKey = geminiService.getKey();
        if (!apiKey) {
            alert('AI 기능을 사용하려면 API 키 설정이 필요합니다.\n설정 페이지로 이동합니다.');
            window.location.href = '/settings';
            return;
        }

        setIsSaving(true);
        // Call the common function
        processKakaoImage(file);
    };
    /* Legacy inline logic removed in favor of common function */
    const _legacy_handleKakaoUpload_logic_removed = async (file: File) => {
        try {
            /* Logic moved to processKakaoImage */
            const analyzedReports = await geminiService.analyzeKakaoImage(file);

            // Helper to find best match for site
            const findSiteId = (siteName: string): string => {
                if (!siteName) return '';
                // 1. Exact match
                const exact = sites.find(s => s.name === siteName);
                if (exact) return exact.id || '';
                // 2. Contains match
                const contains = sites.find(s => s.name.includes(siteName) || siteName.includes(s.name));
                if (contains) return contains.id || '';
                return '';
            };

            // Helper to find best match for worker
            const findWorker = (workerName: string): Worker | undefined => {
                if (!workerName) return undefined;
                return allWorkers.find(w => w.name === workerName); // Currently exact match, can be improved
            };

            const newTables: TypingTableData[] = [];
            let currentMaxTableId = tables.length > 0 ? Math.max(...tables.map(t => t.id)) : 0;
            let currentMaxRowId = tables.reduce((max, t) => {
                const tableMax = t.rows.length > 0 ? Math.max(...t.rows.map(r => r.id)) : 0;
                return Math.max(max, tableMax);
            }, 0);

            for (const report of analyzedReports) {
                // Handle single object or array return from AI (just in case)
                const reportData = report as any;

                const siteId = findSiteId(reportData.siteName);
                const currentSite = sites.find(s => s.id === siteId);
                const initialSiteTeamName = currentSite?.responsibleTeamName || '';

                currentMaxTableId++;

                const newRows: TypingRow[] = [];
                if (reportData.workers && Array.isArray(reportData.workers)) {
                    for (const w of reportData.workers) {
                        currentMaxRowId++;
                        const matchedWorker = findWorker(w.name);

                        let teamName = '';
                        let teamId = '';
                        let unitPrice = 0;
                        let role = '작업자';
                        let workerId = '';

                        if (matchedWorker) {
                            const team = teams.find(t => t.id === matchedWorker.teamId);
                            teamName = team?.name || '';
                            teamId = matchedWorker.teamId || '';
                            unitPrice = matchedWorker.unitPrice || 0;
                            role = matchedWorker.role || '작업자';
                            workerId = matchedWorker.id || '';
                        }

                        newRows.push({
                            id: currentMaxRowId,
                            name: w.name,
                            manDay: typeof w.manDay === 'number' ? w.manDay : parseFloat(w.manDay) || 1.0,
                            teamId: teamId,
                            teamName: teamName,
                            siteTeamName: initialSiteTeamName,
                            unitPrice: unitPrice,
                            role: role,
                            workerId: workerId
                        });
                    }
                }

                // Fill remaining rows to reach 10 if less
                const remaining = 10 - newRows.length;
                if (remaining > 0) {
                    for (let i = 0; i < remaining; i++) {
                        currentMaxRowId++;
                        newRows.push({
                            id: currentMaxRowId,
                            name: '',
                            manDay: 1.0,
                            teamId: '',
                            teamName: '',
                            siteTeamName: initialSiteTeamName,
                        });
                    }
                }

                newTables.push({
                    id: currentMaxTableId,
                    siteId: siteId,
                    rows: newRows
                });
            }

            if (newTables.length > 0) {
                setTables(prev => {
                    const updated = [...prev];
                    let newTableIdx = 0;

                    // Iterate through existing tables to find empty ones
                    for (let i = 0; i < updated.length && newTableIdx < newTables.length; i++) {
                        const isEmpty = updated[i].rows.every(r => !r.name || r.name.trim() === '');
                        if (isEmpty) {
                            // Replace empty table with new table
                            updated[i] = newTables[newTableIdx];
                            newTableIdx++;
                        }
                    }

                    // Append remaining new tables
                    if (newTableIdx < newTables.length) {
                        updated.push(...newTables.slice(newTableIdx));
                    }

                    return updated;
                });
                alert(`${newTables.length}개의 장부가 입력되었습니다.`);
            } else {
                alert('이미지에서 유효한 일보 데이터를 찾지 못했습니다.');
            }

        } catch (error) {
            console.error("AI Analysis Failed", error);
            alert("이미지 분석에 실패했습니다. 다시 시도해주세요.");
        } finally {
            setIsSaving(false);
        }
    };

    // --- Drag & Drop Handlers ---
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        // Only disable if leaving the main container (checks relatedTarget)
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDragging(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (!file) return;

        // Check if image
        if (!file.type.startsWith('image/')) {
            alert('이미지 파일만 업로드 가능합니다.');
            return;
        }

        const apiKey = geminiService.getKey();
        if (!apiKey) {
            alert('AI 기능을 사용하려면 API 키 설정이 필요합니다.');
            return;
        }

        // Reuse the logic from handleKakaoUpload (extracted or duplicated)
        // Since handleKakaoUpload expects ChangeEvent, we'll just call the logic directly here or refactor.
        // For simplicity/safety, I'll copy the logic but ideally refactor.
        // Actually best to extract the core logic.

        processKakaoImage(file);
    };

    const processKakaoImage = async (file: File) => {
        setIsSaving(true);
        try {
            const analyzedReports = await geminiService.analyzeKakaoImage(file);

            // Helper to find best match for site
            const findSiteId = (siteName: string): string => {
                if (!siteName) return '';
                const exact = sites.find(s => s.name === siteName);
                if (exact) return exact.id || '';
                const contains = sites.find(s => s.name.includes(siteName) || siteName.includes(s.name));
                if (contains) return contains.id || '';
                return '';
            };

            // Helper to find best match for worker
            const findWorker = (workerName: string): Worker | undefined => {
                if (!workerName) return undefined;
                return allWorkers.find(w => w.name === workerName);
            };

            const newTables: TypingTableData[] = [];
            let currentMaxTableId = tables.length > 0 ? Math.max(...tables.map(t => t.id)) : 0;
            let currentMaxRowId = tables.reduce((max, t) => {
                const tableMax = t.rows.length > 0 ? Math.max(...t.rows.map(r => r.id)) : 0;
                return Math.max(max, tableMax);
            }, 0);

            for (const report of analyzedReports) {
                currentMaxTableId++;
                const siteId = findSiteId(report.siteName || '');
                const initialSiteTeamName = siteId ? sites.find(s => s.id === siteId)?.responsibleTeamName : '';

                const newRows: TypingRow[] = [];
                for (const w of report.workers) {
                    currentMaxRowId++;
                    const matchedWorker = findWorker(w.name);

                    newRows.push({
                        id: currentMaxRowId,
                        name: w.name,
                        manDay: w.manDay,
                        teamId: '',
                        teamName: matchedWorker?.teamName || '',
                        siteTeamName: initialSiteTeamName || '',
                        role: w.role || matchedWorker?.role || '',
                        unitPrice: matchedWorker?.unitPrice || 0
                    });
                }

                // Fill remaining
                const remaining = 10 - newRows.length;
                if (remaining > 0) {
                    for (let i = 0; i < remaining; i++) {
                        currentMaxRowId++;
                        newRows.push({
                            id: currentMaxRowId,
                            name: '',
                            manDay: 1.0,
                            teamId: '',
                            teamName: '',
                            siteTeamName: initialSiteTeamName || '',
                        });
                    }
                }

                newTables.push({
                    id: currentMaxTableId,
                    siteId: siteId,
                    rows: newRows
                });
            }

            if (newTables.length > 0) {
                setTables(prev => {
                    const updated = [...prev];
                    let newTableIdx = 0;
                    for (let i = 0; i < updated.length && newTableIdx < newTables.length; i++) {
                        const isEmpty = updated[i].rows.every(r => !r.name || r.name.trim() === '');
                        if (isEmpty) {
                            updated[i] = newTables[newTableIdx];
                            newTableIdx++;
                        }
                    }
                    if (newTableIdx < newTables.length) {
                        updated.push(...newTables.slice(newTableIdx));
                    }
                    return updated;
                });
                alert(`${newTables.length}개의 장부가 AI 분석으로 입력되었습니다.`);
            } else {
                alert('이미지에서 유효한 일보 데이터를 찾지 못했습니다.');
            }

        } catch (error) {
            console.error("AI Analysis Failed", error);
            alert("이미지 분석에 실패했습니다. 다시 시도해주세요.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleExcelDownload = () => {
        const data: any[] = [];
        tables.forEach(table => {
            const site = sites.find(s => s.id === table.siteId);
            const siteName = site?.name || '';

            table.rows.forEach(row => {
                if (row.name.trim() !== '') {
                    data.push({
                        '현장명': siteName,
                        '팀명': row.teamName,
                        '이름': row.name,
                        '공수': row.manDay,
                        '단가': row.unitPrice,
                        '직종': row.role
                    });
                }
            });
        });

        if (data.length === 0) {
            // Add a template row if empty
            data.push({
                '현장명': '예시현장',
                '팀명': '예시팀',
                '이름': '홍길동',
                '공수': 1.0,
                '단가': 150000,
                '직종': '조공'
            });
        }

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "일보작성");
        XLSX.writeFile(wb, `일보작성_${date}.xlsx`);
    };

    const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws) as any[];

            if (data.length === 0) {
                alert('엑셀 파일에 데이터가 없습니다.');
                return;
            }

            // Group by Site
            const rowsBySite: { [key: string]: any[] } = {};
            data.forEach(row => {
                const siteName = row['현장명'] || '';
                if (!rowsBySite[siteName]) rowsBySite[siteName] = [];
                rowsBySite[siteName].push(row);
            });

            const newTables: TypingTableData[] = [];
            let currentMaxTableId = tables.length > 0 ? Math.max(...tables.map(t => t.id)) : 0;
            let currentMaxRowId = tables.reduce((max, t) => {
                const tableMax = t.rows.length > 0 ? Math.max(...t.rows.map(r => r.id)) : 0;
                return Math.max(max, tableMax);
            }, 0);

            // Helper to find best match for site
            const findSiteId = (siteName: string): string => {
                if (!siteName) return '';
                const exact = sites.find(s => s.name === siteName);
                if (exact) return exact.id || '';
                const contains = sites.find(s => s.name.includes(siteName) || siteName.includes(s.name));
                if (contains) return contains.id || '';
                return '';
            };

            // Helper to find best match for worker
            const findWorker = (workerName: string): Worker | undefined => {
                if (!workerName) return undefined;
                return allWorkers.find(w => w.name === workerName);
            };

            Object.entries(rowsBySite).forEach(([siteName, rows]) => {
                currentMaxTableId++;
                const siteId = findSiteId(siteName);
                const currentSite = sites.find(s => s.id === siteId);
                const initialSiteTeamName = currentSite?.responsibleTeamName || '';

                const newRows: TypingRow[] = [];
                rows.forEach(row => {
                    currentMaxRowId++;
                    const workerName = row['이름'];
                    const matchedWorker = findWorker(workerName);

                    let teamName = row['팀명'] || '';
                    let teamId = '';
                    let unitPrice = row['단가'] || 0;
                    let role = row['직종'] || '작업자';
                    let workerId = '';

                    if (matchedWorker) {
                        const team = teams.find(t => t.id === matchedWorker.teamId);
                        if (!teamName) teamName = team?.name || '';
                        teamId = matchedWorker.teamId || '';
                        if (!unitPrice) unitPrice = matchedWorker.unitPrice || 0;
                        if (!role) role = matchedWorker.role || '작업자';
                        workerId = matchedWorker.id || '';
                    }

                    newRows.push({
                        id: currentMaxRowId,
                        name: workerName,
                        manDay: parseFloat(row['공수']) || 1.0,
                        teamId: teamId,
                        teamName: teamName,
                        siteTeamName: initialSiteTeamName,
                        unitPrice: unitPrice,
                        role: role,
                        workerId: workerId
                    });
                });

                // Fill remaining rows to reach 10 if less
                const remaining = 10 - newRows.length;
                if (remaining > 0) {
                    for (let i = 0; i < remaining; i++) {
                        currentMaxRowId++;
                        newRows.push({
                            id: currentMaxRowId,
                            name: '',
                            manDay: 1.0,
                            teamId: '',
                            teamName: '',
                            siteTeamName: initialSiteTeamName,
                        });
                    }
                }

                newTables.push({
                    id: currentMaxTableId,
                    siteId: siteId,
                    rows: newRows
                });
            });

            if (newTables.length > 0) {
                setTables(prev => {
                    const updated = [...prev];
                    let newTableIdx = 0;

                    // Iterate through existing tables to find empty ones
                    for (let i = 0; i < updated.length && newTableIdx < newTables.length; i++) {
                        const isEmpty = updated[i].rows.every(r => !r.name || r.name.trim() === '');
                        if (isEmpty) {
                            updated[i] = newTables[newTableIdx];
                            newTableIdx++;
                        }
                    }

                    // Append remaining new tables
                    if (newTableIdx < newTables.length) {
                        updated.push(...newTables.slice(newTableIdx));
                    }

                    return updated;
                });
                alert(`${newTables.length}개의 장부가 엑셀에서 로드되었습니다.`);
            }
        };
        reader.readAsBinaryString(file);
        // Reset
        e.target.value = '';
    };

    const processKakaoText = async (text: string) => {
        setIsSaving(true);
        try {
            const analyzedReports = await geminiService.analyzeKakaoText(text);

            // Helpers (Duplicated for now, ideally refactor to common utils)
            const findSiteId = (siteName: string): string => {
                if (!siteName) return '';
                const exact = sites.find(s => s.name === siteName);
                if (exact) return exact.id || '';
                const contains = sites.find(s => s.name.includes(siteName) || siteName.includes(s.name));
                if (contains) return contains.id || '';
                return '';
            };
            const findWorker = (workerName: string): Worker | undefined => {
                if (!workerName) return undefined;
                return allWorkers.find(w => w.name === workerName);
            };

            const newTables: TypingTableData[] = [];
            let currentMaxTableId = tables.length > 0 ? Math.max(...tables.map(t => t.id)) : 0;
            let currentMaxRowId = tables.reduce((max, t) => {
                const tableMax = t.rows.length > 0 ? Math.max(...t.rows.map(r => r.id)) : 0;
                return Math.max(max, tableMax);
            }, 0);

            for (const report of analyzedReports) {
                currentMaxTableId++;
                const siteId = findSiteId(report.siteName || '');
                const initialSiteTeamName = siteId ? sites.find(s => s.id === siteId)?.responsibleTeamName : '';

                const newRows: TypingRow[] = [];
                for (const w of report.workers) {
                    currentMaxRowId++;
                    const matchedWorker = findWorker(w.name);

                    newRows.push({
                        id: currentMaxRowId,
                        name: w.name,
                        manDay: w.manDay,
                        teamId: '',
                        teamName: matchedWorker?.teamName || '',
                        siteTeamName: initialSiteTeamName || '',
                        role: w.role || matchedWorker?.role || '',
                        unitPrice: matchedWorker?.unitPrice || 0
                    });
                }

                // Fill remaining
                const remaining = 10 - newRows.length;
                if (remaining > 0) {
                    for (let i = 0; i < remaining; i++) {
                        currentMaxRowId++;
                        newRows.push({
                            id: currentMaxRowId,
                            name: '',
                            manDay: 1.0,
                            teamId: '',
                            teamName: '',
                            siteTeamName: initialSiteTeamName || '',
                        });
                    }
                }

                newTables.push({
                    id: currentMaxTableId,
                    siteId: siteId,
                    rows: newRows
                });
            }

            if (newTables.length > 0) {
                setTables(prev => {
                    const updated = [...prev];
                    let newTableIdx = 0;
                    for (let i = 0; i < updated.length && newTableIdx < newTables.length; i++) {
                        const isEmpty = updated[i].rows.every(r => !r.name || r.name.trim() === '');
                        if (isEmpty) {
                            updated[i] = newTables[newTableIdx];
                            newTableIdx++;
                        }
                    }
                    if (newTableIdx < newTables.length) {
                        updated.push(...newTables.slice(newTableIdx));
                    }
                    return updated;
                });
                alert(`${newTables.length}개의 장부가 카톡 텍스트 분석으로 입력되었습니다.`);
            } else {
                alert('텍스트에서 유효한 일보 데이터를 찾지 못했습니다.');
            }

        } catch (error) {
            console.error("AI Text Analysis Failed", error);
            alert("텍스트 분석에 실패했습니다. 다시 시도해주세요.");
            setIsSaving(false);
        }
    };

    // --- Global Paste Handler ---
    useEffect(() => {
        const handleGlobalPaste = (e: Event) => {
            const clipboardEvent = e as ClipboardEvent;

            // Ignore if pasting into an input/textarea
            const activeTag = document.activeElement?.tagName;
            if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
                return;
            }

            const clipboardData = clipboardEvent.clipboardData;
            if (!clipboardData) return;

            // 1. Handle Files (Images)
            if (clipboardData.files && clipboardData.files.length > 0) {
                const file = clipboardData.files[0];
                if (file.type.startsWith('image/')) {
                    clipboardEvent.preventDefault();
                    processKakaoImage(file);
                    return;
                }
            }

            // 2. Handle Text
            const text = clipboardData.getData('text');
            if (text && text.length > 20) { // Threshold to ignore short copy-pastes
                if (window.confirm("붙여넣은 텍스트를 AI로 분석하여 일보를 작성하시겠습니까?\n(취소 시 일반 붙여넣기가 무시됩니다)")) {
                    clipboardEvent.preventDefault();
                    processKakaoText(text);
                }
            }
        };

        window.addEventListener('paste', handleGlobalPaste as EventListener);
        return () => window.removeEventListener('paste', handleGlobalPaste as EventListener);
    }); // Intentionally no deps array to access latest state via closures if functions aren't memoized properly, 
    // OR better: include specific dependencies if functions are stable. 
    // Since processKakaoText uses `tables` state setter (functional update), it might be robust, 
    // but it reads `tables` for max ID? Yes. 
    // Safest is to let it re-bind on render or use refs. Given React 18, re-binding is cheap enough for this page.

    return (
        <div
            className="flex flex-col h-full bg-slate-50 relative focus:outline-none"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Drag Overlay */}
            {isDragging && (
                <div className="absolute inset-0 bg-yellow-400/80 z-50 flex items-center justify-center backdrop-blur-sm pointer-events-none">
                    <div className="text-center bg-white p-8 rounded-2xl shadow-2xl">
                        <FontAwesomeIcon icon={faComment} className="text-6xl text-yellow-500 mb-4" />
                        <h2 className="text-3xl font-bold text-slate-800">카톡 이미지 떨어뜨리기</h2>
                        <p className="text-xl text-slate-500 mt-2">AI가 자동으로 일보를 작성합니다!</p>
                    </div>
                </div>
            )}

            {/* Top Header: Date Selection & Actions */}
            <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2">
                        <FontAwesomeIcon icon={faCalendarAlt} className="text-slate-500" />
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 p-0"
                        />
                    </div>
                    <button
                        onClick={addTable}
                        className="w-10 h-10 bg-white border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 flex items-center justify-center transition-colors"
                        title="장부 추가"
                    >
                        <FontAwesomeIcon icon={faPlus} className="text-lg" />
                    </button>
                    <button
                        onClick={removeLastTable}
                        className="w-10 h-10 bg-white border border-slate-300 text-red-500 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors"
                        title="장부 삭제"
                    >
                        <FontAwesomeIcon icon={faMinus} className="text-lg" />
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExcelDownload}
                        className="w-10 h-10 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center shadow-sm transition-colors"
                        title="엑셀 다운로드"
                    >
                        <FontAwesomeIcon icon={faFileExport} className="text-lg" />
                    </button>
                    <label className="cursor-pointer w-10 h-10 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center shadow-sm transition-colors" title="엑셀 업로드">
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            className="hidden"
                            onChange={handleExcelUpload}
                            disabled={isSaving}
                        />
                        <FontAwesomeIcon icon={faFileImport} className="text-lg" />
                    </label>
                    <label className="cursor-pointer w-10 h-10 bg-yellow-400 text-slate-900 rounded-lg hover:bg-yellow-500 flex items-center justify-center shadow-sm transition-colors" title="카톡 캡처 업로드 (AI)">
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleKakaoUpload}
                            disabled={isSaving}
                        />
                        <FontAwesomeIcon icon={faComment} className="text-lg" />
                    </label>

                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-10 h-10 bg-brand-600 text-white rounded-lg hover:bg-brand-700 shadow-md transition-colors flex items-center justify-center"
                        title="전체 저장하기"
                    >
                        <FontAwesomeIcon icon={faSave} className="text-lg" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
                {isSaving && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded-lg shadow-xl text-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600 mx-auto mb-4"></div>
                            <p className="font-bold text-lg">AI가 이미지를 분석 중입니다...</p>
                            <p className="text-sm text-slate-500">잠시만 기다려주세요.</p>
                        </div>
                    </div>
                )}
                <div className="flex flex-wrap gap-6 items-start content-start">
                    {tables.map((table, tableIndex) => (
                        <TypingTable
                            key={table.id}
                            table={table}
                            index={tableIndex}
                            sites={sites}
                            onSiteChange={handleTableSiteChange}
                            onNameChange={handleNameChange}
                            onRowChange={handleRowChange}
                            onAddRows={addRowsToTable}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DailyReportTyping;
