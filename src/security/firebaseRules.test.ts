import * as fs from 'fs';
import * as path from 'path';
import {
  ERP_ADMIN_COLLECTIONS,
  ERP_BANK_NOTIFICATION_COLLECTIONS,
  ERP_FINANCE_COLLECTIONS,
  ERP_MASTER_DATA_COLLECTIONS,
  ERP_OPERATION_COLLECTIONS,
  ERP_RECRUITING_COLLECTIONS,
  ERP_SUPPORT_COLLECTIONS,
  ERP_WELFARE_COLLECTIONS,
} from './erpAccessPolicy';

const readRootFile = (fileName: string): string =>
  fs.readFileSync(path.join(process.cwd(), fileName), 'utf8');

describe('firebase security rules', () => {
  const firestoreRules = readRootFile('firestore.rules');
  const firestoreIndexes = readRootFile('firestore.indexes.json');
  const storageRules = readRootFile('storage.rules');

  it('keeps Firestore broad fallback behind the locked collection guard', () => {
    expect(firestoreRules).not.toContain('allow read, write: if request.auth != null');
    expect(firestoreRules).toContain('allow read, write: if isSignedIn() && !isLockedCollection(collectionId);');
  });

  it('protects user profile reads and writes explicitly', () => {
    expect(firestoreRules).toContain('match /users/{userId}');
    expect(firestoreRules).toContain('allow list: if isAdmin();');
    expect(firestoreRules).toContain('isSafeSelfUserCreate');
    expect(firestoreRules).toContain('isSafeSelfUserUpdate');
  });

  it('keeps all shared ERP policy collections represented in Firestore rules', () => {
    const policyCollections = [
      ...ERP_MASTER_DATA_COLLECTIONS,
      ...ERP_OPERATION_COLLECTIONS,
      ...ERP_RECRUITING_COLLECTIONS,
      ...ERP_FINANCE_COLLECTIONS,
      ...ERP_SUPPORT_COLLECTIONS,
      ...ERP_ADMIN_COLLECTIONS,
      ...ERP_BANK_NOTIFICATION_COLLECTIONS,
      ...ERP_WELFARE_COLLECTIONS,
    ];

    policyCollections.forEach((collectionId) => {
      expect(firestoreRules).toContain(`'${collectionId}'`);
    });
  });

  it('keeps bank ingestion and push tokens behind explicit least-privilege rules', () => {
    expect(firestoreRules).toContain('isBankNotificationCollection');
    expect(firestoreRules).toContain('match /bank_sms_ingestions/{ingestionId}');
    expect(firestoreRules).toContain('match /bank_transaction_candidates/{candidateId}');
    expect(firestoreRules).toContain('isValidBankCandidateReviewUpdate');
    expect(firestoreRules).toContain('match /notification_devices/{deviceId}');
    expect(firestoreRules).toContain("request.resource.data.uid == resource.data.uid");
    expect(firestoreRules).toContain('match /bank_ingestion_replay_nonces/{nonceId}');
    expect(firestoreRules).toContain('match /bank_notification_outbox/{outboxId}');
    expect(firestoreRules).toContain("collectionId == 'erp_messages'");
    expect(firestoreRules).toContain('match /erp_messages/{messageId}');
    expect(firestoreRules).toContain('isValidErpMessageReadReceiptUpdate');
  });

  it('deploys TTL retention for sensitive bank integration records', () => {
    const indexes = JSON.parse(firestoreIndexes) as {
      fieldOverrides?: Array<{ collectionGroup?: string; fieldPath?: string; ttl?: boolean }>;
    };
    const ttlCollections = new Set((indexes.fieldOverrides || [])
      .filter((entry) => entry.fieldPath === 'retentionExpiresAt' && entry.ttl === true)
      .map((entry) => entry.collectionGroup));
    expect(ttlCollections).toEqual(new Set([
      'bank_sms_ingestions',
      'bank_ingestion_replay_nonces',
      'bank_notification_outbox',
      'bank_provider_events',
    ]));
  });

  it('does not allow unrestricted Storage writes', () => {
    expect(storageRules).not.toContain('allow read, write: if request.auth != null');
    expect(storageRules).toContain('isValidBusinessUpload');
    expect(storageRules).toContain('isValidCardBillingAttachment');
    expect(storageRules).toContain('match /card-billing-statements/{yearMonth}/{documentId}/{fileName}');
    expect(storageRules).toContain('match /backups/{allPaths=**}');
    expect(storageRules).toContain('function isExplicitlyProtectedTopLevel(topLevel)');
    expect(storageRules).toContain("'profiles'");
    expect(storageRules).toContain("'users'");
    expect(storageRules).toContain("'backups'");
    expect(storageRules).toContain('allow read: if !isExplicitlyProtectedTopLevel(topLevel) && isSignedIn();');
    expect(storageRules).toContain('allow write: if !isExplicitlyProtectedTopLevel(topLevel)');
  });

  it('keeps daily-advance finance documents behind finance access checks', () => {
    expect(firestoreRules).toContain('match /daily_advance_workbook_profiles/{profileId}');
    expect(firestoreRules).toContain('match /daily_advance_statement_recruiter_fees/{feeId}');
    expect(firestoreRules).not.toContain('allow read, write: if isSignedIn();');
    expect(firestoreRules).toContain('allow read: if canReadFinance();');
    expect(firestoreRules).toContain('allow create, update, delete: if canWriteFinance();');
  });
});
