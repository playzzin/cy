import app from '../config/firebase';
import { getDataConnect } from 'firebase/data-connect';
import {
    connectorConfig,
    createVehicle,
    createVehicleAssignment,
    createVehicleExpense,
    deleteVehicle,
    deleteVehicleExpense,
    listAllVehicleAssignments,
    listAllVehicleExpenses,
    listAllVehicles,
    updateVehicle,
    updateVehicleAssignment
} from './dataconnectCompat';
import {
    Vehicle, VehicleAssignmentRecord, VehicleExpenseRecord,
    VehicleAssigneeType, VehicleContract, VehicleInsurance, VehicleStatus, VehicleType
} from '../types/vehicle';
import { Timestamp } from '../types/timestamp';

const dc = getDataConnect(app, connectorConfig);

const DEFAULT_CONTRACT: VehicleContract = {
    type: 'OWNED',
    startDate: '',
    endDate: '',
    deposit: 0,
    monthlyFee: 0,
    paymentDay: 1,
    financeCompany: {
        name: '',
        contact: ''
    },
    bankAccount: {
        bankName: '',
        accountNumber: '',
        accountHolder: ''
    }
};

const DEFAULT_BANK_ACCOUNT = DEFAULT_CONTRACT.bankAccount ?? {
    bankName: '',
    accountNumber: '',
    accountHolder: ''
};

const isUuidString = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ||
    /^[0-9a-f]{32}$/i.test(value);

const toTimestamp = (value?: string | null): Timestamp | null => {
    if (!value) return null;
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return null;
    return Timestamp.fromDate(d);
};

const safeJsonParse = <T>(value: unknown, fallback: T): T => {
    if (value && typeof value === 'object') return value as T;
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    try {
        return JSON.parse(trimmed) as T;
    } catch {
        return fallback;
    }
};

const safeJsonStringify = (value: unknown): string | null => {
    if (value === undefined) return null;
    if (value === null) return null;
    try {
        return JSON.stringify(value);
    } catch {
        return null;
    }
};

const toPlainObject = (value: unknown): Record<string, unknown> => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return {};
};

const toFiniteNumber = (value: unknown, fallback = 0): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    if (typeof value === 'string') {
        const cleaned = value.replace(/,/g, '').trim();
        if (!cleaned) return fallback;
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
};

const normalizeDay = (value: unknown, fallback = 1): number => {
    const parsed = Math.floor(toFiniteNumber(value, fallback));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.min(31, parsed));
};

const normalizeVehicleType = (value: unknown): VehicleType => {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'RENT' || normalized === 'LEASE' || normalized === 'OWNED') {
        return normalized as VehicleType;
    }
    return 'OWNED';
};

const normalizeVehicleStatus = (value: unknown): VehicleStatus => {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'AVAILABLE' || normalized === 'ASSIGNED' || normalized === 'MAINTENANCE' || normalized === 'DISPOSED') {
        return normalized as VehicleStatus;
    }
    return 'AVAILABLE';
};

const normalizeAssigneeType = (value: unknown): VehicleAssigneeType | undefined => {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'TEAM' || normalized === 'WORKER') return normalized as VehicleAssigneeType;
    return undefined;
};

const normalizeVehicleContract = (value: unknown, fallbackType: VehicleType): VehicleContract => {
    const parsed = safeJsonParse<Record<string, unknown>>(value, {});
    const financeCompany = toPlainObject(parsed.financeCompany);
    const bankAccount = toPlainObject(parsed.bankAccount);
    const type = normalizeVehicleType(parsed.type ?? fallbackType);

    const normalized: VehicleContract = {
        ...DEFAULT_CONTRACT,
        type,
        startDate: typeof parsed.startDate === 'string' ? parsed.startDate : '',
        endDate: typeof parsed.endDate === 'string' ? parsed.endDate : '',
        deposit: toFiniteNumber(parsed.deposit, DEFAULT_CONTRACT.deposit),
        monthlyFee: toFiniteNumber(parsed.monthlyFee, DEFAULT_CONTRACT.monthlyFee),
        paymentDay: normalizeDay(parsed.paymentDay, DEFAULT_CONTRACT.paymentDay),
        financeCompany: {
            ...DEFAULT_CONTRACT.financeCompany,
            name: typeof financeCompany.name === 'string' ? financeCompany.name : '',
            contact: typeof financeCompany.contact === 'string' ? financeCompany.contact : ''
        }
    };

    const normalizedBankAccount = {
        ...DEFAULT_BANK_ACCOUNT,
        bankName: typeof bankAccount.bankName === 'string' ? bankAccount.bankName : '',
        accountNumber: typeof bankAccount.accountNumber === 'string' ? bankAccount.accountNumber : '',
        accountHolder: typeof bankAccount.accountHolder === 'string' ? bankAccount.accountHolder : ''
    };

    if (normalizedBankAccount.bankName || normalizedBankAccount.accountNumber || normalizedBankAccount.accountHolder) {
        normalized.bankAccount = normalizedBankAccount;
    } else {
        normalized.bankAccount = undefined;
    }

    if (normalized.type === 'OWNED') {
        normalized.deposit = 0;
        normalized.monthlyFee = 0;
    }

    return normalized;
};

