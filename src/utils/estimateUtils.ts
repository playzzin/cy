import { EstimateItem } from '../services/estimateService';

export const EXCEL_FONT = "'Inter', 'Pretendard', '맑은 고딕', 'Malgun Gothic', dotum, sans-serif";
export const BORDER_COLOR = '#e2e8f0';
export const BORDER_THICK = `1.5px solid ${BORDER_COLOR}`;
export const BORDER_THIN = `1px solid ${BORDER_COLOR}`;
export const BG_LABEL = '#f8fafc';
export const LOGO_FALLBACK = "https://firebasestorage.googleapis.com/v0/b/cyee-9c1e4.firebasestorage.app/o/%EC%B2%AD%EC%97%B0%EA%B8%B4%EB%A1%9C%EA%B3%A0.png?alt=media&token=fca01385-1946-4b6c-8d98-776945928bc5";

export const COMMON_CATEGORIES = ['시스템 동바리', '시스템 비계', '시스템 비계 (발판포함)', '선택 항목', '기타'];
export const COMMON_SECTIONS = ['설치/해체 (m3)', '설치/해체 (m2)', '추가 설치 (m3)', '추가 설치 (m2)', '망 설치 (m2)', '운반비'];
export const COMMON_UNITS = ['㎡', '㎥'];

export type DocumentType = 'estimate' | 'transaction';
export type EstimateStatus = 'draft' | 'sent' | 'approved' | 'rejected';

export type EstimateDraft = {
    id?: string;
    documentType: DocumentType;
    estimateNo: string;
    title: string;
    projectName: string;
    clientName: string;
    clientCompany: string;
    clientContact: string;
    status: EstimateStatus;
    issueDate: string;
    validUntilDate: string;
    items: EstimateItem[];
    discount: number;
    vatRate: number;
    includeVat: boolean;
    paymentTerms: string;
    scopeNotes: string;
    notes: string;
    installRatio: number;
    estimateMode: 'standard' | 'rental';
    supplierName: string;
    supplierCompany: string;
    supplierContact: string;
    supplierAddress: string;
    supplierBizNo: string;
    supplierAccount: string;
    supplierFax: string;
    supplierManager: string;
    supplierManagerContact: string;
};

export const DEFAULT_SCOPE_NOTES = `- V.A.T 별도 (세금 계산서 처리시)
- 결제 조건 : 정기 결제
- 별도 협의 없으면 설치(50%), 해체(50%) 분할청구
- 도면변경이나 설치방법 변경에 따라 체적, 견적 금액은 변동될 수 있음. 실물량 정산.
- 직영품은 1인당 27만원 (식대, 경비 포함)
- 설치, 해체시 상하차 및 인양 장비 현장 지원 (지게차, 크레인, 사다리차)
- 정리 반출시, 반생, 랩 등 포함 견적
- 외부비계는 발판 W=500 1열 조건
- 하부 성토구간 보강은 합판 현장지원. (300 * 300 재단 후 지급조건)
- 후리도매 자재, 파이프 및 클램프 현장지원.
- 물량 산출방식 : 길이(벽체에서 900mm 이격) * 높이(기초+난간 1200mm 포함) = m2 기준견적.
- 시스템 동바리 해체시 바닥 정리 및 정리공간 확보 후 해체
- 거푸집 선 해체 후 시스템 동바리 해체 조건
- 설치불가 구간 현장조치 (파이프비계 설치) : 물량 제외, 추후 정산.
- 건설산업기본법 제29조 4항 관련 시행규칙 제26조의 6에 의거하여 전문시공팀 현장소개하여 별도계약조건`;

export const createItem = (input: Partial<EstimateItem> = {}): EstimateItem => ({
    id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    category: input.category || '',
    section: input.section || '',
    label: input.label || input.section || '',
    unit: input.unit || '',
    quantity: input.quantity || 0,
    finalUnitPrice: input.finalUnitPrice || 0,
    unitPrice: input.finalUnitPrice || 0,
    laborUnitPrice: input.laborUnitPrice || input.finalUnitPrice || 0,
    rentalUnitPrice: input.rentalUnitPrice || 0,
    period: input.period || 1,
    amount: (input.quantity || 0) * (input.finalUnitPrice || 0),
    install50: 0,
    remove50: 0,
    note: input.note || '',
    pointBase: 4000,
    pointMultiplier: 1500,
    itemDate: (input as any).itemDate || new Date().toISOString().split('T')[0],
});

