import {
  deleteField,
  doc,
  runTransaction,
  serverTimestamp,
  type Transaction,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  AccommodationBillingDocument,
  AccommodationBillingLineItem,
} from '../types/accommodationBilling';
import {
  matchesAccommodationUtilityBillingLineItem,
  type AccommodationUtilityBillingRecordReference,
} from './accommodationUtilityBillingSyncService';

const BILLING_DOCUMENT_COLLECTION = 'accommodation_billing_documents';
const BILLING_LINE_ITEM_COLLECTION = 'accommodation_billing_line_items';
const SYSTEM_CONFIG_COLLECTION = 'system_configs';
const SYNC_GUARD_COLLECTION = 'support_shared_data';
const SYNC_GUARD_PREFIX = 'accommodation_billing_sync_v1_';

type RawDocument = Record<string, unknown> & { id: string };

export interface AccommodationUtilityBillingAtomicInput {
  yearMonth: string;
  record: AccommodationUtilityBillingRecordReference;
  desiredDocuments: AccommodationBillingDocument[];
  relatedDocuments: AccommodationBillingDocument[];
  sourceDocumentsByDesiredId: Array<{
    desiredDocumentId: string;
    sourceDocumentIds: string[];
  }>;
}

export interface AccommodationUtilityBillingAtomicResult {
  action: 'synced' | 'cleared';
  desiredDocumentIds: string[];
  deletedDocumentIds: string[];
}

const normalize = (value: unknown): string => String(value ?? '').trim();

const normalizeStatus = (value: unknown): string => (
  normalize(value || 'draft').toUpperCase()
);

const isProtectedStatus = (value: unknown): boolean => normalizeStatus(value) !== 'DRAFT';

const isActiveLineItem = (value: RawDocument): boolean => (
  normalize(value.status || 'active').toLowerCase() !== 'cancelled' && !value.cancelledAt
);

const getLineItemDocumentId = (value: RawDocument): string => {
  const relation = value.billingDocument;
  if (relation && typeof relation === 'object' && !Array.isArray(relation)) {
    const relationId = normalize((relation as Record<string, unknown>).id);
    if (relationId) return relationId;
  }
  return normalize(value.billingDocumentId);
};

const parseObject = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
};

const stripUndefined = (value: Record<string, unknown>): Record<string, unknown> => (
  Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined))
);

const unique = (values: Iterable<string>): string[] => Array.from(
  new Set(Array.from(values, normalize).filter(Boolean))
);

const getStoredLineItemIds = (documentData: RawDocument | undefined): string[] => (
  Array.isArray(documentData?.lineItemIds)
    ? unique(documentData.lineItemIds.map((value) => normalize(value)))
    : []
);

const getGuardId = (yearMonth: string, recordId: string): string => (
  `${SYNC_GUARD_PREFIX}${encodeURIComponent(normalize(yearMonth))}_${encodeURIComponent(normalize(recordId))}`
);

const getTeamSettlementConfigId = (yearMonth: string, teamId: string): string => (
  `team_settlement_${yearMonth}__${teamId}`
);

const isOfficeTarget = (teamId: unknown, teamName: unknown): boolean => {
  const normalizedId = normalize(teamId).toLowerCase();
  const normalizedName = normalize(teamName).replace(/\s+/g, '').toLowerCase();
  return normalizedId === '__office__' || normalizedName === '사무실';
};

const readDocuments = async (
  transaction: Transaction,
  collectionName: string,
  ids: Iterable<string>
): Promise<Map<string, RawDocument>> => {
  const normalizedIds = unique(ids);
  const refs = normalizedIds.map((id) => doc(db, collectionName, id));
  const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
  const rows = new Map<string, RawDocument>();
  snapshots.forEach((snapshot, index) => {
    if (!snapshot.exists()) return;
    rows.set(normalizedIds[index], {
      id: normalizedIds[index],
      ...(snapshot.data() as Record<string, unknown>),
    });
  });
  return rows;
};

const getInputLineItemIds = (documents: AccommodationBillingDocument[]): string[] => unique(
  documents.flatMap((document) => (document.lineItems ?? []).map((lineItem) => lineItem.id))
);