const normalizeVehicleInsurance = (value: unknown): VehicleInsurance | undefined => {
    if (value === undefined || value === null) return undefined;
    const parsed = safeJsonParse<Record<string, unknown>>(value, {});

    const normalized: VehicleInsurance = {
        company: typeof parsed.company === 'string' ? parsed.company : '',
        policyNumber: typeof parsed.policyNumber === 'string' ? parsed.policyNumber : '',
        contact: typeof parsed.contact === 'string' ? parsed.contact : '',
        expiryDate: typeof parsed.expiryDate === 'string' ? parsed.expiryDate : '',
        ageLimit: typeof parsed.ageLimit === 'string' && parsed.ageLimit.trim() ? parsed.ageLimit : 'Any'
    };

    const hasMeaningfulValue =
        normalized.company.trim().length > 0 ||
        normalized.policyNumber.trim().length > 0 ||
        normalized.contact.trim().length > 0 ||
        normalized.expiryDate.trim().length > 0 ||
        (normalized.ageLimit.trim().length > 0 && normalized.ageLimit !== 'Any');

    return hasMeaningfulValue ? normalized : undefined;
};

const resolveVehicleUuid = async (id: string): Promise<string | null> => {
    if (!id) return null;
    if (isUuidString(id)) return id;
    const res = await listAllVehicles(dc);
    const rows = (res as any)?.data?.vehicles ?? [];
    const hit = Array.isArray(rows) ? rows.find((r: any) => String(r?.legacyId ?? '') === String(id)) : null;
    return hit?.id ? String(hit.id) : null;
};

const mapVehicle = (row: any): Vehicle => {
    const type = normalizeVehicleType(row?.type);
    return {
        id: String(row?.id ?? ''),
        licensePlate: String(row?.licensePlate ?? ''),
        model: row?.model ? String(row.model) : '',
        type,
        status: normalizeVehicleStatus(row?.status),
        contract: normalizeVehicleContract(row?.contract, type),
        insurance: normalizeVehicleInsurance(row?.insurance),
        currentAssigneeId: row?.currentAssigneeId ? String(row.currentAssigneeId) : undefined,
        currentAssigneeType: normalizeAssigneeType(row?.currentAssigneeType),
        currentAssigneeName: row?.currentAssigneeName ? String(row.currentAssigneeName) : undefined,
        memo: row?.memo ? String(row.memo) : undefined,
        createdAt: toTimestamp(row?.createdAt),
        updatedAt: toTimestamp(row?.updatedAt)
    };
};

const mapAssignment = (row: any): VehicleAssignmentRecord => {
    const vehicle = row?.vehicle;
    return {
        id: String(row?.id ?? ''),
        vehicleId: vehicle?.id ? String(vehicle.id) : String(row?.vehicleId ?? ''),
        vehiclePlate: row?.vehiclePlate ? String(row.vehiclePlate) : (vehicle?.licensePlate ? String(vehicle.licensePlate) : ''),
        assigneeId: row?.assigneeId ? String(row.assigneeId) : '',
        assigneeType: (row?.assigneeType ? String(row.assigneeType) : 'TEAM') as any,
        assigneeName: row?.assigneeName ? String(row.assigneeName) : '',
        startDate: row?.startDate ? String(row.startDate) : '',
        endDate: row?.endDate ? String(row.endDate) : undefined,
        note: row?.note ? String(row.note) : undefined,
        createdAt: toTimestamp(row?.createdAt) ?? undefined,
        updatedAt: toTimestamp(row?.updatedAt) ?? undefined
    };
};

