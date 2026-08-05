import { Timestamp } from 'firebase/firestore';
import { DEFAULT_MENU_CONFIG } from '../constants/defaultMenu';
import { BUSINESS_PARTNER_DEFAULT_POSITION_ROWS } from '../constants/businessPartnerPositions';
import type { SiteDataType } from '../types/menu';
import { UserRole } from '../types/roles';
import type { UserData } from '../services/userService';
import type { Position } from '../services/positionService';
import type { Worker } from '../services/manpowerService';
import type { OfficeStaff } from '../services/officeStaffService';
import type { SyncUserAccessClaimsResult } from '../services/userAccessClaimsService';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

export const DEV_MENU_STORAGE_KEY = 'cy_dev_menu_config_v11';
let devMenuConfig: SiteDataType | null = null;

const readStoredDevMenuConfig = (): SiteDataType | null => {
  if (typeof window === 'undefined') return null;

  try {
    const stored = window.localStorage.getItem(DEV_MENU_STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === 'object' ? parsed as SiteDataType : null;
  } catch (error) {
    console.warn('[DevAdminFixtures] 저장된 DEV 메뉴를 읽지 못했습니다.', error);
    return null;
  }
};

export const getDevMenuConfig = (): SiteDataType => {
  if (!devMenuConfig) {
    devMenuConfig = clone(readStoredDevMenuConfig() || DEFAULT_MENU_CONFIG);
  }

  return clone(devMenuConfig);
};

export const reloadDevMenuConfigFromStorage = (): SiteDataType => {
  devMenuConfig = clone(readStoredDevMenuConfig() || DEFAULT_MENU_CONFIG);
  return clone(devMenuConfig);
};

export const setDevMenuConfig = (config: SiteDataType): void => {
  const nextConfig = clone(config);

  if (typeof window !== 'undefined') {
    const serialized = JSON.stringify(nextConfig);
    window.localStorage.setItem(DEV_MENU_STORAGE_KEY, serialized);

    // Keep the in-memory preview and the reload source atomic. Previously the
    // preview could change even when localStorage failed (for example quota or
    // browser storage errors), which made a menu appear briefly and vanish on
    // refresh.
    if (window.localStorage.getItem(DEV_MENU_STORAGE_KEY) !== serialized) {
      throw new Error('DEV menu configuration was not persisted to browser storage.');
    }
  }

  devMenuConfig = nextConfig;
};

const initialDevPositions: Position[] = [
  { id: 'dev-pos-admin', name: '사장', rank: 1, color: 'purple', iconKey: 'fa-crown', isDefault: true, systemRole: UserRole.ADMIN },
  { id: 'dev-pos-manager', name: '매니저1', rank: 2, color: 'orange', iconKey: 'fa-user-tie', isDefault: true, systemRole: UserRole.MANAGER },
  { id: 'dev-pos-support', name: '지원담당', rank: 3, color: 'cyan', iconKey: 'fa-hand-holding-dollar', isDefault: true, systemRole: UserRole.MANAGER },
  { id: 'dev-pos-general', name: '일반', rank: 5, color: 'gray', iconKey: 'fa-user', isDefault: true, systemRole: UserRole.GENERAL },
  ...BUSINESS_PARTNER_DEFAULT_POSITION_ROWS.map((position) => ({
    ...position,
    id: `dev-pos-${position.legacyId}`,
  })),
  { id: 'dev-pos-newbie', name: '신규자', rank: 99, color: 'slate', iconKey: 'fa-user-plus', isDefault: true, systemRole: UserRole.GENERAL },
];

export let devPositions: Position[] = clone(initialDevPositions);

export let devUsers: UserData[] = [
  {
    uid: 'dev-admin',
    email: 'dev-admin@localhost',
    displayName: '개발자 관리자',
    photoURL: null,
    lastLogin: Timestamp.now(),
    role: 'admin',
    position: '사장',
    accountType: 'office',
    status: 'active',
    linkedWorkerIds: [],
    linkedOfficeStaffIds: ['dev-office-1'],
    additionalPositions: ['매니저1', '지원담당'],
  },
  {
    uid: 'dev-manager',
    email: 'manager@localhost',
    displayName: '검증 매니저',
    photoURL: null,
    lastLogin: Timestamp.now(),
    role: 'manager',
    position: '매니저1',
    accountType: 'worker',
    status: 'active',
    linkedWorkerIds: ['dev-worker-1'],
    linkedOfficeStaffIds: [],
  },
  {
    uid: 'dev-user',
    email: 'user@localhost',
    displayName: '검증 일반 사용자',
    photoURL: null,
    lastLogin: Timestamp.now(),
    role: 'user',
    position: '일반',
    accountType: 'worker',
    status: 'active',
    linkedWorkerIds: ['dev-worker-2'],
    linkedOfficeStaffIds: [],
  },
];

export let devWorkers: Worker[] = [
  { id: 'dev-worker-1', uid: 'dev-manager', name: '검증 작업자 A', role: '매니저1', teamName: '검증팀' } as Worker,
  { id: 'dev-worker-2', uid: 'dev-user', name: '검증 작업자 B', role: '일반', teamName: '일반팀' } as Worker,
];

export let devOfficeStaff: OfficeStaff[] = [
  { id: 'dev-office-1', uid: 'dev-admin', name: '개발자 관리자', role: '사장', department: '관리부', status: '재직', isActive: true } as OfficeStaff,
];

let devUserPositionMap: Record<string, string[]> = {
  'dev-admin': ['매니저1', '지원담당'],
  'dev-manager': ['지원담당'],
};

const positionListeners = new Set<(map: Record<string, string[]>) => void>();

const emitPositionMap = (): void => {
  const snapshot = getDevUserPositionMap();
  positionListeners.forEach((listener) => listener(snapshot));
};

export const getDevUserPositionMap = (): Record<string, string[]> => clone(devUserPositionMap);

export const subscribeDevUserPositionMap = (listener: (map: Record<string, string[]>) => void): (() => void) => {
  positionListeners.add(listener);
  listener(getDevUserPositionMap());
  return () => {
    positionListeners.delete(listener);
  };
};

export const setDevUserPositions = (uid: string, positions: string[]): void => {
  const filtered = Array.from(new Set(positions.map((position) => String(position || '').trim()).filter(Boolean)));
  if (filtered.length === 0) delete devUserPositionMap[uid];
  else devUserPositionMap[uid] = filtered;
  emitPositionMap();
};

export const addDevUserPosition = (uid: string, position: string): void => {
  setDevUserPositions(uid, [...(devUserPositionMap[uid] || []), position]);
};

export const removeDevUserPosition = (uid: string, position: string): void => {
  setDevUserPositions(uid, (devUserPositionMap[uid] || []).filter((value) => value !== position));
};

export const updateDevUser = (uid: string, updates: Partial<UserData>): void => {
  devUsers = devUsers.map((user) => user.uid === uid ? { ...user, ...updates } : user);
};

export const updateDevWorker = (id: string, updates: Partial<Worker>): void => {
  devWorkers = devWorkers.map((worker) => String(worker.id) === id ? ({ ...worker, ...updates } as Worker) : worker);
};

export const updateDevOfficeStaff = (id: string, updates: Partial<OfficeStaff>): void => {
  devOfficeStaff = devOfficeStaff.map((staff) => String(staff.id) === id ? ({ ...staff, ...updates } as OfficeStaff) : staff);
};

export const updateDevPosition = (id: string, updates: Partial<Position>): void => {
  devPositions = devPositions.map((position) => position.id === id ? { ...position, ...updates } : position);
};

export const addDevPosition = (position: Omit<Position, 'id'>): string => {
  const id = `dev-pos-${Date.now()}`;
  devPositions = [...devPositions, { ...position, id }];
  return id;
};

export const deleteDevPosition = (id: string): void => {
  devPositions = devPositions.filter((position) => String(position.id) !== String(id));
};

export const updateDevPositionRanks = (rankUpdates: Array<{ id: string; rank: number }>): void => {
  const rankById = new Map(rankUpdates.map((item) => [String(item.id), item.rank]));
  devPositions = devPositions
    .map((position) => {
      const rank = position.id ? rankById.get(String(position.id)) : undefined;
      return rank == null ? position : { ...position, rank };
    })
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
};

export const restoreDevPositions = (): void => {
  devPositions = clone(initialDevPositions);
};

export const buildDevClaimSyncResult = (uid: string): SyncUserAccessClaimsResult => {
  const user = devUsers.find((row) => row.uid === uid);
  const additionalPositions = devUserPositionMap[uid] || [];
  const position = String(user?.position || '일반');
  const role = String(user?.role || 'user');
  const roles = Array.from(new Set([role, position, ...additionalPositions, 'user'].filter(Boolean)));

  return {
    uid,
    role,
    position,
    systemRole: position === '사장' ? '관리자' : position.startsWith('매니저') ? '매니저' : '일반',
    accountType: String(user?.accountType || 'office'),
    additionalPositions,
    roles,
    erpRoleGroups: position === '사장' ? ['admin'] : ['site', 'user'],
    syncedAt: new Date().toISOString(),
  };
};
