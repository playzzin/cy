import { FieldValue, Timestamp } from 'firebase/firestore';

export type VehicleType = 'RENT' | 'LEASE' | 'OWNED';
export type VehicleStatus = 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE' | 'DISPOSED';
export type VehicleAssigneeType = 'TEAM' | 'WORKER';

export interface VehicleContract {
    type: VehicleType;
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
    deposit: number;
    monthlyFee: number; // Monthly Rent/Lease fee (0 for OWNED)
    paymentDay: number; // 1-31
    financeCompany: {
        name: string;
        contact: string;
    };
    bankAccount?: {
        bankName: string;
        accountNumber: string;
        accountHolder: string;
    };
}

export interface VehicleInsurance {
    company: string;
    policyNumber: string;
    contact: string;
    expiryDate: string; // YYYY-MM-DD
    ageLimit: string; // e.g., "Any", "26+"
}

export interface Vehicle {
    id: string; // Document ID (Auto-generated or managed)
    licensePlate: string; // Primary Indentifier (e.g., 12가 3456)
    model: string; // e.g., 'Carnival', 'Starex'
    type: VehicleType;
    status: VehicleStatus;

    contract: VehicleContract;
    insurance?: VehicleInsurance;

    // Denormalized Assignment Snapshot
    currentAssigneeId?: string;
    currentAssigneeType?: VehicleAssigneeType;
    currentAssigneeName?: string; // Display Name for Grid

    memo?: string;

    createdAt?: Timestamp | FieldValue | null;
    updatedAt?: Timestamp | FieldValue | null;
}

// Assignment History Record
export interface VehicleAssignmentRecord {
    id: string;
    vehicleId: string;
    vehiclePlate: string;

    assigneeId: string;
    assigneeType: VehicleAssigneeType;
    assigneeName: string;

    startDate: string;
    endDate?: string; // Null implies currently active

    note?: string;
    createdAt?: Timestamp | FieldValue;
    updatedAt?: Timestamp | FieldValue;
}

// Expense (Variable Cost) Record
export type VehicleExpenseType = 'FUEL' | 'REPAIR' | 'TOLL' | 'FINE' | 'OTHER';
export type VehicleExpensePayer = 'COMPANY' | 'DRIVER';

export interface VehicleExpenseRecord {
    id: string;
    vehicleId: string;
    vehiclePlate: string;

    date: string; // YYYY-MM-DD
    type: VehicleExpenseType;
    amount: number;
    payer: VehicleExpensePayer;

    note?: string;
    evidenceUrl?: string; // Receipt Image

    createdAt?: Timestamp | FieldValue;
}
