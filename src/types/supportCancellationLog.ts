export type SupportCancellationResourceType = 'vehicle' | 'card' | 'accommodation';

export type SupportCancellationReason =
  | 'VEHICLE_EXPIRED'
  | 'VEHICLE_SOLD'
  | 'VEHICLE_CONTRACT_CANCELLED'
  | 'CARD_SUSPENDED'
  | 'CARD_LOST'
  | 'CARD_NUMBER_CHANGED'
  | 'CARD_CLOSED'
  | 'ACCOMMODATION_EXPIRED'
  | 'ACCOMMODATION_INTERIM_SETTLEMENT'
  | 'ACCOMMODATION_CONTRACT_CANCELLED'
  | 'OTHER';

export interface SupportCancellationActor {
  uid: string;
  name: string;
  email: string | null;
}

export interface SupportCancellationLog {
  id: string;
  resourceType: SupportCancellationResourceType;
  resourceId: string;
  resourceLabel: string;
  reason: SupportCancellationReason;
  reasonLabel: string;
  processedDate: string;
  statusBefore?: string;
  statusAfter?: string;
  assigneeName?: string;
  teamName?: string;
  billingTargetName?: string;
  settlementAmount?: number;
  note: string;
  snapshot?: Record<string, unknown>;
  actor: SupportCancellationActor;
  createdAt?: unknown;
  createdAtIso?: string;
}

export type CreateSupportCancellationLogInput = Omit<SupportCancellationLog, 'id' | 'actor' | 'createdAt' | 'createdAtIso'>;

export const SUPPORT_CANCELLATION_REASON_LABELS: Record<SupportCancellationReason, string> = {
  VEHICLE_EXPIRED: '차량 만료',
  VEHICLE_SOLD: '차량 매각/반납',
  VEHICLE_CONTRACT_CANCELLED: '차량 약정 취소',
  CARD_SUSPENDED: '카드 정지',
  CARD_LOST: '카드 분실',
  CARD_NUMBER_CHANGED: '카드번호 변경',
  CARD_CLOSED: '카드 해지',
  ACCOMMODATION_EXPIRED: '숙소 만료',
  ACCOMMODATION_INTERIM_SETTLEMENT: '숙소 중간정리',
  ACCOMMODATION_CONTRACT_CANCELLED: '숙소 약정 취소',
  OTHER: '기타 처리',
};

export const SUPPORT_CANCELLATION_REASON_OPTIONS: Record<SupportCancellationResourceType, SupportCancellationReason[]> = {
  vehicle: ['VEHICLE_EXPIRED', 'VEHICLE_SOLD', 'VEHICLE_CONTRACT_CANCELLED', 'OTHER'],
  card: ['CARD_SUSPENDED', 'CARD_LOST', 'CARD_NUMBER_CHANGED', 'CARD_CLOSED', 'OTHER'],
  accommodation: ['ACCOMMODATION_EXPIRED', 'ACCOMMODATION_INTERIM_SETTLEMENT', 'ACCOMMODATION_CONTRACT_CANCELLED', 'OTHER'],
};
