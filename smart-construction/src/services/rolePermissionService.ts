import { db } from '../config/firebase';
import { doc, setDoc, onSnapshot, collection } from 'firebase/firestore';
import { UserRole, PermissionConfig, DEFAULT_PERMISSIONS } from '../types/roles';
import { Position } from './positionService';

const PERMISSION_COLLECTION = 'system_config';
const PERMISSION_DOC_ID = 'permissions';
const POSITION_COLLECTION = 'positions';

class RolePermissionService {
    private permissions: PermissionConfig = DEFAULT_PERMISSIONS;
    private roleMap: Map<string, UserRole> = new Map(); // Maps "Job Title" -> "UserRole"
    private listeners: ((permissions: PermissionConfig) => void)[] = [];

    constructor() {
        this.initialize();
    }

    private initialize() {
        // 1. Listen for Permission Config changes
        onSnapshot(doc(db, PERMISSION_COLLECTION, PERMISSION_DOC_ID), (docSnap) => {
            if (docSnap.exists()) {
                this.permissions = docSnap.data() as PermissionConfig;
                this.notifyListeners();
            } else {
                // If doc doesn't exist, create it with defaults
                this.savePermissions(DEFAULT_PERMISSIONS);
            }
        });

        // 2. Listen for Position changes to build dynamic RoleMap
        onSnapshot(collection(db, POSITION_COLLECTION), (snapshot) => {
            const newRoleMap = new Map<string, UserRole>();

            snapshot.docs.forEach(doc => {
                const data = doc.data() as Position;
                // Ensure we map the name to the systemRole
                if (data.name && data.systemRole) {
                    newRoleMap.set(data.name, data.systemRole);
                }
            });

            this.roleMap = newRoleMap;
            // Also notify listeners because access might have changed effectively
            this.notifyListeners();
        });
    }

    public async updatePermission(role: UserRole, menuId: string, allowed: boolean): Promise<void> {
        const newPermissions = { ...this.permissions };
        if (!newPermissions[role]) {
            newPermissions[role] = {};
        }
        newPermissions[role][menuId] = allowed;

        await this.savePermissions(newPermissions);
    }

    private async savePermissions(permissions: PermissionConfig): Promise<void> {
        await setDoc(doc(db, PERMISSION_COLLECTION, PERMISSION_DOC_ID), permissions);
        this.permissions = permissions;
    }

    /**
     * Determines the System Role (Admin/Manager/General) based on the user's Job Title.
     */
    public getSystemRole(jobTitle: string): UserRole {
        // 1. Check if the jobTitle is already a System Role (e.g. "ADMIN")
        if (Object.values(UserRole).includes(jobTitle as UserRole)) {
            return jobTitle as UserRole;
        }

        // 2. Lookup in dynamic map (from Firestore positions)
        if (this.roleMap.has(jobTitle)) {
            return this.roleMap.get(jobTitle)!;
        }

        // 3. Fallback for legacy hardcoded roles (safeguard)
        switch (jobTitle) {
            case '관리자':
            case 'admin':
            case '사장': // Legacy support
            case '실장': // Legacy support
                return UserRole.ADMIN;
            case '메니저':
            case '메니저 1':
            case '메니저 2':
            case '메니저 3':
            case 'manager':
                return UserRole.MANAGER;
            case '대표': // Now General
            case '팀장':
            case '반장':
            case '일반':
            case '신규':
                return UserRole.GENERAL;
            default:
                return UserRole.GENERAL;
        }
    }

    public hasAccess(userJobTitle: string | undefined, menuId: string): boolean {
        if (!userJobTitle) return false;

        // Map legacy/custom job title to System Role
        const systemRole = this.getSystemRole(userJobTitle);

        // Check if role exists in config
        const roleConfig = this.permissions[systemRole];
        if (!roleConfig) {
            // Fallback to default if not found in live config
            const defaultConfig = DEFAULT_PERMISSIONS[systemRole];
            return defaultConfig ? defaultConfig[menuId] : false;
        }

        return !!roleConfig[menuId];
    }

    public async getPermissions(): Promise<PermissionConfig> {
        return this.permissions;
    }

    public subscribe(listener: (permissions: PermissionConfig) => void): () => void {
        this.listeners.push(listener);
        listener(this.permissions); // Initial call

        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notifyListeners() {
        this.listeners.forEach(listener => listener(this.permissions));
    }
}

export const rolePermissionService = new RolePermissionService();
