import React, { useState, useMemo, useCallback, useEffect } from "react";
import { AgGridReact } from "ag-grid-react";
import {
    ColDef,
    ValueFormatterParams,
    ICellRendererParams,
    GridReadyEvent
} from "ag-grid-community";
// import "ag-grid-community/styles/ag-grid.css"; // Removed for AG Grid v33+ Theming API compatibility
import "ag-grid-community/styles/ag-theme-quartz.css";
import { useMasterData } from "../../contexts/MasterDataContext";
import { manpowerService, Worker } from "../../services/manpowerService";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faSearch, faInfoCircle, faUser, faLayerGroup,
    faBuilding, faIdCard, faHardHat
} from "@fortawesome/free-solid-svg-icons";
import styled from "styled-components";

// --- Styled Components (Shared Design System) ---
const ConsoleContainer = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: #f8fafc;
    font-family: 'Inter', apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
`;

const Header = styled.div`
    background: white;
    padding: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
`;

const TitleSection = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
`;

const Title = styled.h1`
    font-size: 1.5rem;
    font-weight: 700;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 0.75rem;
`;

const Subtitle = styled.p`
    font-size: 0.875rem;
    color: #64748b;
`;

const StatsGrid = styled.div`
    display: flex;
    gap: 1.5rem;
`;

const StatCard = styled.div`
    background: white;
    padding: 1rem 1.5rem;
    border-radius: 0.75rem;
    border: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    min-width: 140px;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);

    span.label {
        font-size: 0.75rem;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.025em;
    }

    span.value {
        font-size: 1.5rem;
        font-weight: 700;
        color: #0f172a;
        margin-top: 0.25rem;
    }
`;

const Toolbar = styled.div`
    padding: 1rem 1.5rem;
    display: flex;
    gap: 1rem;
    align-items: center;
    background: #f1f5f9;
    border-bottom: 1px solid #e2e8f0;
`;

const SmartSearchInput = styled.div`
    position: relative;
    flex: 1;
    max-width: 500px;
    
    input {
        width: 100%;
        padding: 0.625rem 1rem 0.625rem 2.5rem;
        border: 1px solid #cbd5e1;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        transition: all 0.2s;
        
        &:focus {
            outline: none;
            border-color: #6366f1;
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }
    }

    svg {
        position: absolute;
        left: 0.875rem;
        top: 50%;
        transform: translateY(-50%);
        color: #94a3b8;
    }
`;

const GridWrapper = styled.div`
    flex: 1;
    padding: 1.5rem;
    overflow: hidden;
    
    .ag-theme-quartz {
        height: 100%;
        width: 100%;
        --ag-header-height: 48px;
        --ag-row-height: 48px;
        --ag-borders: none;
        --ag-header-background-color: #f8fafc;
        --ag-row-border-color: #e2e8f0;
        --ag-header-foreground-color: #475569;
        --ag-foreground-color: #334155;
        --ag-font-family: 'Inter', sans-serif;
        --ag-font-size: 13px;
    }

    .ag-header-cell-label {
        font-weight: 600;
    }
`;

const EduTooltip = styled.div`
    position: absolute;
    bottom: 110%;
    left: 50%;
    transform: translateX(-50%);
    background: #1e293b;
    color: white;
    padding: 0.75rem;
    border-radius: 0.5rem;
    font-size: 0.75rem;
    width: 250px;
    z-index: 100;
    pointer-events: none;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    opacity: 0;
    transition: opacity 0.2s;
    line-height: 1.4;

    &::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        margin-left: -5px;
        border-width: 5px;
        border-style: solid;
        border-color: #1e293b transparent transparent transparent;
    }

    h4 {
        font-weight: 700;
        margin-bottom: 0.25rem;
        color: #60a5fa;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
`;

const CellWrapper = styled.div`
    display: flex;
    align-items: center;
    height: 100%;
    position: relative;
    
    &:hover ${EduTooltip} {
        opacity: 1;
    }
`;

const RoleBadge = styled.span<{ role: string }>`
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.7rem;
    font-weight: 600;
    background-color: ${props => props.role?.includes('반장') ? '#e0e7ff' : '#f1f5f9'};
    color: ${props => props.role?.includes('반장') ? '#4338ca' : '#64748b'};
`;

