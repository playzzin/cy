import { doc, getDocFromServer, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { rentalQuoteCatalog } from '../data/rentalQuoteCatalog';
import { isDevAdminSessionEnabled } from '../utils/devAdminSession';
import { getErrorCode } from '../utils/firebaseError';
import type { RentalMaterialRate, RentalWorkType } from '../utils/rentalTransactionGenerator';

export interface RentalCatalogEntry extends RentalMaterialRate {
    workType: RentalWorkType;
    quantity: number;
    dailyFeeMissing?: boolean;
}

export interface RentalCatalogSnapshot {
    entries: RentalCatalogEntry[];
    revision: number;
}

const catalogRef = () => doc(db, 'settings', 'rental_transaction_catalog_v1');
const PREVIEW_KEY = 'cy_dev_rental_transaction_catalog_v1';
const invalidCatalog = () => new Error('임대거래자재의 품목·규격·수량·단가 또는 저장 형식을 확인해 주세요.');
const isText = (value: unknown): value is string => typeof value === 'string' && !!value.trim();
const isPrice = (value: unknown): value is number =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isQuantity = (value: unknown): value is number =>
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

function validateEntries(value: unknown): RentalCatalogEntry[] {
    if (!Array.isArray(value)) throw invalidCatalog();
    const ids = new Set<string>();
    return value.map((entry: Partial<RentalCatalogEntry> | null) => {
        if (!entry || !isText(entry.materialId) || ids.has(entry.materialId) ||
            (entry.workType !== 'shoring' && entry.workType !== 'scaffold') ||
            !isText(entry.category) || !isText(entry.itemName) || typeof entry.spec !== 'string' ||
            !isText(entry.unit) || !isQuantity(entry.quantity) || !isQuantity(entry.maxQuantity) ||
            !isPrice(entry.baseFee) || !isPrice(entry.dailyFee) || typeof entry.active !== 'boolean' ||
            (entry.materialKey !== undefined && typeof entry.materialKey !== 'string') ||
            (entry.dailyFeeMissing !== undefined && typeof entry.dailyFeeMissing !== 'boolean') ||
            (entry.dailyFeeMissing && (entry.active || entry.dailyFee !== 0))) throw invalidCatalog();

        ids.add(entry.materialId);
        return {
            materialId: entry.materialId,
            workType: entry.workType,
            category: entry.category.trim(),
            itemName: entry.itemName.trim(),
            spec: entry.spec.trim(),
            unit: entry.unit.trim(),
            quantity: entry.quantity,
            maxQuantity: entry.maxQuantity,
            baseFee: entry.baseFee,
            dailyFee: entry.dailyFee,
            active: entry.active,
            ...(entry.materialKey !== undefined && { materialKey: entry.materialKey }),
            ...(entry.dailyFeeMissing && { dailyFeeMissing: true }),
        };
    });
}

function readStoredCatalog(data: unknown): RentalCatalogSnapshot {
    if (!data || typeof data !== 'object' || !('revision' in data) || !('entries' in data) ||
        !isQuantity(data.revision)) throw invalidCatalog();
    return { revision: data.revision, entries: validateEntries(data.entries) };
}

function initialCatalog(): RentalCatalogSnapshot {
    return { revision: 0, entries: validateEntries(rentalQuoteCatalog) };
}

function readPreviewCatalog(): RentalCatalogSnapshot {
    const saved = localStorage.getItem(PREVIEW_KEY);
    return saved === null ? initialCatalog() : readStoredCatalog(JSON.parse(saved));
}

function nextRevision(currentRevision: number, expectedRevision: number): number {
    if (currentRevision !== expectedRevision) {
        throw new Error('다른 화면에서 임대거래자재를 변경했습니다. 최신 설정을 다시 불러와 주세요.');
    }
    return currentRevision + 1;
}

function checkPermission(error: unknown, message: string): never {
    if (getErrorCode(error).endsWith('permission-denied')) throw new Error(message);
    throw error;
}

export async function loadRentalCatalog(): Promise<RentalCatalogSnapshot> {
    if (isDevAdminSessionEnabled()) return readPreviewCatalog();
    try {
        const saved = await getDocFromServer(catalogRef());
        return saved.exists() ? readStoredCatalog(saved.data()) : initialCatalog();
    } catch (error) {
        return checkPermission(error, '임대거래자재를 불러올 권한이 없습니다. 로그인 상태를 확인해 주세요.');
    }
}

export async function saveRentalCatalog(
    entries: RentalCatalogEntry[],
    expectedRevision: number
): Promise<RentalCatalogSnapshot> {
    const validated = validateEntries(entries);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw invalidCatalog();
    if (isDevAdminSessionEnabled()) {
        if (!navigator.locks) throw new Error('이 브라우저에서는 개발 미리보기의 동시 저장을 지원하지 않습니다.');
        return navigator.locks.request(PREVIEW_KEY, () => {
            const revision = nextRevision(readPreviewCatalog().revision, expectedRevision);
            const next = { revision, entries: validated };
            localStorage.setItem(PREVIEW_KEY, JSON.stringify(next));
            return next;
        });
    }
    const ref = catalogRef();
    try {
        return await runTransaction(db, async transaction => {
            const saved = await transaction.get(ref);
            const currentRevision = saved.exists() ? readStoredCatalog(saved.data()).revision : 0;
            const next = { revision: nextRevision(currentRevision, expectedRevision), entries: validated };
            transaction.set(ref, { ...next, updatedAt: serverTimestamp() });
            return next;
        });
    } catch (error) {
        return checkPermission(error, '임대거래자재를 저장할 권한이 없습니다. 관리자 계정으로 로그인해 주세요.');
    }
}
