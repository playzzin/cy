import { db } from '../config/firebase';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    orderBy,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';

import { UserRole } from '../types/roles';

export interface Position {
    id?: string;
    name: string;       // 직책명 (예: 안전관리자)
    rank: number;       // 서열 (낮을수록 높음, 예: 1=사장, 99=신규자)
    color: string;      // UI 표시 색상 (red, blue, green, etc.)
    icon?: string;      // 아이콘 이름 (FontAwesome 아이콘명)
    iconKey?: string;
    description?: string; // 설명
    isDefault?: boolean; // 시스템 기본 직책 여부 (삭제 불가)
    systemRole: UserRole; // 시스템 권한 매핑 (관리자/매니저/일반)
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

const COLLECTION_NAME = 'positions';

// 기본 직책 데이터
const DEFAULT_POSITIONS: Omit<Position, 'id'>[] = [
    { name: '사장', rank: 1, color: 'purple', icon: 'faCrown', iconKey: 'fa-crown', description: '업체 대표', isDefault: true, systemRole: UserRole.GENERAL },
    { name: '매니저1', rank: 2, color: 'orange', icon: 'faUserTie', iconKey: 'fa-user-tie', description: '총괄 매니저', isDefault: true, systemRole: UserRole.MANAGER },
    { name: '매니저2', rank: 2.1, color: 'orange', icon: 'faUserTie', iconKey: 'fa-user-tie', description: '구역 매니저', isDefault: true, systemRole: UserRole.MANAGER },
    { name: '매니저3', rank: 2.2, color: 'yellow', icon: 'faUserTie', iconKey: 'fa-user-tie', description: '지원 매니저', isDefault: true, systemRole: UserRole.MANAGER },
    { name: '팀장', rank: 3, color: 'blue', icon: 'faUserShield', iconKey: 'fa-user-shield', description: '시공 팀장', isDefault: true, systemRole: UserRole.GENERAL },
    { name: '반장', rank: 4, color: 'green', icon: 'faHardHat', iconKey: 'fa-hard-hat', description: '현장 반장', isDefault: true, systemRole: UserRole.GENERAL },
    { name: '일반', rank: 5, color: 'gray', icon: 'faUser', iconKey: 'fa-user', description: '일반 작업자', isDefault: true, systemRole: UserRole.GENERAL },
    { name: '신규자', rank: 99, color: 'slate', icon: 'faUserPlus', iconKey: 'fa-user-plus', description: '신규 가입자', isDefault: true, systemRole: UserRole.GENERAL },
];

const normalizeIconKey = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed.includes('-')) return trimmed;
    if (!trimmed.startsWith('fa')) return trimmed;
    const withoutFa = trimmed.slice(2);
    if (!withoutFa) return '';
    const kebab = withoutFa.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    return `fa${kebab}`;
};

export const positionService = {
    // 모든 직책 조회 (서열순 정렬)
    getPositions: async (): Promise<Position[]> => {
        try {
            const q = query(collection(db, COLLECTION_NAME), orderBy('rank', 'asc'));
            const snapshot = await getDocs(q);

            // 데이터가 없으면 초기화
            if (snapshot.empty) {
                await positionService.initializeDefaults();
                return await positionService.getPositions(); // 재조회
            }

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Position));
        } catch (error) {
            console.error("Error fetching positions:", error);
            return [];
        }
    },

    // 직책 추가
    addPosition: async (position: Omit<Position, 'id'>): Promise<string> => {
        try {
            const normalizedPosition: Omit<Position, 'id'> = { ...position };
            const derivedIconKey = normalizeIconKey(normalizedPosition.iconKey) || normalizeIconKey(normalizedPosition.icon);
            normalizedPosition.iconKey = derivedIconKey;

            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                ...normalizedPosition,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            console.error("Error adding position:", error);
            throw error;
        }
    },

    // 직책 수정
    updatePosition: async (id: string, updates: Partial<Position>): Promise<void> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            const normalizedUpdates: Partial<Position> = { ...updates };
            const hasIconKeyUpdate = Object.prototype.hasOwnProperty.call(normalizedUpdates, 'iconKey');
            if (hasIconKeyUpdate) {
                normalizedUpdates.iconKey = normalizeIconKey(normalizedUpdates.iconKey);
            }
            if (!normalizedUpdates.iconKey) {
                const derived = normalizeIconKey(normalizedUpdates.icon);
                if (derived) normalizedUpdates.iconKey = derived;
            }
            await updateDoc(docRef, {
                ...normalizedUpdates,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error updating position:", error);
            throw error;
        }
    },

    // 직책 삭제
    deletePosition: async (id: string): Promise<void> => {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
        } catch (error) {
            console.error("Error deleting position:", error);
            throw error;
        }
    },

    // 기본 직책 초기화
    initializeDefaults: async (): Promise<void> => {
        try {
            const batchPromises = DEFAULT_POSITIONS.map(pos =>
                addDoc(collection(db, COLLECTION_NAME), {
                    ...pos,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                })
            );
            await Promise.all(batchPromises);
            console.log("Default positions initialized");
        } catch (error) {
            console.error("Error initializing default positions:", error);
        }
    },

    // 중복 직책 제거 (이름 기준으로 가장 오래된 것만 유지)
    removeDuplicates: async (): Promise<{ removed: number; kept: string[] }> => {
        try {
            const snapshot = await getDocs(collection(db, COLLECTION_NAME));
            const positions = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
            } as Position));

            // 이름별로 그룹화
            const grouped: Record<string, Position[]> = {};
            positions.forEach(pos => {
                const key = pos.name;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(pos);
            });

            let removedCount = 0;
            const keptNames: string[] = [];

            // 각 그룹에서 첫 번째(가장 오래된 것)만 유지하고 나머지 삭제
            for (const [name, positionsGroup] of Object.entries(grouped)) {
                keptNames.push(name);
                if (positionsGroup.length > 1) {
                    // 첫 번째 제외하고 삭제
                    const toDelete = positionsGroup.slice(1);
                    for (const pos of toDelete) {
                        if (pos.id) {
                            await deleteDoc(doc(db, COLLECTION_NAME, pos.id));
                            removedCount++;
                        }
                    }
                }
            }

            console.log(`Removed ${removedCount} duplicate positions`);
            return { removed: removedCount, kept: keptNames };
        } catch (error) {
            console.error("Error removing duplicates:", error);
            throw error;
        }
    },

    // Specific deletion for 'Skilled Worker' request
    deleteSkilledWorker: async (): Promise<void> => {
        try {
            const q = query(collection(db, COLLECTION_NAME));
            const snapshot = await getDocs(q);
            const batch = snapshot.docs.filter(d => d.data().name === '기능공');

            for (const docSnapshot of batch) {
                await deleteDoc(doc(db, COLLECTION_NAME, docSnapshot.id));
                console.log(`Deleted legacy position: ${docSnapshot.id}`);
            }
        } catch (error) {
            console.error("Error deleting Skilled Worker:", error);
        }
    },

    // Force Reset to Defaults (Clear all and re-initialize)
    resetToDefaults: async (): Promise<void> => {
        try {
            const snapshot = await getDocs(collection(db, COLLECTION_NAME));
            const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deletePromises);
            console.log("All existing positions cleared.");
            await positionService.initializeDefaults();
        } catch (error) {
            console.error("Error resetting to defaults:", error);
            throw error;
        }
    }
};
