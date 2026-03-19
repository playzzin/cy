import styled from 'styled-components';

// --- Premium UI Styled Components ---
export const ToolbarContainer = styled.section`
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 8px;
    padding: 7px;
    border-radius: 14px;
    border: 1px solid #e2e8f0;
    background:
        radial-gradient(circle at top left, rgba(59, 130, 246, 0.12), transparent 26%),
        radial-gradient(circle at bottom right, rgba(14, 165, 233, 0.12), transparent 30%),
        linear-gradient(135deg, #f8fbff 0%, #f8fafc 52%, #ffffff 100%);
    box-shadow: 0 18px 32px -24px rgba(15, 23, 42, 0.22);
    overflow: hidden;

    &::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(120deg, rgba(255, 255, 255, 0.8), transparent 42%);
    }
`;

export const ToolbarLead = styled.div`
    position: relative;
    z-index: 1;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
`;

export const ToolbarLeadMeta = styled.div`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    flex-wrap: wrap;
`;

export const ToolbarBadge = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 24px;
    padding: 0 9px;
    border-radius: 999px;
    border: 1px solid #dbe4f0;
    background: rgba(255, 255, 255, 0.96);
    font-size: 11px;
    font-weight: 700;
    color: #334155;
    backdrop-filter: blur(8px);
`;

export const ToolbarGrid = styled.div`
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 10px;
    width: 100%;

    @media (max-width: 1280px) {
        grid-template-columns: repeat(12, minmax(0, 1fr));
    }

    @media (max-width: 768px) {
        grid-template-columns: 1fr;
    }
`;

export const ToolbarCard = styled.section<{ $span?: number }>`
    position: relative;
    grid-column: span ${props => props.$span ?? 6};
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-height: 100%;
    padding: 10px;
    border-radius: 9px;
    border: 1px solid #e2e8f0;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.96) 100%);
    box-shadow: 0 14px 30px -24px rgba(15, 23, 42, 0.2);
    backdrop-filter: blur(14px);

    @media (max-width: 1280px) {
        grid-column: span 12;
    }

    @media (max-width: 768px) {
        grid-column: span 1;
    }
`;

export const ToolbarCardHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 6px;
`;

export const ToolbarCardTitle = styled.h3`
    margin: 0;
    font-size: 12px;
    font-weight: 800;
    color: #0f172a;
`;

export const ToolbarCardBody = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

export const ToolbarInline = styled.div`
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
`;

export const YearNavigator = styled.div`
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px;
    border-radius: 10px;
    background: #f8fafc;
    border: 1px solid #dbe4f0;
`;

export const YearButton = styled.button`
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: #475569;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;

    &:hover {
        background: #ffffff;
        color: #0f172a;
        transform: translateY(-1px);
    }
`;

export const YearText = styled.span`
    min-width: 44px;
    padding: 0 4px;
    text-align: center;
    font-size: 11px;
    font-weight: 800;
    color: #0f172a;
`;

export const MonthGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(12, minmax(30px, 1fr));
    gap: 3px;
    width: 100%;
`;

export const MonthButton = styled.button<{ $active: boolean; $inRange: boolean }>`
    height: 20px;
    border: 1px solid ${props => (props.$active ? 'transparent' : props.$inRange ? '#bfdbfe' : '#e2e8f0')};
    border-radius: 6px;
    font-size: 9px;
    font-weight: 700;
    color: ${props => (props.$active ? '#ffffff' : props.$inRange ? '#1e3a8a' : '#64748b')};
    background: ${props => (props.$active
        ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
        : props.$inRange
            ? '#eff6ff'
            : '#ffffff')};
    box-shadow: ${props => (props.$active ? '0 12px 24px -16px rgba(37, 99, 235, 0.7)' : 'none')};
    cursor: pointer;
    transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease, color 0.2s ease;

    &:hover {
        transform: translateY(-1px);
        border-color: #93c5fd;
    }
`;

export const QuickRangeGroup = styled.div`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px;
    border-radius: 9px;
    background: #fff7ed;
    border: 1px solid rgba(251, 191, 36, 0.36);
`;

export const QuickRangeButton = styled.button`
    min-height: 22px;
    padding: 0 8px;
    border: none;
    border-radius: 7px;
    background: transparent;
    font-size: 10px;
    font-weight: 800;
    color: #9a3412;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease;

    &:hover {
        background: rgba(255, 255, 255, 0.88);
        color: #7c2d12;
    }
`;

export const SegmentedGroup = styled.div`
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 3px;
    border-radius: 10px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    flex-wrap: wrap;
`;

export const SegmentedButton = styled.button<{ $active: boolean }>`
    min-height: 26px;
    padding: 0 10px;
    border: 1px solid transparent;
    border-radius: 7px;
    background: ${props => (props.$active ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : 'transparent')};
    color: ${props => (props.$active ? '#ffffff' : '#64748b')};
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;

    &:hover {
        transform: translateY(-1px);
        color: ${props => (props.$active ? '#ffffff' : '#0f172a')};
    }