const mapExpense = (row: any): VehicleExpenseRecord => {
    const vehicle = row?.vehicle;
    return {
        id: String(row?.id ?? ''),
        vehicleId: vehicle?.id ? String(vehicle.id) : String(row?.vehicleId ?? ''),
        vehiclePlate: row?.vehiclePlate ? String(row.vehiclePlate) : (vehicle?.licensePlate ? String(vehicle.licensePlate) : ''),
        date: row?.date ? String(row.date) : '',
        type: (row?.type ? String(row.type) : 'OTHER') as any,
        amount: Number(row?.amount ?? 0),
        payer: (row?.payer ? String(row.payer) : 'COMPANY') as any,
        note: row?.note ? String(row.note) : undefined,
        evidenceUrl: row?.evidenceUrl ? String(row.evidenceUrl) : undefined,
        createdAt: toTimestamp(row?.createdAt) ?? undefined
    };
};

export const vehicleService = {
    // --- Vehicle CRUD ---

    // Create new vehicle
    createVehicle: async (vehicle: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>) => {
        try {
            const res = await createVehicle(dc, {
                legacyId: (vehicle as any)?.id ? String((vehicle as any).id) : null,
                licensePlate: vehicle.licensePlate,
                model: vehicle.model,
                type: vehicle.type,
                status: vehicle.status ?? 'AVAILABLE',
                contract: safeJsonStringify(vehicle.contract),
                insurance: safeJsonStringify(vehicle.insurance),
                currentAssigneeId: vehicle.currentAssigneeId ?? null,
                currentAssigneeType: vehicle.currentAssigneeType ?? null,
                currentAssigneeName: vehicle.currentAssigneeName ?? null,
                memo: vehicle.memo ?? null
            } as any);
            return String((res as any)?.data?.vehicle_insert?.id ?? '');
        } catch (error) {
            console.error("Error creating vehicle:", error);
            throw error;
        }
    },

    // Update vehicle
    updateVehicle: async (id: string, updates: Partial<Vehicle>) => {
        try {
            const uuid = await resolveVehicleUuid(id);
            if (!uuid) throw new Error('Vehicle not found');
            await updateVehicle(dc, {
                id: uuid,
                licensePlate: updates.licensePlate,
                model: updates.model,
                type: updates.type,
                status: updates.status,
                contract: updates.contract !== undefined ? safeJsonStringify(updates.contract) : undefined,
                insurance: updates.insurance !== undefined ? safeJsonStringify(updates.insurance) : undefined,
                currentAssigneeId: updates.currentAssigneeId !== undefined ? (updates.currentAssigneeId ?? null) : undefined,
                currentAssigneeType: updates.currentAssigneeType !== undefined ? (updates.currentAssigneeType ?? null) : undefined,
                currentAssigneeName: updates.currentAssigneeName !== undefined ? (updates.currentAssigneeName ?? null) : undefined,
                memo: updates.memo !== undefined ? (updates.memo ?? null) : undefined
            } as any);
        } catch (error) {
            console.error("Error updating vehicle:", error);
            throw error;
        }
    },

    // Delete vehicle (Soft delete recommended, but hard delete for now)
    deleteVehicle: async (id: string) => {
        try {
            const uuid = await resolveVehicleUuid(id);
            if (!uuid) return;
            await deleteVehicle(dc, { id: uuid } as any);
        } catch (error) {
            console.error("Error deleting vehicle:", error);
            throw error;
        }
    },

    // List all cars
    getVehicles: async () => {
        try {
            const res = await listAllVehicles(dc);
            const rows = (res as any)?.data?.vehicles ?? [];
            const vehicles = Array.isArray(rows) ? rows.map(mapVehicle) : [];
            vehicles.sort((a, b) => String(a.licensePlate).localeCompare(String(b.licensePlate), 'ko'));
            return vehicles;
        } catch (error) {
            console.error("Error fetching vehicles:", error);
            return [];
        }
    },

    // --- Assignment Logic ---

    assignVehicle: async (
        vehicleId: string,
        assigneeId: string,
        assigneeType: VehicleAssigneeType,
        assigneeName: string,
        startDate: string
    ) => {
        try {
            const uuid = await resolveVehicleUuid(vehicleId);
            if (!uuid) throw new Error('Vehicle not found');

            const vehicles = await vehicleService.getVehicles();
            const vehicle = vehicles.find(v => String(v.id) === String(uuid)) || null;
            if (!vehicle) throw new Error('Vehicle not found');

            if (vehicle.status === 'ASSIGNED') {
                throw new Error('Vehicle is already assigned');
            }

            await createVehicleAssignment(dc, {
                vehicleId: uuid,
                vehiclePlate: vehicle.licensePlate,
                assigneeId,
                assigneeType,
                assigneeName,
                startDate
            } as any);

            await updateVehicle(dc, {
                id: uuid,
                status: 'ASSIGNED',
                currentAssigneeId: assigneeId,
                currentAssigneeType: assigneeType,
                currentAssigneeName: assigneeName
            } as any);
        } catch (error) {
            console.error("Assignment Transaction Failed:", error);
            throw error;
        }
    },

    unassignVehicle: async (vehicleId: string, endDate: string) => {
        try {
            const uuid = await resolveVehicleUuid(vehicleId);
            if (!uuid) throw new Error('Vehicle not found');

            const assignmentsRes = await listAllVehicleAssignments(dc);
            const rows = (assignmentsRes as any)?.data?.vehicleAssignments ?? [];
            const active = Array.isArray(rows)
                ? rows.find((r: any) => String(r?.vehicle?.id ?? '') === String(uuid) && !r?.endDate)
                : null;

            if (active?.id) {
                await updateVehicleAssignment(dc, {
                    id: String(active.id),
                    endDate
                } as any);
            }

            await updateVehicle(dc, {
                id: uuid,
                status: 'AVAILABLE',
                currentAssigneeId: null,
                currentAssigneeType: null,
                currentAssigneeName: null
            } as any);

        } catch (error) {
            console.error("Unassign Failed:", error);
            throw error;
        }
    },

    // --- Expense Logic ---

    addExpense: async (expense: Omit<VehicleExpenseRecord, 'id' | 'createdAt'>) => {
        try {
            const vehicleUuid = await resolveVehicleUuid(expense.vehicleId);
            if (!vehicleUuid) throw new Error('Vehicle not found');

            const res = await createVehicleExpense(dc, {
                vehicleId: vehicleUuid,
                vehiclePlate: expense.vehiclePlate,
                date: expense.date,
                type: expense.type,
                amount: expense.amount,
                payer: expense.payer,
                note: expense.note ?? null,
                evidenceUrl: expense.evidenceUrl ?? null
            } as any);

            return String((res as any)?.data?.vehicleExpense_insert?.id ?? '');
        } catch (error) {
            console.error("Error adding expense:", error);
            throw error;
        }
    },

    getExpensesByVehicle: async (vehicleId: string, yearMonth: string) => {
        try {
            const uuid = await resolveVehicleUuid(vehicleId);
            if (!uuid) return [];

            const res = await listAllVehicleExpenses(dc);
            const rows = (res as any)?.data?.vehicleExpenses ?? [];

            const items = Array.isArray(rows) ? rows.map(mapExpense) : [];
            return items
                .filter((e) => String(e.vehicleId) === String(uuid) && String(e.date || '').startsWith(`${yearMonth}-`))
                .sort((a, b) => String(b.date).localeCompare(String(a.date)));
        } catch (error) {
            console.error("Error getting expenses:", error);
            return [];
        }
    },

    getExpensesByMonth: async (yearMonth: string) => {
        try {
            const res = await listAllVehicleExpenses(dc);
            const rows = (res as any)?.data?.vehicleExpenses ?? [];
            const items = Array.isArray(rows) ? rows.map(mapExpense) : [];
            return items
                .filter((e) => String(e.date || '').startsWith(`${yearMonth}-`))
                .sort((a, b) => String(b.date).localeCompare(String(a.date)));
        } catch (error) {
            console.error('Error getting monthly expenses:', error);
            return [];
        }
    },

    // --- History ---
    getAssignmentHistory: async (vehicleId: string) => {
        try {
            const uuid = await resolveVehicleUuid(vehicleId);
            if (!uuid) return [];

            const res = await listAllVehicleAssignments(dc);
            const rows = (res as any)?.data?.vehicleAssignments ?? [];
            const items = Array.isArray(rows) ? rows.map(mapAssignment) : [];

            return items
                .filter((a) => String(a.vehicleId) === String(uuid))
                .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
        } catch (error) {
            console.error("Error getting assignment history:", error);
            return [];
        }
    },

    deleteExpense: async (id: string) => {
        try {
            if (!isUuidString(id)) throw new Error('Invalid expense id');
            await deleteVehicleExpense(dc, { id } as any);
        } catch (error) {
            console.error("Error deleting expense:", error);
            throw error;
        }
    }
};
