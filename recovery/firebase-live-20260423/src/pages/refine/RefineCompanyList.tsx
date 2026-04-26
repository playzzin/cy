import React, { useState, useMemo, useCallback } from "react";
import { AgGridReact } from "ag-grid-react";
import {
    ColDef,
    ICellRendererParams,
    ValueFormatterParams,
    GridReadyEvent
} from "ag-grid-community";
// import "ag-grid-community/styles/ag-grid.css"; // Removed for AG Grid v33+ Theming API compatibility
import "ag-grid-community/styles/ag-theme-quartz.css";
import { resolveIcon } from "../../constants/iconMap";
import { useMasterData } from "../../contexts/MasterDataContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faSearch, faInfoCircle, faBuilding, faBriefcase
} from "@fortawesome/free-solid-svg-icons";
import * as Fas from "@fortawesome/free-solid-svg-icons";
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

const TypeBadge = styled.span<{ type: string }>`
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    background-color: ${props => props.type === '시공사' ? '#dbeafe' : props.type === '발주사' ? '#f3e8ff' : '#f1f5f9'};
    color: ${props => props.type === '시공사' ? '#1e40af' : props.type === '발주사' ? '#7e22ce' : '#64748b'};
`;

export const RefineCompanyList: React.FC = () => {
    const { companies, loading } = useMasterData();
    const [searchTerm, setSearchTerm] = useState("");
    const [isEduMode, setIsEduMode] = useState(false);
    const [gridApi, setGridApi] = useState<any>(null);

    const stats = useMemo(() => ({
        total: companies.length,
        constructors: companies.filter(c => c.type === '시공사').length,
    }), [companies]);

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
            field: "name",
            headerName: "회사명 (Company Name)",
            flex: 2,
            cellRenderer: (params: ICellRendererParams) => {
                const iconName = params.data.iconKey;
                const Icon = resolveIcon(iconName, faBuilding);
                return (
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded flex items-center justify-center ${iconName ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                            <FontAwesomeIcon icon={Icon} />
                        </div>
                        <span className="font-medium text-slate-700">{params.value}</span>
                    </div>
                );
            }
        },
        {
            field: "type",
            headerName: "구분",
            width: 120,
            cellRenderer: (params: ICellRendererParams) => (
                <TypeBadge type={params.value}>{params.value}</TypeBadge>
            )
        },
        {
            field: "businessRegistrationNumber",
            headerName: "사업자 번호",
            flex: 1,
            valueFormatter: (params: ValueFormatterParams) => params.value || '-'
        },
        {
            field: "representativeParams",
            headerName: "대표자",
            flex: 1,
            valueGetter: (params) => params.data.representativeName || params.data.ownerName || '-',
        },
        {
            field: "siteIds",
            headerName: "연결된 현장 수",
            width: 140,
            valueGetter: (params) => params.data.siteIds?.length || 0,
            cellRenderer: (params: ICellRendererParams) => (
                <CellWrapper>
                    <span className="font-mono">{params.value}개</span>
                    {isEduMode && (
                        <EduTooltip>
                            <h4><FontAwesomeIcon icon={faBriefcase} /> 1:N Relationship</h4>
                            하나의 회사는 여러 현장(1:N)을 관리하거나 계약할 수 있습니다.
                        </EduTooltip>
                    )}
                </CellWrapper>
            )
        }
    ], [isEduMode]);

    if (loading) return <div className="p-8 text-center text-slate-500">데이터를 불러오는 중...</div>;

    return (
        <ConsoleContainer>
            <Header>
                <TitleSection>
                    <Title>
                        <FontAwesomeIcon icon={faBuilding} className="text-violet-500" />
                        회사/거래처 콘솔 (Company Console)
                    </Title>
                    <Subtitle>시공사, 협력사, 발주사 등 모든 거래처를 관리합니다.</Subtitle>
                </TitleSection>
                <StatsGrid>
                    <StatCard>
                        <span className="label">Total Companies</span>
                        <span className="value">{stats.total}</span>
                    </StatCard>
                    <StatCard>
                        <span className="label text-blue-600">Active</span>
                        <span className="value text-blue-600">{stats.constructors}</span>
                    </StatCard>
                </StatsGrid>
            </Header>

            <Toolbar>
                <SmartSearchInput>
                    <FontAwesomeIcon icon={faSearch} />
                    <input
                        type="text"
                        placeholder="회사명, 사업자번호 검색... (Smart Paste 지원)"
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
                        rowData={companies}
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

export default RefineCompanyList;
