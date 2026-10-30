export interface MenuItem {
    text: string;
    icon?: string;
    path?: string;
    action?: string;
    sub?: (string | MenuItem)[];
    id?: string;
    roles?: string[]; // Added for dynamic role handling
    iconColor?: string; // Custom icon color
    activeColor?: string; // Background/Text color when active
    hoverColor?: string; // Color for hover/active state
    hide?: boolean;
    dividerTitle?: string;
    dividerStyle?: 'solid' | 'dashed';
    dividerSpacing?: 'compact' | 'normal' | 'relaxed';
}

export interface SiteData {
    name: string;
    icon: string;
    menu: MenuItem[];
    order?: number;
    trash?: MenuItem[];
    headerActions?: MenuItem[];
    /** 선택한 사이트·직책의 좌측 메뉴 검색창 표시 여부 (기본: 꺼짐) */
    sidebarSearchEnabled?: boolean;
    /** DEV 좌측 메뉴 아래에 직책별 원본 메뉴 연결 (기본: 켜짐) */
    linkedPositionMenusEnabled?: boolean;
    /** DEV 고유 메뉴와 연결된 직책 메뉴 사이의 구분선 설정 */
    linkedPositionDivider?: Pick<MenuItem, 'dividerTitle' | 'dividerStyle' | 'dividerSpacing' | 'hide'>;
    deletedItems?: string[];
    /** 시스템 페이지 원본 경로별 사용자 지정 표시명 */
    systemPageLabels?: Record<string, string>;
    positionConfig?: PositionItem[];
    delegationTemplatePath?: string;
}

export interface PositionItem {
    id: string;
    name: string;
    icon: string;
    color: string;
    order?: number;
}

export interface SiteDataType {
    [key: string]: SiteData;
}