export const getEmptyDraft = (type: DocumentType = 'estimate'): EstimateDraft => ({
    documentType: type,
    estimateNo: `EST-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${String(Date.now()).slice(-4)}`,
    title: type === 'estimate' ? '견 적 서' : '거 래 명 세 표',
    projectName: '', clientName: '', clientCompany: '', clientContact: '',
    status: 'draft', issueDate: new Date().toISOString().split('T')[0], validUntilDate: new Date().toISOString().split('T')[0],
    items: type === 'estimate' ? [
        createItem({ category: '시스템 동바리', section: '' }),
        createItem({ category: '시스템 동바리', section: '' }),
        createItem({ category: '시스템 동바리', section: '' }),
        createItem({ category: '시스템 동바리', section: '' }),
        createItem({ category: '시스템 비계', section: '' }),
        createItem({ category: '시스템 비계', section: '' }),
        createItem({ category: '시스템 비계', section: '' }),
        createItem({ category: '시스템 비계', section: '' })
    ] : [],
    discount: 0, vatRate: 10, includeVat: true,
    paymentTerms: '정기 결제',
    scopeNotes: DEFAULT_SCOPE_NOTES,
    notes: '설치/해체 시공',
    installRatio: 50,
    estimateMode: 'standard',
    supplierName: '', supplierCompany: '', supplierContact: '', supplierAddress: '', supplierBizNo: '', supplierAccount: '', supplierFax: '031-509-7693', supplierManager: '이재욱', supplierManagerContact: '010-2365-7692'
});

export const formatCurrency = (v: number | null | undefined): string => new Intl.NumberFormat('ko-KR').format(Math.round(v || 0));
export const formatDecimal = (v: number | null | undefined): string => (v || 0).toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const numberToKorean = (num: number): string => {
    const target = Math.floor(num);
    if (target === 0) return '영';
    
    const numChar = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
    const unit = ['', '십', '백', '천'];
    const gUnit = ['', '만', '억', '조', '경'];
    
    let result = '';
    let str = String(target);
    let groupIdx = 0;

    while (str.length > 0) {
        const groupStr = str.substring(Math.max(0, str.length - 4));
        str = str.substring(0, Math.max(0, str.length - 4));
        
        let groupResult = '';
        for (let i = 0; i < groupStr.length; i++) {
            const digit = Number(groupStr[i]);
            if (digit > 0) {
                const uIdx = groupStr.length - 1 - i;
                // 십, 백, 천 단위에서 1은 생략 (단, 만/억 단위 그룹의 첫 자리는 관습에 따라 다름)
                // 여기서는 일반적인 금융 문서 관습에 따라 '일'을 생략하여 '사백만'처럼 나오게 함.
                const char = (digit === 1 && uIdx > 0) ? '' : numChar[digit];
                groupResult += char + unit[uIdx];
            }
        }
        
        if (groupResult.length > 0) {
            result = groupResult + gUnit[groupIdx] + result;
        }
        groupIdx++;
    }
    return result;
};

export const PRINT_STYLES = `
    @media print {
        header, nav, #sidebar, .print\\:hidden, button, .sidebar-pc-toggle-btn { 
            display: none !important; 
        }
        body, html { 
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
        }
        main { 
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
        }
        .flex-1 { overflow: visible !important; }
        .no-print { display: none !important; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
`;

export const cellStyle = (overrides: React.CSSProperties = {}): React.CSSProperties => ({
    border: BORDER_THIN,
    padding: 'calc(8px + var(--estimate-table-padding-offset, 0px)) calc(10px + var(--estimate-table-padding-offset, 0px))',
    fontFamily: EXCEL_FONT,
    fontSize: 'calc(9.5pt + var(--estimate-font-size-offset, 0pt))',
    verticalAlign: 'middle',
    textAlign: 'center',
    backgroundColor: '#fff',
    color: '#334155',
    ...overrides
});

export const labelCellStyle = (overrides: React.CSSProperties = {}): React.CSSProperties => ({
    ...cellStyle({
        backgroundColor: BG_LABEL,
        fontWeight: 600,
        color: '#475569',
        textAlign: 'center'
    }),
    ...overrides
});

export const tableWrapperStyle: React.CSSProperties = {
    borderRadius: '10px',
    border: BORDER_THIN,
    overflow: 'hidden',
    marginBottom: '12px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
};
