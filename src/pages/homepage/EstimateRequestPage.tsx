import React, { useMemo } from 'react';
import { useList } from '@refinedev/core';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ValueFormatterParams } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faFileInvoiceDollar, 
    faBuilding, 
    faUser, 
    faPhone, 
    faEnvelope, 
    faWrench, 
    faSpinner,
    faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';

// --- Styled Components ---

const PageContainer = styled.div`
    display: flex;
    flex-direction: column;
    min-height: calc(100vh - 48px);
    margin: -24px; /* Breaks out of typical Refine layout padding */
    padding: 24px;
    background-color: #0f172a; /* Premium sleek dark background */
    font-family: 'Inter', apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #f8fafc;
`;

const Header = styled.div`
    /* Glassmorphism Effect */
    background: rgba(30, 41, 59, 0.7);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    padding: 2rem 2.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    z-index: 10;
`;

const TitleSection = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
`;

const Title = styled.h1`
    font-size: 1.75rem;
    font-weight: 800;
    color: #f8fafc; /* Crisp white */
    display: flex;
    align-items: center;
    gap: 0.875rem;
    letter-spacing: -0.025em;

    .icon-gradient {
        /* Gradient mapping for the icon */
        background: -webkit-linear-gradient(45deg, #818cf8, #c084fc);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-size: 1.875rem;
        filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.3));
    }
`;

const Subtitle = styled.p`
    font-size: 0.95rem;
    color: #94a3b8; /* Slate 400 */
    font-weight: 400;
`;

const StateContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 1.5rem;
    color: #94a3b8;
    
    .spinner {
        animation: spin 1s linear infinite;
        font-size: 2.5rem;
        color: #818cf8;
    }

    .error-icon {
        font-size: 3rem;
        color: #fb7185;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;

const GridWrapper = styled.div`
    flex: 1;
    padding: 1.5rem;
    overflow: hidden;
    
    .ag-theme-quartz-dark {
        height: 100%;
        width: 100%;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1);
        
        /* AG Grid Advanced Theming for Dark Mode */
        --ag-header-height: 54px;
        --ag-row-height: 56px;
        --ag-borders: none;
        
        --ag-background-color: #1e293b; /* Slate 800 */
        --ag-header-background-color: #0f172a; /* Slate 900 */
        --ag-row-border-color: #334155; /* Slate 700 */
        
        --ag-header-foreground-color: #cbd5e1; /* Slate 300 */
        --ag-foreground-color: #f1f5f9; /* Slate 100 */
        
        --ag-row-hover-color: rgba(99, 102, 241, 0.1); /* Indigo tint hover */
        --ag-selected-row-background-color: rgba(99, 102, 241, 0.2);
        
        --ag-font-family: 'Inter', sans-serif;
        --ag-font-size: 14px;
        --ag-cell-horizontal-padding: 1rem;
    }

    .ag-header-cell-label {
        font-weight: 700;
        letter-spacing: 0.025em;
        text-transform: uppercase;
        font-size: 12px;
    }

    .ag-cell {
        display: flex;
        align-items: center;
        transition: background-color 0.2s ease;
    }
`;

// --- Interfaces ---

export interface EstimateRequest {
    id: string;
    companyName: string;
    contactName: string;
    contactNumber: string;
    email: string;
    constructionType: string;
    content: string;
    createdAt?: any;
}

// --- Cell Renderers ---

const IconCell = styled.div`
    display: flex;
    align-items: center;
    gap: 0.75rem;

    svg {
        color: #64748b; /* Slate 500 */
        font-size: 0.875rem;
        transition: color 0.2s ease;
    }

    span {
        font-weight: 500;
        color: #f1f5f9; /* Slate 100 */
    }

    /* Hover effect on the row will highlight the icon slightly */
    .ag-row-hover & svg {
        color: #818cf8; /* Indigo 400 */
    }
`;

const Badge = styled.span`
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.025em;
    /* Sleek gradient badge for dark mode */
    background: rgba(99, 102, 241, 0.15); /* Indigo 500 at 15% opacity */
    color: #818cf8; /* Indigo 400 */
    border: 1px solid rgba(99, 102, 241, 0.3);
    box-shadow: 0 0 10px rgba(99, 102, 241, 0.1);
