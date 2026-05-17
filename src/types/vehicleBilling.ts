import { Timestamp } from 'firebase/firestore';

export type VehicleBillingStatus = 'DRAFT' | 'CONFIRMED' | 'PAID' | 'OVERDUE';
export type VehicleBillingIssuedToType = 'team' | 'team_leader' | 'worker';

export interface VehicleBillingCostItem {
    id: string; // Expense ID or 'fixed-rent'
    label: string; // e.g. "Monthly Rent", "Fuel (2024-01-05)"
    amount: number;
    type: 'FIXED' | 'VARIABLE';
    category?: string; // 'RENT', 'FUEL', etc.
    sourceType?: 'vehicle_ledger' | 'manual';
    sourceLedgerRowId?: string;
    sourceSegmentId?: string;
    sourceStartDate?: string;
    sourceEndDate?: string;
}

export interface VehicleBillingDocument {
    id: string; // YYYY-MM_VEHICLEID
    yearMonth: string; // YYYY-MM

    vehicleId: string;
    vehiclePlate: string;

    // Whom to charge? (Usually the Company pays, but tracking per team is good)
    assignedTeamId?: string;
    assignedTeamName?: string;
    teamId?: string;
    teamName?: string;
    issuedToType?: VehicleBillingIssuedToType;
    issuedToWorkerId?: string;
    issuedToWorkerName?: string;

    fixedCost: number; // Rent/Lease Fee
    variableCost: number; // Sum of Fuel, Tolls, etc.
    totalAmount: number;

    status: VehicleBillingStatus;

    lineItems: VehicleBillingCostItem[]; // Breakdown

    memo?: string;

    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    confirmedAt?: Timestamp;
}