`;

export const SelectField = styled.select`
    min-width: 120px;
    min-height: 30px;
    padding: 0 8px;
    border-radius: 8px;
    border: 1px solid #dbe3ee;
    background: rgba(255, 255, 255, 0.95);
    color: #0f172a;
    font-size: 14px;
    font-weight: 700;
    outline: none;
    cursor: pointer;
`;

export const SearchField = styled.input`
    min-width: 100px;
    min-height: 30px;
    padding: 0 8px;
    border-radius: 8px;
    border: 1px solid #dbe3ee;
    background: rgba(255, 255, 255, 0.95);
    color: #0f172a;
    font-size: 14px;
    font-weight: 600;
    outline: none;

    &::placeholder {
        color: #94a3b8;
    }
`;

export const FieldCard = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 7px;
    border-radius: 9px;
    border: 1px solid rgba(226, 232, 240, 0.95);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.94) 100%);
`;

export const FieldLabel = styled.span`
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: #94a3b8;
`;

export const ToggleChipGroup = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
`;

export const ToggleChipButton = styled.button<{ $active: boolean }>`
    min-height: 26px;
    padding: 0 8px;
    border-radius: 999px;
    border: 1px solid ${props => (props.$active ? 'rgba(37, 99, 235, 0.3)' : 'rgba(203, 213, 225, 0.95)')};
    background: ${props => (props.$active ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.92)')};
    color: ${props => (props.$active ? '#1d4ed8' : '#475569')};
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
        transform: translateY(-1px);
    }
`;

export const ActionCluster = styled.div`
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
`;

export const ActionButton = styled.button<{ $variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'accent' | 'outline' }>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-height: 30px;
    padding: 0 10px;
    border-radius: 8px;
    border: 1px solid transparent;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease;

    ${props => props.$variant === 'primary' && `
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        color: white;
        box-shadow: 0 16px 30px -22px rgba(37, 99, 235, 0.6);
    `}
    ${props => props.$variant === 'secondary' && `
        background: linear-gradient(135deg, #334155 0%, #475569 100%);
        color: white;
        box-shadow: 0 16px 28px -22px rgba(15, 23, 42, 0.7);
    `}
    ${props => props.$variant === 'danger' && `
        background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
        color: white;
    `}
    ${props => props.$variant === 'success' && `
        background: linear-gradient(135deg, #059669 0%, #047857 100%);
        color: white;
        box-shadow: 0 16px 30px -22px rgba(5, 150, 105, 0.7);
    `}
    ${props => props.$variant === 'warning' && `
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        color: white;
        box-shadow: 0 16px 30px -22px rgba(245, 158, 11, 0.72);
    `}
    ${props => props.$variant === 'accent' && `
        background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
        color: white;
        box-shadow: 0 16px 30px -22px rgba(249, 115, 22, 0.72);
    `}
    ${props => props.$variant === 'outline' && `
        background: rgba(255, 255, 255, 0.96);
        border-color: rgba(203, 213, 225, 0.95);
        color: #334155;
    `}

    &:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 16px 36px -24px rgba(15, 23, 42, 0.35);
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        box-shadow: none;
    }
`;



export const KBPreviewControlsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;

    @media (max-width: 960px) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 640px) {
        grid-template-columns: repeat(1, minmax(0, 1fr));
    }
`;

export const KBPreviewFieldCard = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    border-radius: 20px;
    border: 1px solid rgba(51, 65, 85, 0.86);
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.96) 0%, rgba(30, 41, 59, 0.92) 100%);
`;

export const KBPreviewFieldLabel = styled.label`
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #64748b;
`;

export const KBPreviewFieldHint = styled.span`
    font-size: 12px;
    line-height: 1.45;
    color: #94a3b8;
`;

export const KBPreviewInput = styled.input`
    width: 100%;
    min-height: 46px;
    padding: 0 14px;
    border-radius: 14px;
    border: 1px solid rgba(71, 85, 105, 0.88);
    background: rgba(2, 6, 23, 0.72);
    color: #f8fafc;
    font-size: 14px;
    font-weight: 700;
    outline: none;

    &::placeholder {
        color: #64748b;
    }
`;

export const KBPreviewSelect = styled.select`
    width: 100%;
    min-height: 46px;
    padding: 0 14px;
    border-radius: 14px;
    border: 1px solid rgba(71, 85, 105, 0.88);
    background: rgba(2, 6, 23, 0.72);
    color: #f8fafc;
    font-size: 14px;
    font-weight: 700;
    outline: none;
`;

export const KBPreviewTableArea = styled.div`
    flex: 1;
    overflow: auto;
    padding: 20px 22px;
    background: rgba(15, 23, 42, 0.78);
`;

export const KBPreviewTable = styled.table`
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    color: #e2e8f0;
`;

export const KBPreviewFooter = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    padding: 18px 22px 22px;
    border-top: 1px solid rgba(71, 85, 105, 0.42);
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.96) 0%, rgba(2, 6, 23, 0.96) 100%);
`;

export const KBPreviewSummary = styled.span`
    font-size: 14px;
    color: #cbd5e1;
