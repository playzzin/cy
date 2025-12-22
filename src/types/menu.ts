export interface MenuItem {
    text: string;
    icon?: string;
    path?: string;
    sub?: (string | MenuItem)[];
    id?: string;
    roles?: string[]; // Added for dynamic role handling
    hoverColor?: string; // Color for hover/active state
}

export interface SiteData {
    name: string;
    icon: string;
    menu: MenuItem[];
    trash?: MenuItem[]; // Deleted items storage
    deletedItems?: string[]; // Names of deleted default items (to prevent zombie items on merge)
}

export interface SiteDataType {
    [key: string]: SiteData;
}