`;

// --- Component ---

const EstimateRequestPage: React.FC = () => {
    // 1. Fetch data through Refine's useList
    const { data, isLoading, isError } = useList<EstimateRequest>({
        resource: 'estimate_requests',
        pagination: { mode: 'off' },
        sorters: [
            {
                field: 'createdAt',
                order: 'desc',
            },
        ],
    });

    const requests = data?.data || [];

    // 2. Column Definitions for AG Grid
    const columnDefs = useMemo<ColDef[]>(() => [
        {
            field: 'createdAt',
            headerName: '문의 일자',
            width: 160,
            valueFormatter: (params: ValueFormatterParams) => {
                if (!params.value) return '-';
                const date = params.value.toDate ? params.value.toDate() : new Date(params.value);
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                const hh = String(date.getHours()).padStart(2, '0');
                const min = String(date.getMinutes()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
            },
            cellRenderer: (params: any) => (
                <span style={{ color: '#cbd5e1', fontWeight: 500 }}>{params.valueFormatted}</span>
            )
        },
        {
            field: 'companyName',
            headerName: '회사명',
            flex: 1.2,
            minWidth: 150,
            cellRenderer: (params: any) => (
                <IconCell>
                    <FontAwesomeIcon icon={faBuilding} />
                    <span>{params.value || '-'}</span>
                </IconCell>
            )
        },
        {
            field: 'contactName',
            headerName: '담당자명',
            width: 140,
            cellRenderer: (params: any) => (
                <IconCell>
                    <FontAwesomeIcon icon={faUser} />
                    <span>{params.value || '-'}</span>
                </IconCell>
            )
        },
        {
            field: 'contactNumber',
            headerName: '연락처',
            width: 180,
            cellRenderer: (params: any) => (
                <IconCell>
                    <FontAwesomeIcon icon={faPhone} />
                    <span style={{ letterSpacing: '0.05em' }}>{params.value || '-'}</span>
                </IconCell>
            )
        },
        {
            field: 'email',
            headerName: '이메일',
            width: 250,
            cellRenderer: (params: any) => (
                <IconCell>
                    <FontAwesomeIcon icon={faEnvelope} />
                    <span style={{ opacity: 0.9 }}>{params.value || '-'}</span>
                </IconCell>
            )
        },
        {
            field: 'constructionType',
            headerName: '시공 종류',
            width: 160,
            cellRenderer: (params: any) => (
                <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                    {params.value ? (
                        <Badge>
                            <FontAwesomeIcon icon={faWrench} style={{ marginRight: '6px', fontSize: '10px' }} />
                            {params.value}
                        </Badge>
                    ) : (
                        <span style={{ color: '#64748b' }}>-</span>
                    )}
                </div>
            )
        },
        {
            field: 'content',
            headerName: '문의 내용',
            flex: 2.5,
            minWidth: 350,
            cellStyle: { 
                whiteSpace: 'normal', 
                lineHeight: '1.6', 
                paddingTop: '12px', 
                paddingBottom: '12px',
                color: '#94a3b8'
            },
            autoHeight: true,
            valueFormatter: (params: ValueFormatterParams) => params.value || '-'
        }
    ], []);

    if (isLoading) {
        return (
            <PageContainer>
                <StateContainer>
                    <FontAwesomeIcon icon={faSpinner} className="spinner" />
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#e2e8f0' }}>데이터 로딩 중</h2>
                    <p>견적 문의 내역을 안전하게 불러오고 있습니다...</p>
                </StateContainer>
            </PageContainer>
        );
    }
    
    if (isError) {
        return (
            <PageContainer>
                <StateContainer>
                    <FontAwesomeIcon icon={faExclamationTriangle} className="error-icon" />
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f87171' }}>데이터 요청 실패</h2>
                    <p>데이터베이스에서 정보를 불러오는 중 문제가 발생했습니다.</p>
                </StateContainer>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            {/* Header */}
            <Header>
                <TitleSection>
                    <Title>
                        <FontAwesomeIcon icon={faFileInvoiceDollar} className="icon-gradient" />
                        견적 문의 현황
                    </Title>
                    <Subtitle>고객 접수 내역을 한눈에 파악하고 관리하는 대시보드입니다.</Subtitle>
                </TitleSection>
            </Header>

            {/* Data Grid */}
            <GridWrapper>
                {/* Note: using ag-theme-quartz-dark specifically for the sleek dark theme */}
                <div className="ag-theme-quartz-dark" style={{ 
                    height: '100%', 
                    width: '100%',
                    '--ag-background-color': '#1e293b', 
                    '--ag-header-background-color': '#0f172a', 
                    '--ag-row-border-color': '#334155', 
                    '--ag-header-foreground-color': '#cbd5e1', 
                    '--ag-foreground-color': '#f1f5f9', 
                    '--ag-row-hover-color': 'rgba(99, 102, 241, 0.1)', 
                    '--ag-selected-row-background-color': 'rgba(99, 102, 241, 0.2)' 
                } as React.CSSProperties}>
                    <AgGridReact
                        rowData={requests}
                        columnDefs={columnDefs}
                        pagination={true}
                        paginationPageSize={20}
                        animateRows={true}
                        rowSelection="single"
                        suppressRowClickSelection={false}
                        tooltipShowDelay={0}
                        rowHeight={56}
                        headerHeight={54}
                        defaultColDef={{
                            sortable: true,
                            filter: true,
                            resizable: true,
                            flex: 1,
                        }}
                    />
                </div>
            </GridWrapper>
        </PageContainer>
    );
};

export default EstimateRequestPage;
