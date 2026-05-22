import { Timestamp } from 'firebase/firestore';

export type ErpMessageType = 'direct' | 'broadcast' | 'system';
export type ErpMessagePriority = 'low' | 'normal' | 'high' | 'urgent';
export type ErpMessageRecipientScope = 'users' | 'all';
export type ErpMessageStatus = 'active' | 'archived';

export interface ErpMessage {
  id: string;
  type: ErpMessageType;
  title: string;
  body: string;
  category: string;
  priority: ErpMessagePriority;
  status: ErpMessageStatus;
  senderId: string;
  senderName: string;
  senderEmail?: string | null;
  recipientScope: ErpMessageRecipientScope;
  recipientIds: string[];
  recipientNames: string[];
  readBy: string[];
  readAtBy: Record<string, Timestamp>;
  pinned: boolean;
  actionLabel?: string | null;
  actionUrl?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt?: Timestamp | null;
}

export interface CreateErpMessageInput {
  type: ErpMessageType;
  title?: string;
  body: string;
  category?: string;
  priority?: ErpMessagePriority;
  senderId: string;
  senderName: string;
  senderEmail?: string | null;
  recipientScope: ErpMessageRecipientScope;
  recipientIds?: string[];
  recipientNames?: string[];
  pinned?: boolean;
  actionLabel?: string | null;
  actionUrl?: string | null;
  expiresAt?: Timestamp | null;
}

export interface ErpMessageSummary {
  total: number;
  unread: number;
  urgentUnread: number;
  latest?: ErpMessage;
}