`;

export const TableContainer = styled.div`
    width: 100%;
    overflow-x: auto;
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    margin-bottom: 2rem;
`;

export const StyledTable = styled.table`
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
    text-align: left;
`;

export const Th = styled.th`
    background-color: #f8fafc;
    padding: 0.75rem 1rem;
    font-weight: 600;
    color: #475569;
    border-bottom: 2px solid #e2e8f0;
    white-space: nowrap;
`;

export const Td = styled.td`
    padding: 0.75rem 1rem;
    color: #1e293b;
    border-bottom: 1px solid #e2e8f0;
`;

export const TableRow = styled.tr<{ $isEven?: boolean }>`
    background-color: ${props => props.$isEven ? '#f8fafc' : 'white'};
    &:hover {
        background-color: #f1f5f9;
    }
`;

export const SwitchWrapper = styled.label<{ $checked: boolean }>`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-width: 132px;
    padding: 8px 10px;
    border-radius: 12px;
    border: 1px solid ${props => (props.$checked ? 'rgba(37, 99, 235, 0.24)' : 'rgba(226, 232, 240, 0.95)')};
    background: ${props => (props.$checked
        ? 'linear-gradient(135deg, rgba(219, 234, 254, 0.96) 0%, rgba(239, 246, 255, 0.94) 100%)'
        : 'rgba(255, 255, 255, 0.96)')};
    box-shadow: ${props => (props.$checked ? '0 18px 34px -28px rgba(37, 99, 235, 0.32)' : 'none')};
    cursor: pointer;
    user-select: none;
    transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;

    &:hover {
        transform: translateY(-1px);
    }
`;

export const SwitchTextGroup = styled.span`
    display: flex;
    flex-direction: column;
    gap: 2px;
`;

export const SwitchInput = styled.input`
    position: absolute;
    opacity: 0;
    pointer-events: none;
`;

export const SwitchLabel = styled.span`
    font-size: 12px;
    font-weight: 800;
    color: #0f172a;
`;

export const SwitchState = styled.span<{ $checked: boolean }>`
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${props => (props.$checked ? '#2563eb' : '#94a3b8')};
`;

export const Slider = styled.span<{ $checked: boolean }>`
    position: relative;
    display: inline-flex;
    align-items: center;
    width: 38px;
    height: 22px;
    flex-shrink: 0;
    border-radius: 999px;
    background: ${props => (props.$checked ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : '#cbd5e1')};
    transition: background 0.2s ease;

    &::before {
        content: '';
        position: absolute;
        top: 3px;
        left: ${props => (props.$checked ? '19px' : '3px')};
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: white;
        box-shadow: 0 4px 10px rgba(15, 23, 42, 0.18);
        transition: left 0.2s ease;
    }
`;

export const KBPreviewOverlay = styled.div`
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(2, 6, 23, 0.68);
    backdrop-filter: blur(8px);
`;

export const KBPreviewDialog = styled.div`
    width: 100%;
    max-width: 1180px;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 28px;
    border: 1px solid rgba(71, 85, 105, 0.68);
    background: linear-gradient(180deg, #020617 0%, #111827 100%);
    box-shadow: 0 36px 80px -34px rgba(2, 6, 23, 0.92);
`;

export const KBPreviewHeader = styled.div`
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 22px;
    border-bottom: 1px solid rgba(71, 85, 105, 0.42);
    background:
        radial-gradient(circle at top right, rgba(245, 158, 11, 0.16), transparent 24%),
        linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(17, 24, 39, 0.94) 100%);
`;

export const KBPreviewTitleRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
`;

export const KBPreviewTitleBlock = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

export const KBPreviewEyebrow = styled.span`
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #f59e0b;
`;

export const KBPreviewTitle = styled.h3`
    margin: 0;
    font-size: 22px;
    font-weight: 800;
    color: #f8fafc;
`;

export const KBPreviewDescription = styled.p`
    margin: 0;
    font-size: 13px;
    color: #94a3b8;
`;

export const KBPreviewCloseButton = styled.button`
    width: 42px;
    height: 42px;
    border: 1px solid rgba(71, 85, 105, 0.82);
    border-radius: 14px;
    background: rgba(15, 23, 42, 0.92);
    color: #cbd5e1;
    font-size: 24px;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;

    &:hover {
        background: rgba(30, 41, 59, 0.96);
        color: #ffffff;
    }
`;