const asLineItem = (row: RawDocument): AccommodationBillingLineItem => ({
  id: row.id,
  label: normalize(row.label),
  amount: Number.isFinite(Number(row.amount)) ? Number(row.amount) : 0,
  targetField: normalize(row.targetField || 'accommodation') as AccommodationBillingLineItem['targetField'],
  sourceType: normalize(row.sourceType) as AccommodationBillingLineItem['sourceType'] || undefined,
  sourceAccommodationId: normalize(row.sourceAccommodationId) || undefined,
  sourceUtilityRecordId: normalize(row.sourceUtilityRecordId) || undefined,
});

const toLineItemPayload = (
  billingDocumentId: string,
  lineItem: AccommodationBillingLineItem,
  exists: boolean
): Record<string, unknown> => stripUndefined({
  billingDocumentId,
  // Older rows can contain both the flat id and a nested relation snapshot.
  // Readers prefer the nested value, so it must be removed when a line moves.
  billingDocument: deleteField(),
  label: lineItem.label,
  amount: Number.isFinite(Number(lineItem.amount)) ? Number(lineItem.amount) : 0,
  targetField: lineItem.targetField,
  sourceType: lineItem.sourceType,
  sourceAccommodationId: lineItem.sourceAccommodationId,
  sourceUtilityRecordId: lineItem.sourceUtilityRecordId,
  status: 'active',
  cancelledAt: null,
  createdAt: exists ? undefined : serverTimestamp(),
  updatedAt: serverTimestamp(),
});

const toBillingDocumentPayload = (
  document: AccommodationBillingDocument,
  lineItemIds: string[],
  existingDocument?: RawDocument
): Record<string, unknown> => stripUndefined({
  yearMonth: document.yearMonth,
  teamId: document.teamId || null,
  teamName: document.teamName || null,
  issuedToType: document.issuedToType === 'team_leader' ? 'team' : document.issuedToType,
  issuedToWorkerId: document.issuedToType === 'worker' ? (document.issuedToWorkerId || null) : null,
  issuedToWorkerName: document.issuedToWorkerName || null,
  status: 'draft',
  memo: existingDocument ? (existingDocument.memo ?? null) : (document.memo || null),
  confirmedAt: null,
  postedAdvancePaymentId: null,
  lineItemIds,
  createdAt: existingDocument ? undefined : serverTimestamp(),
  updatedAt: serverTimestamp(),
});

const assertMutableDocuments = (documents: Map<string, RawDocument>): void => {
  documents.forEach((document) => {
    if (isProtectedStatus(document.status)) {
      throw new Error(`accommodation-billing-atomic-protected:${document.id}:${normalizeStatus(document.status)}`);
    }
  });
};

const assertTeamSettlementsMutable = (
  configs: Map<string, RawDocument>,
  yearMonth: string
): void => {
  configs.forEach((row) => {
    const data = parseObject(row.data);
    if (!data) {
      throw new Error(`accommodation-billing-atomic-team-settlement-invalid:${row.id}`);
    }
    if (normalize(data.yearMonth) !== normalize(yearMonth)) {
      throw new Error(`accommodation-billing-atomic-team-settlement-month-mismatch:${row.id}`);
    }
    if (normalize(data.confirmedAt)) {
      throw new Error(`accommodation-billing-atomic-team-settlement-confirmed:${row.id}`);
    }
  });
};

export const isAccommodationUtilityBillingAtomicProtectionError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('accommodation-billing-atomic-protected:')
    || message.includes('accommodation-billing-atomic-team-settlement-')
    || message.includes('accommodation-billing-atomic-team-id-required:');
};