export const RefineWorkerList: React.FC = () => {
    // 1. Data Source
    const { companies, teams } = useMasterData();
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch Workers
    useEffect(() => {
        const fetchWorkers = async () => {
            try {
                const data = await manpowerService.getWorkers();
                setWorkers(data);
            } catch (error) {
                console.error("Failed to fetch workers", error);
            } finally {
                setLoading(false);
            }
        };
        fetchWorkers();
    }, []);

    // 2. UI State
    const [searchTerm, setSearchTerm] = useState("");
    const [isEduMode, setIsEduMode] = useState(false);
    const [gridApi, setGridApi] = useState<any>(null);

    // 3. Stats
    const stats = useMemo(() => ({
        total: workers.length,
        skilled: workers.filter(w => w.role && w.role !== '일반').length,
    }), [workers]);

    // 4. Smart Filter
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text');
        const terms = text.split(/[\n,]+/).map(t => t.trim()).filter(Boolean);

        if (terms.length > 0) {
            const joined = terms.join(" ");
            setSearchTerm(joined);
            if (gridApi) gridApi.setGridOption('quickFilterText', joined);
        }
    }, [gridApi]);

    const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchTerm(val);
        if (gridApi) gridApi.setGridOption('quickFilterText', val);
    };

    // 5. Columns
    const columnDefs = useMemo<ColDef[]>(() => [
        {
            field: "id",
            headerName: "ID (PK)",
            width: 100,
            hide: !isEduMode,
            cellRenderer: (params: ICellRendererParams) => (
                <CellWrapper>
                    <span className="font-mono text-xs text-slate-400">{params.value?.substring(0, 8)}...</span>
                    {isEduMode && (
                        <EduTooltip>
                            <h4><FontAwesomeIcon icon={faIdCard} /> Primary Key</h4>
                            시스템에서 작업자를 구분하는 고유 ID입니다.
                        </EduTooltip>
                    )}
                </CellWrapper>
            )
        },
        {
            field: "name",
            headerName: "성명 (Name)",
            flex: 1,
            cellRenderer: (params: ICellRendererParams) => (
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <FontAwesomeIcon icon={faUser} className="text-xs" />
                    </div>
                    <span className="font-medium text-slate-700">{params.value}</span>
                </div>
            )
        },
        {
            field: "birthDate",
            headerName: "생년월일",
            width: 120,
            valueFormatter: (params: ValueFormatterParams) => params.value || '-'
        },
        {
            field: "role",
            headerName: "직책",
            width: 120,
            cellRenderer: (params: ICellRendererParams) => (
                <RoleBadge role={params.value}>{params.value || '일반'}</RoleBadge>
            )
        },
        {
            field: "teamId",
            headerName: "소속 팀 (Relation)",
            flex: 1,
            cellRenderer: (params: ICellRendererParams) => {
                const team = teams.find(t => t.id === params.value);
                return (
                    <CellWrapper>
                        <span className="text-sm">{team?.name || '-'}</span>
                        {isEduMode && params.value && (
                            <EduTooltip>
                                <h4><FontAwesomeIcon icon={faLayerGroup} /> Foreign Key Joined</h4>
                                Worker 데이터에는 <code>teamId</code>만 저장되지만, Teams 리스트와 연결(Join)하여 팀 이름을 실시간으로 표시합니다.
                            </EduTooltip>
                        )}
                    </CellWrapper>
                );
            }
        },
        {
            field: "companyId",
            headerName: "소속 회사 (Relation)",
            flex: 1,
            cellRenderer: (params: ICellRendererParams) => {
                const comp = companies.find(c => c.id === params.value);
                return (
                    <CellWrapper>
                        <span className="text-sm">{comp?.name || '-'}</span>
                        {isEduMode && params.value && (
                            <EduTooltip>
                                <h4><FontAwesomeIcon icon={faBuilding} /> Foreign Key Joined</h4>
                                Worker 데이터에는 <code>companyId</code>만 저장되지만, Companies 리스트와 연결하여 회사 이름을 표시합니다.
                            </EduTooltip>
                        )}
                    </CellWrapper>
                );
            }
        },
        {
            field: "wage",
            headerName: "단가 (Rate)",
            width: 120,
            type: "rightAligned",
            valueFormatter: (params: ValueFormatterParams) =>
                params.value ? `${params.value.toLocaleString()} 원` : '-'
        }
    ], [isEduMode, teams, companies]);

    if (loading) return <div className="p-8 text-center text-slate-500">작업자 데이터를 불러오는 중...</div>;

    return (
        <ConsoleContainer>
            <Header>
                <TitleSection>
                    <Title>
                        <FontAwesomeIcon icon={faHardHat} className="text-orange-500" />
                        작업자 관리 콘솔 (Worker Console)
                    </Title>
                    <Subtitle>전체 작업자 명단을 관리하고 상세 정보를 조회합니다.</Subtitle>
                </TitleSection>
                <StatsGrid>
                    <StatCard>
                        <span className="label">Total Workers</span>
                        <span className="value">{stats.total}</span>
                    </StatCard>
                    <StatCard>
                        <span className="label text-indigo-600">Skilled</span>
                        <span className="value text-indigo-600">{stats.skilled}</span>
                    </StatCard>
                </StatsGrid>
            </Header>

            <Toolbar>
                <SmartSearchInput>
                    <FontAwesomeIcon icon={faSearch} />
                    <input
                        type="text"
                        placeholder="이름, 주민번호, 팀명 검색... (Smart Paste 지원)"
                        value={searchTerm}
                        onChange={onSearchChange}
                        onPaste={handlePaste}
                    />
                </SmartSearchInput>
                <div className="flex-1" />
                <button
                    onClick={() => setIsEduMode(!isEduMode)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border ${isEduMode
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                >
                    <FontAwesomeIcon icon={faInfoCircle} />
                    {isEduMode ? '교육 모드 켜짐' : '교육 모드'}
                </button>
            </Toolbar>

            <GridWrapper>
                <div className="ag-theme-quartz">
                    <AgGridReact
                        rowData={workers}
                        columnDefs={columnDefs}
                        onGridReady={(p) => setGridApi(p.api)}
                        pagination={true}
                        paginationPageSize={20}
                        animateRows={true}
                    />
                </div>
            </GridWrapper>
        </ConsoleContainer>
    );
};

export default RefineWorkerList;
