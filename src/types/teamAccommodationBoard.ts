export interface TeamAccommodationBoard {
    canManageAll?: boolean;
    teamId: string;
    teams: Array<{ id: string; name: string; color?: string }>;
    date: string;
    revision: string;
    rooms: Array<{ id: string; name: string; address: string; type: string; ownership?: string; roomCount?: number | null; maxOccupants?: number | null; totalOccupants?: number }>;
    workers: Array<{ id: string; name: string; role: string; teamId?: string; teamName?: string; accommodationId: string | null; lockedReason?: string }>;
}

export interface TeamAccommodationChange {
    workerId: string;
    accommodationId: string | null;
}

export interface TeamAccommodationRoomChange {
    accommodationId: string;
    roomCount: number | null;
    maxOccupants: number | null;
}
