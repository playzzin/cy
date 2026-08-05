import type { Timestamp } from 'firebase/firestore';

export type IncidentCaseType = 'incident' | 'accident';

export interface IncidentCaseCategory {
  id: string;
  name: string;
  color: string;
  active: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface IncidentCase {
  id: string;
  caseNumber: string;
  personName: string;
  birthDate: string;
  title: string;
  caseType: IncidentCaseType;
  categoryId: string;
  incidentDate: string | null;
  record: string;
  createdByUid: string;
  updatedByUid: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface UpsertIncidentCaseInput {
  personName: string;
  birthDate: string;
  title: string;
  caseType: IncidentCaseType;
  categoryId: string;
  incidentDate?: string | null;
  record: string;
}

export interface UpsertIncidentCaseCategoryInput {
  name: string;
  color: string;
  active: boolean;
}

export const INCIDENT_CASE_TYPE_LABELS: Record<IncidentCaseType, string> = {
  incident: '사건',
  accident: '사고',
};
