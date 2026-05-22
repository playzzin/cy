import { Timestamp } from 'firebase/firestore';
import type { ErpMessageRecipientScope } from './erpMessage';
import type { MessageRecipientRule } from '../services/messageRecipientResolver';

export type SystemMessageEvent =
  | 'dailyReport.created'
  | 'dailyReport.updated'
  | 'dailyReport.deleted'
  | 'databaseLog.created'
  | 'databaseLog.updated'
  | 'databaseLog.deleted'
  | 'scheduleBoard.confirmed'
  | 'scheduleBoard.updated'
  | 'scheduleBoard.deleted'
  | 'teamSettlement.confirmed'
  | 'teamSettlement.unconfirmed'
  | 'materialLog.created'
  | 'materialLog.updated'
  | 'materialLog.deleted'
  | 'vehicleBillingLog.created'
  | 'vehicleBillingLog.updated'
  | 'vehicleBillingLog.deleted'
  | 'cardBillingLog.created'
  | 'cardBillingLog.updated'
  | 'cardBillingLog.deleted'
  | 'accommodationBillingLog.created'
  | 'accommodationBillingLog.updated'
  | 'accommodationBillingLog.deleted'
  | 'notice.created'
  | 'loginLog.login_success'
  | 'loginLog.login_failed'
  | 'loginLog.logout'
  | 'loginLog.signup_success';

export interface SystemMessageEventConfig {
  enabled: boolean;
  recipientRule?: MessageRecipientRule;
}

export interface SystemMessageEventGroup {
  id: string;
  label: string;
  description: string;
  events: SystemMessageEvent[];
}

export interface SystemMessageSettings {
  id: string;
  enabled: boolean;
  recipientScope: ErpMessageRecipientScope;
  recipientIds: string[];
  recipientNames: string[];
  events: Record<SystemMessageEvent, SystemMessageEventConfig>;
  updatedAt?: Timestamp;
}
