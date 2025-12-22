import { FieldValue, Timestamp } from 'firebase/firestore';

export interface CostProfile {
    electricity: 'variable' | 'fixed' | 'included';
    gas: 'variable' | 'fixed' | 'included';
    water: 'variable' | 'fixed' | 'included';
    internet: 'variable' | 'fixed' | 'included';
    maintenance: 'variable' | 'fixed' | 'included';

    // Fixed amounts (if type is 'fixed')
    fixedElectricity?: number;
    fixedGas?: number;
    fixedWater?: number;
    fixedInternet?: number;
    fixedMaintenance?: number;
}

export interface Contract {
    startDate: string;
    endDate: string;
    deposit: number;
    monthlyRent: number;
    paymentDay: number;
    landlordName: string;
    landlordContact: string;
    isReported: boolean; // 임대차계약 신고 여부
}

export interface Accommodation {
    id: string;
    name: string; // e.g., "사동 502호"
    address: string;
    type: 'OneRoom' | 'TwoRoom' | 'Apartment';
    status: 'active' | 'inactive';

    contract: Contract;
    costProfile: CostProfile;

    // Current Occupant Snapshot (Simple version for now)
    currentOccupantName?: string;
    currentOccupantPhone?: string;

    memo?: string;
    createdAt?: Timestamp | FieldValue | null;
    updatedAt?: Timestamp | FieldValue | null;
}

export interface UtilityCosts {
    rent: number;
    electricity: number;
    gas: number;
    water: number;
    internet: number;
    maintenance: number;
    other: number;
    total: number;
}

export interface UtilityRecord {
    id: string;
    accommodationId: string;
    accommodationName: string; // Denormalized for easy display
    yearMonth: string; // "2025-01"

    costs: UtilityCosts;

    paymentDate?: string;
    paymentStatus: 'unpaid' | 'paid' | 'pending';

    memo?: string;
    isAnomaly?: boolean; // If true, flagged as suspicious
    createdAt?: Timestamp | FieldValue | null;
    updatedAt?: Timestamp | FieldValue | null;
}
