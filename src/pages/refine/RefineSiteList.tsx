import React, { useState, useMemo, useCallback } from "react";
import { AgGridReact } from "ag-grid-react";
import {
    ColDef,
    ValueFormatterParams,
    ICellRendererParams,
    GridReadyEvent
} from "ag-grid-community";
// import "ag-grid-community/styles/ag-grid.css"; // Removed for AG Grid v33+ Theming API compatibility
import "ag-grid-community/styles/ag-theme-quartz.css";
import { resolveIcon } from "../../constants/iconMap";
import { useMasterData } from "../../contexts/MasterDataContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faPaste, faGraduationCap, faDatabase, faSearch,
    faBuilding, faMapMarkerAlt, faInfoCircle, faClipboardCheck,
    faLayerGroup, faBolt
} from "@fortawesome/free-solid-svg-icons";
import * as Fas from "@fortawesome/free-solid-svg-icons";
import styled from "styled-components";
import { Site } from "../../services/siteService";

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

const StatusBadge = styled.span<{ status: string }>`
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: capitalize;
    background-color: ${props => props.status === 'active' ? '#dcfce7' : '#f1f5f9'};
    color: ${props => props.status === 'active' ? '#166534' : '#64748b'};
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

// --- Components ---

export const RefineSiteList: React.FC = () => {
    // 1. Data Source (Master Data)
    const { sites, companies, teams, loading } = useMasterData();

    // 2. UI State
    const [searchTerm, setSearchTerm] = useState("");
    const [isEduMode, setIsEduMode] = useState(false);
    const [gridApi, setGridApi] = useState<any>(null);

    // 3. Computed Stats
    const stats = useMemo(() => ({
        total: sites.length,
        active: sites.filter(s => s.status === 'active').length,
        completed: sites.filter(s => s.status === 'completed').length
    }), [sites]);

    // 4. Smart Filter Logic
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text');

        // Split by newlines or commas
        const terms = text.split(/[\n,]+/).map(t => t.trim()).filter(Boolean);

        if (terms.length > 0) {
            const joined = terms.join(" ");
            setSearchTerm(joined);

            // Apply AG Grid Quick Filter
            if (gridApi) {
                gridApi.setGridOption('quickFilterText', joined);
            }

            // Notify user of smart action
            // In a real app, use a toast here
            console.log(`Smart Paste: Filtered by ${terms.length} terms`);
        }
    }, [gridApi]);

    const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchTerm(val);
        if (gridApi) {
            gridApi.setGridOption('quickFilterText', val);
        }
    };

    // 5. Column Definitions
    const columnDefs = useMemo<ColDef[]>(() => [
        {
            field: "id",
            headerName: "Site ID (PK)",
            width: 120,
            hide: !isEduMode,
            cellRenderer: (params: ICellRendererParams) => (
                <CellWrapper>
                    <span className="font-mono text-xs text-slate-400">{params.value?.substring(0, 8)}...</span>
                    {isEduMode && (
                        <EduTooltip>
                            <h4><FontAwesomeIcon icon={faDatabase} /> Primary Key (PK)</h4>
                            고유 식별자입니다. Firebase Firestore 문서의 ID이며, 다른 컬렉션과 연결할 때 Reference로 사용됩니다.
                        </EduTooltip>
                    )}
                </CellWrapper>
            )
        },
        {
            field: "name",
            headerName: "현장명 (Project Name)",
            flex: 2,
            minWidth: 200,
            cellRenderer: (params: ICellRendererParams) => (
                <div className="flex items-center gap-3">
                    <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: params.data.color || '#cbd5e1' }}
                    />
                    <span className="font-medium text-slate-700">{params.value}</span>
                </div>
            )
        },
        {
            field: "status",
            headerName: "상태",
            width: 120,
            cellRenderer: (params: ICellRendererParams) => (
                <StatusBadge status={params.value}>{params.value === 'active' ? '진행중' : params.value === 'completed' ? '종료' : params.value}</StatusBadge>
            )
        },
        {
            field: "responsibleTeamId",
            headerName: "담당팀 (Relation)",
            flex: 1,
            cellRenderer: (params: ICellRendererParams) => {
                const team = teams.find(t => t.id === params.value);
                return (
                    <CellWrapper>
                        <span className="text-sm">{team?.name || '-'}</span>
                        {isEduMode && params.value && (
                            <EduTooltip>
                                <h4><FontAwesomeIcon icon={faLayerGroup} /> Foreign Key (FK)</h4>
                                <code>teams</code> 컬렉션의 ID <code>{params.value}</code>를 참조하고 있습니다.
                                <br />실제 데이터엔 ID만 저장되지만, MasterData Context를 통해 이름으로 변환(Join)하여 표시합니다.
                            </EduTooltip>
                        )}
                    </CellWrapper>
                );
            }
        },
        {
            field: "companyId",
            headerName: "시공사 (Constructor)",
            flex: 1,
            cellRenderer: (params: ICellRendererParams) => {
                const comp = companies.find(c => c.id === params.value);
                return (
                    <CellWrapper>
                        <span className="text-sm">{comp?.name || '-'}</span>
                        {isEduMode && params.value && (
                            <EduTooltip>
                                <h4><FontAwesomeIcon icon={faBuilding} /> Foreign Key (FK)</h4>
                                <code>companies</code> 컬렉션의 ID를 참조합니다. (시공사)
                            </EduTooltip>
                        )}
                    </CellWrapper>
                );
            }
        },
        {
            field: "clientCompanyId",
            headerName: "발주사 (Client)",
            flex: 1,
            cellRenderer: (params: ICellRendererParams) => {
                const comp = companies.find(c => c.id === params.value);
                const iconName = comp?.iconKey;
                const Icon = resolveIcon(iconName, faBuilding);

                return (
                    <CellWrapper>
                        <div className="flex items-center gap-2">
                            {comp && (
                                <div className={`w-6 h-6 rounded flex items-center justify-center ${iconName ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                    <FontAwesomeIcon icon={Icon} className="text-xs" />
                                </div>
                            )}
                            <span className="text-sm font-medium text-slate-700">{comp?.name || '-'}</span>
                        </div>
                        {isEduMode && params.value && (
                            <EduTooltip>
                                <h4><FontAwesomeIcon icon={faBuilding} /> Foreign Key (FK)</h4>
                                <code>companies</code> 컬렉션의 ID를 참조합니다. (발주사)
                                <br />회사 DB(`companies`)에 저장된 아이콘(`{iconName || 'default'}`)을 가져와 표시합니다.
                            </EduTooltip>
                        )}
                    </CellWrapper>
                );
            }
        },
        {
            field: "address",
            headerName: "현장 주소",
            flex: 2,
            valueFormatter: (params: ValueFormatterParams) => params.value || '-'
        }
    ], [isEduMode, teams, companies]);

    const onGridReady = (params: GridReadyEvent) => {
        setGridApi(params.api);
    };

    if (loading) return <div className="p-8 text-center text-slate-500">데이터를 불러오는 중입니다...</div>;

    return (
        <ConsoleContainer>
            {/* 1. Header Area */}
            <Header>
                <TitleSection>
                    <Title>
                        <FontAwesomeIcon icon={faBolt} className="text-amber-500" />
                        통합 데이터 콘솔 (Integrated Console)
                    </Title>
                    <Subtitle>모든 현장 데이터를 한눈에 파악하고, 스마트 필터로 빠르게 검색하세요.</Subtitle>
                </TitleSection>
                <StatsGrid>
                    <StatCard>
                        <span className="label">Total Projects</span>
                        <span className="value">{stats.total}</span>
                    </StatCard>
                    <StatCard>
                        <span className="label text-emerald-600">Active</span>
                        <span className="value text-emerald-600">{stats.active}</span>
                    </StatCard>
                </StatsGrid>
            </Header>

            {/* 2. Toolbar */}
            <Toolbar>
                <SmartSearchInput>
                    <FontAwesomeIcon icon={faSearch} />
                    <input
                        type="text"
                        placeholder="검색어 입력 또는 엑셀에서 복사한 여러 값을 붙여넣기 하세요 (Smart Paste)"
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
                    {isEduMode ? '교육 모드 켜짐 (Hover Cells)' : '교육 모드 (데이터 구조 보기)'}
                </button>
            </Toolbar>

            {/* 3. Data Grid */}
            <GridWrapper>
                <div className="ag-theme-quartz">
                    <AgGridReact
                        rowData={sites}
                        columnDefs={columnDefs}
                        onGridReady={onGridReady}
                        pagination={true}
                        paginationPageSize={20}
                        animateRows={true}
                        rowSelection="multiple"
                        suppressRowClickSelection={true}
                        tooltipShowDelay={0}
                    />
                </div>
            </GridWrapper>
        </ConsoleContainer>
    );
};

export default RefineSiteList;
