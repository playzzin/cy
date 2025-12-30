import React, { useState, useMemo, useCallback } from "react";
import { AgGridReact } from "ag-grid-react";
import {
    ColDef,
    ICellRendererParams,
    GridReadyEvent
} from "ag-grid-community";
// import "ag-grid-community/styles/ag-grid.css"; // Removed for AG Grid v33+ Theming API compatibility
import "ag-grid-community/styles/ag-theme-quartz.css";
import { useMasterData } from "../../contexts/MasterDataContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faSearch, faInfoCircle, faUsers, faBuilding, faIdBadge
} from "@fortawesome/free-solid-svg-icons";
import styled from "styled-components";

// --- Styled Components ---
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

export const RefineTeamList: React.FC = () => {
    const { teams, companies, loading } = useMasterData();
    const [searchTerm, setSearchTerm] = useState("");
    const [isEduMode, setIsEduMode] = useState(false);
    const [gridApi, setGridApi] = useState<any>(null);

    const stats = useMemo(() => ({
        total: teams.length,
        active: teams.filter(t => t.status === 'active').length,
    }), [teams]);

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

    const columnDefs = useMemo<ColDef[]>(() => [
        {
            field: "id",
            headerName: "Team ID (PK)",
            width: 120,
            hide: !isEduMode,
            cellRenderer: (params: ICellRendererParams) => (
                <CellWrapper>
                    <span className="font-mono text-xs text-slate-400">{params.value?.substring(0, 8)}...</span>
                    {isEduMode && (
                        <EduTooltip>
                            <h4><FontAwesomeIcon icon={faIdBadge} /> Primary Key</h4>
                            팀을 식별하는 고유 ID입니다.
                        </EduTooltip>
                    )}
                </CellWrapper>
            )
        },
        {
            field: "name",
            headerName: "팀명 (Team Name)",
            flex: 2,
            cellRenderer: (params: ICellRendererParams) => (
                <div className="flex items-center gap-3">
                    <span className="font-medium text-slate-700">{params.value}</span>
                </div>
            )
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
                                팀이 소속된 회사(`companyId`)를 참조하여 이름을 표시합니다.
                            </EduTooltip>
                        )}
                    </CellWrapper>
                );
            }
        },
        {
            field: "status",
            headerName: "상태",
            width: 100,
            cellRenderer: (params: ICellRendererParams) => (
                <span className={`px-2 py-1 rounded text-xs font-semibold ${params.value === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                    {params.value === 'active' ? 'Active' : params.value}
                </span>
            )
        }
    ], [isEduMode, companies]);

    if (loading) return <div className="p-8 text-center text-slate-500">데이터를 불러오는 중...</div>;

    return (
        <ConsoleContainer>
            <Header>
                <TitleSection>
                    <Title>
                        <FontAwesomeIcon icon={faUsers} className="text-blue-500" />
                        팀 관리 콘솔 (Team Console)
                    </Title>
                    <Subtitle>팀 현황을 조회하고 관리합니다.</Subtitle>
                </TitleSection>
                <StatsGrid>
                    <StatCard>
                        <span className="label">Total Teams</span>
                        <span className="value">{stats.total}</span>
                    </StatCard>
                    <StatCard>
                        <span className="label text-green-600">Active</span>
                        <span className="value text-green-600">{stats.active}</span>
                    </StatCard>
                </StatsGrid>
            </Header>

            <Toolbar>
                <SmartSearchInput>
                    <FontAwesomeIcon icon={faSearch} />
                    <input
                        type="text"
                        placeholder="팀명 검색... (Smart Paste 지원)"
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
                        rowData={teams}
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

export default RefineTeamList;
