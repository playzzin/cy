export interface MenuItem {
    text: string;
    icon?: string;
    path?: string;
    sub?: (string | MenuItem)[];
    id?: string;
    roles?: string[]; // Added for dynamic role handling
    iconColor?: string; // Custom icon color
    activeColor?: string; // Background/Text color when active
    hoverColor?: string; // Color for hover/active state
    hide?: boolean;
}

export interface SiteData {
    name: string;
    icon: string;
    menu: MenuItem[];
    order?: number; // Added for customized site ordering
    trash?: MenuItem[]; // Deleted items storage
    deletedItems?: string[]; // Names of deleted default items (to prevent zombie items on merge)
    positionConfig?: PositionItem[]; // Dynamic Position Configuration
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