export const accommodationUtilityBillingAtomicService = {
  reconcileRecord: async (
    input: AccommodationUtilityBillingAtomicInput
  ): Promise<AccommodationUtilityBillingAtomicResult> => {
    const yearMonth = normalize(input.yearMonth);
    const recordId = normalize(input.record.recordId);
    if (!/^\d{4}-\d{2}$/.test(yearMonth) || !recordId) {
      throw new Error('accommodation-billing-atomic-invalid-record');
    }

    const desiredById = new Map(
      input.desiredDocuments.map((document) => [normalize(document.id), document])
    );
    if (desiredById.has('')) throw new Error('accommodation-billing-atomic-document-id-required');

    const relatedById = new Map(
      input.relatedDocuments.map((document) => [normalize(document.id), document])
    );
    const sourceIdsByDesiredId = new Map<string, Set<string>>();
    input.sourceDocumentsByDesiredId.forEach((entry) => {
      const desiredId = normalize(entry.desiredDocumentId);
      if (!desiredId) return;
      sourceIdsByDesiredId.set(desiredId, new Set(unique([
        desiredId,
        ...entry.sourceDocumentIds,
      ])));
    });
    desiredById.forEach((_document, desiredId) => {
      if (!sourceIdsByDesiredId.has(desiredId)) {
        sourceIdsByDesiredId.set(desiredId, new Set([desiredId]));
      }
    });

    return runTransaction(db, async (transaction) => {
      const guardRef = doc(db, SYNC_GUARD_COLLECTION, getGuardId(yearMonth, recordId));
      const guardSnapshot = await transaction.get(guardRef);
      const guardData = guardSnapshot.exists()
        ? parseObject((guardSnapshot.data() as Record<string, unknown>).data)
        : null;
      const guardDocumentIds = Array.isArray(guardData?.documentIds)
        ? unique(guardData.documentIds.map((value) => normalize(value)))
        : [];
      const guardLineItemIds = Array.isArray(guardData?.lineItemIds)
        ? unique(guardData.lineItemIds.map((value) => normalize(value)))
        : [];

      const documentIds = new Set<string>([
        ...desiredById.keys(),
        ...relatedById.keys(),
        ...guardDocumentIds,
      ]);
      sourceIdsByDesiredId.forEach((sourceIds) => {
        sourceIds.forEach((id) => documentIds.add(id));
      });
      documentIds.delete('');

      const storedDocuments = await readDocuments(
        transaction,
        BILLING_DOCUMENT_COLLECTION,
        documentIds
      );
      assertMutableDocuments(storedDocuments);

      const lineItemIds = new Set<string>([
        ...guardLineItemIds,
        ...getInputLineItemIds(input.relatedDocuments),
        ...getInputLineItemIds(input.desiredDocuments),
      ]);
      storedDocuments.forEach((document) => {
        getStoredLineItemIds(document).forEach((id) => lineItemIds.add(id));
      });
      lineItemIds.delete('');

      const storedLineItems = await readDocuments(
        transaction,
        BILLING_LINE_ITEM_COLLECTION,
        lineItemIds
      );

      const targetTeams = new Map<string, { teamId: string; teamName: string }>();
      const rememberTarget = (teamIdValue: unknown, teamNameValue: unknown) => {
        const teamId = normalize(teamIdValue);
        const teamName = normalize(teamNameValue);
        if (isOfficeTarget(teamId, teamName)) return;
        if (!teamId) {
          throw new Error(`accommodation-billing-atomic-team-id-required:${teamName || 'unknown'}`);
        }
        targetTeams.set(teamId, { teamId, teamName });
      };
      desiredById.forEach((document) => rememberTarget(document.teamId, document.teamName));
      storedDocuments.forEach((document) => rememberTarget(document.teamId, document.teamName));

      const settlementConfigIds = Array.from(targetTeams.keys()).map((teamId) => (
        getTeamSettlementConfigId(yearMonth, teamId)
      ));
      const settlementConfigs = await readDocuments(
        transaction,
        SYSTEM_CONFIG_COLLECTION,
        settlementConfigIds
      );
      assertTeamSettlementsMutable(settlementConfigs, yearMonth);

      const activeLineItems = Array.from(storedLineItems.values()).filter(isActiveLineItem);
      const activeItemsByDocumentId = new Map<string, RawDocument[]>();
      activeLineItems.forEach((lineItem) => {
        const documentId = getLineItemDocumentId(lineItem);
        if (!documentId) return;
        const rows = activeItemsByDocumentId.get(documentId) ?? [];
        rows.push(lineItem);
        activeItemsByDocumentId.set(documentId, rows);
      });

      const finalItemsById = new Map<string, {
        documentId: string;
        lineItem: AccommodationBillingLineItem;
      }>();
      const migratedSourceDocumentIds = new Set<string>();

      desiredById.forEach((desiredDocument, desiredId) => {
        const sourceIds = sourceIdsByDesiredId.get(desiredId) ?? new Set([desiredId]);
        sourceIds.forEach((sourceId) => {
          if (sourceId !== desiredId) migratedSourceDocumentIds.add(sourceId);
          (activeItemsByDocumentId.get(sourceId) ?? []).forEach((row) => {
            const lineItem = asLineItem(row);
            if (matchesAccommodationUtilityBillingLineItem(lineItem, input.record)) return;
            finalItemsById.set(lineItem.id, { documentId: desiredId, lineItem });
          });
        });

        (desiredDocument.lineItems ?? [])
          .filter((lineItem) => matchesAccommodationUtilityBillingLineItem(lineItem, input.record))
          .forEach((lineItem) => {
            finalItemsById.set(lineItem.id, { documentId: desiredId, lineItem });
          });
      });

      const deletedDocumentIds = new Set<string>();
      const keptStaleItemsByDocumentId = new Map<string, AccommodationBillingLineItem[]>();
      storedDocuments.forEach((_document, documentId) => {
        if (desiredById.has(documentId)) return;
        if (migratedSourceDocumentIds.has(documentId)) {
          deletedDocumentIds.add(documentId);
          return;
        }

        const remaining = (activeItemsByDocumentId.get(documentId) ?? [])
          .map(asLineItem)
          .filter((lineItem) => !matchesAccommodationUtilityBillingLineItem(lineItem, input.record));
        if (remaining.length === 0) deletedDocumentIds.add(documentId);
        else keptStaleItemsByDocumentId.set(documentId, remaining);
      });

      const finalLineItemIdsByDocumentId = new Map<string, string[]>();
      finalItemsById.forEach(({ documentId, lineItem }) => {
        const ids = finalLineItemIdsByDocumentId.get(documentId) ?? [];
        ids.push(lineItem.id);
        finalLineItemIdsByDocumentId.set(documentId, ids);
      });

      desiredById.forEach((desiredDocument, desiredId) => {
        const documentRef = doc(db, BILLING_DOCUMENT_COLLECTION, desiredId);
        transaction.set(
          documentRef,
          toBillingDocumentPayload(
            desiredDocument,
            unique(finalLineItemIdsByDocumentId.get(desiredId) ?? []),
            storedDocuments.get(desiredId)
          ),
          { merge: true }
        );
      });

      keptStaleItemsByDocumentId.forEach((lineItems, documentId) => {
        transaction.set(doc(db, BILLING_DOCUMENT_COLLECTION, documentId), {
          lineItemIds: unique(lineItems.map((lineItem) => lineItem.id)),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      });
      deletedDocumentIds.forEach((documentId) => {
        transaction.delete(doc(db, BILLING_DOCUMENT_COLLECTION, documentId));
      });

      finalItemsById.forEach(({ documentId, lineItem }, lineItemId) => {
        transaction.set(
          doc(db, BILLING_LINE_ITEM_COLLECTION, lineItemId),
          toLineItemPayload(documentId, lineItem, storedLineItems.has(lineItemId)),
          { merge: true }
        );
      });

      storedLineItems.forEach((lineItem, lineItemId) => {
        if (finalItemsById.has(lineItemId)) return;
        const documentId = getLineItemDocumentId(lineItem);
        const shouldDelete = deletedDocumentIds.has(documentId)
          || matchesAccommodationUtilityBillingLineItem(asLineItem(lineItem), input.record);
        if (shouldDelete) {
          transaction.delete(doc(db, BILLING_LINE_ITEM_COLLECTION, lineItemId));
        }
      });

      const desiredOwnLineItemIds = unique(
        Array.from(finalItemsById.values())
          .filter(({ lineItem }) => matchesAccommodationUtilityBillingLineItem(lineItem, input.record))
          .map(({ lineItem }) => lineItem.id)
      );
      transaction.set(guardRef, {
        data: JSON.stringify({
          kind: 'accommodation_billing_sync_v1',
          yearMonth,
          recordId,
          accommodationId: normalize(input.record.accommodationId),
          documentIds: Array.from(desiredById.keys()),
          lineItemIds: desiredOwnLineItemIds,
        }),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      return {
        action: desiredById.size > 0 ? 'synced' : 'cleared',
        desiredDocumentIds: Array.from(desiredById.keys()),
        deletedDocumentIds: Array.from(deletedDocumentIds),
      };
    });
  },
};
