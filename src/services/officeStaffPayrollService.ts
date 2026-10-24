import { collection, doc, getDocFromServer, getDocsFromServer, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { DEFAULT_INSURANCE_SETTINGS, StoredMonthData, StoredPayrollData } from '../pages/payroll/officeStaffPayrollModel';

export interface SharedPayrollMonth { data: StoredMonthData | null; revision: number }
const COLLECTION = 'office_staff_payroll';
const invalid = () => new Error('급여 저장 자료의 형식이나 금액을 확인해 주세요.');
function record(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
function amount(value: unknown) {
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) throw invalid();
}
function payrollInput(value: unknown) {
    if (!record(value)) throw invalid();
    for (const key of ['baseSalary', 'bonus', 'deduction']) if (value[key] !== undefined) amount(value[key]);
    if (value.payBasis !== undefined && !['gross', 'net'].includes(String(value.payBasis))) throw invalid();
    if (value.insuranceBurdenMode !== undefined && !['shared', 'employer'].includes(String(value.insuranceBurdenMode))) throw invalid();
    if (value.insuranceApplied !== undefined && typeof value.insuranceApplied !== 'boolean') throw invalid();
    for (const key of ['id', 'name', 'memo', 'department', 'role', 'status', 'salaryModel']) {
        if (value[key] !== undefined && typeof value[key] !== 'string') throw invalid();
    }
}
export function validatePayrollMonth(value: unknown, requireSnapshot = false): StoredMonthData {
    if (!record(value)) throw invalid();
    if (value.rowInputs !== undefined) {
        if (!record(value.rowInputs)) throw invalid();
        Object.values(value.rowInputs).forEach(payrollInput);
    }
    for (const key of ['manualRows', 'staffSnapshot']) {
        if (value[key] !== undefined) {
            if (!Array.isArray(value[key])) throw invalid();
            const ids = new Set<string>();
            for (const row of value[key] as unknown[]) {
                payrollInput(row);
                if (!record(row) || typeof row.id !== 'string' || !row.id || typeof row.name !== 'string' || ids.has(row.id)) throw invalid();
                if (key === 'staffSnapshot') {
                    for (const field of ['baseSalary', 'bonus', 'deduction']) amount(row[field]);
                    if (row.source !== 'staff' || typeof row.insuranceApplied !== 'boolean' || !['gross', 'net'].includes(String(row.payBasis))) throw invalid();
                }
                ids.add(row.id);
            }
        }
    }
    if (value.settings !== undefined) {
        if (!record(value.settings)) throw invalid();
        for (const [key, setting] of Object.entries(value.settings)) {
            const baseline = DEFAULT_INSURANCE_SETTINGS[key as keyof typeof DEFAULT_INSURANCE_SETTINGS];
            if (typeof baseline === 'boolean') { if (typeof setting !== 'boolean') throw invalid(); }
            else {
                amount(setting);
                if ((setting as number) < 0 || (!key.endsWith('Base') && (setting as number) > 100)) throw invalid();
            }
        }
    }
    if (requireSnapshot || value.grossPaySnapshot !== undefined) {
        if (!Array.isArray(value.grossPaySnapshot)) throw invalid();
        const ids = new Set<string>();
        for (const row of value.grossPaySnapshot) {
            payrollInput(row);
            if (!record(row) || typeof row.id !== 'string' || !row.id || typeof row.name !== 'string' || ids.has(row.id)) throw invalid();
            ids.add(row.id);
            amount(row.grossPay); amount(row.baseSalary); amount(row.bonus);
            if (!['gross', 'net'].includes(String(row.payBasis))) throw invalid();
        }
    }
    // Only persist payroll fields; never copy unrelated legacy browser data.
    return JSON.parse(JSON.stringify(Object.fromEntries(
        ['rowInputs', 'manualRows', 'settings', 'grossPaySnapshot', 'staffSnapshot']
            .filter(key => value[key] !== undefined).map(key => [key, value[key]])
    ))) as StoredMonthData;
}
function assertMonth(month: string) {
    if (!/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(month)) throw new Error('올바른 지급월을 선택해 주세요.');
}
function revisionOf(value: unknown): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw invalid();
    return value;
}
export const officeStaffPayrollService = {
    async loadMonth(month: string): Promise<SharedPayrollMonth> {
        assertMonth(month);
        const saved = await getDocFromServer(doc(db, COLLECTION, month));
        if (!saved.exists()) return { data: null, revision: 0 };
        const value = saved.data();
        if (value.month !== month) throw invalid();
        return { data: validatePayrollMonth(value.payroll, true), revision: revisionOf(value.revision) };
    },
    async loadYear(year: number): Promise<StoredPayrollData> {
        if (!Number.isInteger(year) || year < 2000 || year > 2100) throw invalid();
        const saved = await getDocsFromServer(query(collection(db, COLLECTION), where('year', '==', year)));
        const result: StoredPayrollData = {};
        saved.docs.forEach(snapshot => {
            const value = snapshot.data();
            assertMonth(snapshot.id);
            if (value.month !== snapshot.id || !snapshot.id.startsWith(`${year}-`)) throw invalid();
            revisionOf(value.revision);
            result[snapshot.id] = validatePayrollMonth(value.payroll, true);
        });
        return result;
    },
    async saveMonth(month: string, data: StoredMonthData, expectedRevision: number): Promise<number> {
        assertMonth(month);
        const payroll = validatePayrollMonth(data, true);
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('로그인 후 다시 저장해 주세요.');
        if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw invalid();
        return runTransaction(db, async transaction => {
            const ref = doc(db, COLLECTION, month);
            const saved = await transaction.get(ref);
            const current = saved.exists() ? revisionOf(saved.data().revision) : 0;
            if (current !== expectedRevision) throw new Error('다른 화면에서 이 월의 급여를 변경했습니다. 입력 내용을 보관한 뒤 공용 자료를 다시 불러와 주세요.');
            const revision = current + 1;
            transaction.set(ref, { month, year: Number(month.slice(0, 4)), payroll, revision, updatedBy: uid, updatedAt: serverTimestamp() });
            return revision;
        });
    },
};
