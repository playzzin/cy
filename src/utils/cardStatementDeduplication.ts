import type { CardTransaction } from '../types/card';
import type { CardBillingDocument } from '../types/cardBilling';

const normalizeText = (value: unknown): string => String(value ?? '').trim();

const decodePathPart = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const getStatementFileIdentity = (path: unknown): string => {
  const normalizedPath = normalizeText(path).split(/[?#]/, 1)[0];
  if (!normalizedPath) return '';

  const fileName = decodePathPart(normalizedPath.split(/[\\/]/).pop() || normalizedPath)
    .replace(/^\d{3}_/, '')
    .replace(/^\d{10,}_/, '')
    .trim()
    .toLocaleLowerCase('ko-KR');

  return fileName || normalizedPath.toLocaleLowerCase('ko-KR');
};

export const dedupeStatementPaths = (paths: unknown[]): string[] => {
  const uniquePaths = new Map<string, string>();

  paths.forEach((path) => {
    const normalizedPath = normalizeText(path);
    if (!normalizedPath) return;
    // Storage paths are the attachment identity. Two different uploads may
    // legitimately have the same original file name, so basename-only
    // deduplication can hide a different statement.
    const identity = normalizedPath.split('#', 1)[0].toLocaleLowerCase('ko-KR');
    uniquePaths.set(identity, normalizedPath);
  });

  return Array.from(uniquePaths.values());
};

const getTimestampMillis = (value: unknown): number => {
  if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return Number((value as { toMillis: () => number }).toMillis()) || 0;
  }
  if (value instanceof Date) return value.getTime();
  return 0;
};

const getImportedLineFingerprint = (transaction: CardTransaction): string => [
  normalizeText(transaction.date),
  normalizeText(transaction.merchant),
  normalizeText(transaction.category),
  String(Number(transaction.amount) || 0),
].join('|').toLocaleLowerCase('ko-KR');

const getImportedLinePositionIdentity = (transaction: CardTransaction): string => {
  const id = normalizeText(transaction.id);
  const idParts = id.split('__');
  if (/^card-statement__/i.test(id) && idParts.length >= 6) {
    return [
      normalizeText(idParts[idParts.length - 2]),
      normalizeText(idParts[idParts.length - 1]),
    ].join('|').toLowerCase();
  }

  // Transitional hash ids briefly encoded the result index into the source
  // segment. Accept that shape so a ledger can clean it up as well.
  const compactBlock = idParts.length >= 5
    ? normalizeText(idParts[idParts.length - 2]).match(/:(\d+)$/)?.[1]
    : '';
  const generatedLineId = id.match(/__(tx[_-]?\d+|total|\d+)$/i)?.[1];
  if (generatedLineId) return `${compactBlock || 'unknown'}|${generatedLineId.toLowerCase()}`;

  return `fingerprint:${getImportedLineFingerprint(transaction)}`;
};

type CardStatementSourceFields = Pick<
  Partial<CardTransaction>,
  'evidenceUrl' | 'statementAttachmentPaths' | 'statementOriginalFileName' | 'statementSourceSha256'
>;

export const getCardStatementSourceIdentities = (transaction: CardStatementSourceFields): string[] => {
  const identities = new Set<string>();
  const hash = normalizeText(transaction.statementSourceSha256).toLowerCase();
  if (hash) identities.add(`sha256:${hash}`);

  const originalFileName = normalizeText(transaction.statementOriginalFileName);
  if (originalFileName) identities.add(`file:${getStatementFileIdentity(originalFileName)}`);

  [
    transaction.evidenceUrl,
    ...(transaction.statementAttachmentPaths ?? []),
  ].map(normalizeText).filter(Boolean).forEach((path) => {
    const fileIdentity = getStatementFileIdentity(path);
    if (fileIdentity) identities.add(`file:${fileIdentity}`);
  });

  return Array.from(identities);
};

const getPrimaryCardStatementSourceIdentities = (identities: string[]): string[] => {
  const hashes = identities.filter((identity) => identity.startsWith('sha256:'));
  return hashes.length > 0
    ? hashes
    : identities.filter((identity) => identity.startsWith('file:'));
};

const haveMatchingCardStatementSources = (left: string[], right: string[]): boolean => {
  const leftHashes = left.filter((identity) => identity.startsWith('sha256:'));
  const rightHashes = right.filter((identity) => identity.startsWith('sha256:'));
  if (leftHashes.length > 0 && rightHashes.length > 0) {
    const rightHashSet = new Set(rightHashes);
    return leftHashes.some((identity) => rightHashSet.has(identity));
  }

  const rightFileSet = new Set(right.filter((identity) => identity.startsWith('file:')));
  return left
    .filter((identity) => identity.startsWith('file:'))
    .some((identity) => rightFileSet.has(identity));
};

export const isCardStatementImportTransaction = (transaction: CardTransaction): boolean => {
  const operationId = normalizeText(transaction.operationId || transaction.lastOperationId);
  if (operationId.startsWith('card-statement-import:')) return true;
  if (operationId) return false;

  return [transaction.evidenceUrl, ...(transaction.statementAttachmentPaths ?? [])]
    .map(normalizeText)
    .some((path) => /card-billing-statements\/.+\/imports\//i.test(path));
};

export const isLegacyCardStatementImportBillingDocument = (
  document: Pick<CardBillingDocument, 'memo' | 'statementAttachmentPaths' | 'lineItems'>,
): boolean => {
  if (/^kb\s+pdf\s+import\b/i.test(normalizeText(document.memo))) return true;

  if ((document.statementAttachmentPaths ?? []).some((path) => (
    /card-billing-statements\/.+\/imports\//i.test(normalizeText(path))
  ))) return true;

  return (document.lineItems ?? []).some((item) => (
    normalizeText(item.id).startsWith('card-statement__')
    || normalizeText(item.sourceLedgerRowId).startsWith('card-statement__')
  ));
};

export const matchesLegacyCardStatementImportBillingTotal = (
  document: Pick<CardBillingDocument, 'memo' | 'statementAttachmentPaths' | 'lineItems' | 'totalAmount'>,
  ledgerTotal: unknown,
): boolean => (
  isLegacyCardStatementImportBillingDocument(document)
  && Number(document.totalAmount ?? 0) === Number(ledgerTotal ?? 0)
);

export const dedupeImportedStatementTransactions = (
  transactions: CardTransaction[],
): CardTransaction[] => {
  const parents = transactions.map((_, index) => index);
  const findRoot = (index: number): number => {
    let root = index;
    while (parents[root] !== root) root = parents[root];
    while (parents[index] !== index) {
      const next = parents[index];
      parents[index] = root;
      index = next;
    }
    return root;
  };
  const union = (left: number, right: number): void => {
    const leftRoot = findRoot(left);
    const rightRoot = findRoot(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };

  const exactIdentityOwners = new Map<string, number>();
  const bridgeCandidates = new Map<string, { legacy: number[]; hashed: Map<string, number[]> }>();
  const importedFlags = transactions.map(isCardStatementImportTransaction);
  const sourceIdentities = transactions.map((transaction, index) => (
    importedFlags[index] ? getCardStatementSourceIdentities(transaction) : []
  ));

  transactions.forEach((transaction, index) => {
    if (!importedFlags[index] || sourceIdentities[index].length === 0) return;

    const scope = [normalizeText(transaction.cardId), normalizeText(transaction.yearMonth)].join('|');
    const linePosition = getImportedLinePositionIdentity(transaction);
    getPrimaryCardStatementSourceIdentities(sourceIdentities[index]).forEach((sourceIdentity) => {
      const identity = [scope, sourceIdentity, linePosition].join('|');
      const owner = exactIdentityOwners.get(identity);
      if (owner !== undefined) union(index, owner);
      exactIdentityOwners.set(identity, index);
    });

    // A legacy document has no content hash. A new document for the same PDF has
    // both a hash and the original-file alias, so bridge the two generations by
    // file alias + line fingerprint. Hash-to-hash matching still uses block/line
    // position above, which prevents identical indices in separate card blocks
    // from colliding.
    const hashIdentities = sourceIdentities[index].filter((identity) => identity.startsWith('sha256:'));
    sourceIdentities[index]
      .filter((identity) => identity.startsWith('file:'))
      .forEach((fileIdentity) => {
        const bridgeIdentity = [
          scope,
          fileIdentity,
          getImportedLineFingerprint(transaction),
        ].join('|');
        const candidate = bridgeCandidates.get(bridgeIdentity) ?? {
          legacy: [],
          hashed: new Map<string, number[]>(),
        };
        if (hashIdentities.length === 0) {
          candidate.legacy.push(index);
        } else {
          hashIdentities.forEach((hashIdentity) => {
            const indexes = candidate.hashed.get(hashIdentity) ?? [];
            indexes.push(index);
            candidate.hashed.set(hashIdentity, indexes);
          });
        }
        bridgeCandidates.set(bridgeIdentity, candidate);
      });
  });

  // A filename is only a safe legacy/new bridge when it points to exactly one
  // content hash. If two different PDFs share the same basename, keep them
  // separate instead of joining both through an ambiguous legacy record.
  bridgeCandidates.forEach(({ legacy, hashed }) => {
    if (legacy.length === 0 || hashed.size !== 1) return;
    const hashedIndexes = Array.from(hashed.values())[0] ?? [];
    legacy.forEach((legacyIndex) => {
      hashedIndexes.forEach((hashedIndex) => union(legacyIndex, hashedIndex));
    });
  });

  const groupedIndexes = new Map<number, number[]>();
  transactions.forEach((_, index) => {
    const root = findRoot(index);
    const group = groupedIndexes.get(root) ?? [];
    group.push(index);
    groupedIndexes.set(root, group);
  });

  const dedupedTransactions = Array.from(groupedIndexes.values())
    .sort((left, right) => left[0] - right[0])
    .map((indexes) => {
      const group = indexes.map((index) => transactions[index]);
      const preferred = group.reduce((current, candidate) => {
        const currentTimestamp = Math.max(
          getTimestampMillis(current.updatedAt),
          getTimestampMillis(current.createdAt),
        );
        const candidateTimestamp = Math.max(
          getTimestampMillis(candidate.updatedAt),
          getTimestampMillis(candidate.createdAt),
        );
        return candidateTimestamp >= currentTimestamp ? candidate : current;
      });
      const statementAttachmentPaths = dedupeStatementPaths(group.flatMap((transaction) => [
        transaction.evidenceUrl,
        ...(transaction.statementAttachmentPaths ?? []),
      ]));
      const statementSourceSha256 = group
        .map((transaction) => normalizeText(transaction.statementSourceSha256))
        .find(Boolean);
      const statementOriginalFileName = group
        .map((transaction) => normalizeText(transaction.statementOriginalFileName))
        .find(Boolean);

      return {
        ...preferred,
        evidenceUrl: preferred.evidenceUrl || statementAttachmentPaths[0],
        statementAttachmentPaths,
        ...(statementSourceSha256 ? { statementSourceSha256 } : {}),
        ...(statementOriginalFileName ? { statementOriginalFileName } : {}),
      };
    });
  const rawImportedTransactions = transactions.filter(isCardStatementImportTransaction);
  const suppressedLedgerIds = new Set<string>();
  const suppressedImportSources = new Set<string>();

  dedupedTransactions.forEach((transaction) => {
    if (!normalizeText(transaction.id).startsWith('card-ledger__')) return;

    const ledgerSourceIdentities = new Set(getCardStatementSourceIdentities(transaction));
    if (ledgerSourceIdentities.size === 0) return;

    const overlappingRawImports = rawImportedTransactions.filter((imported) => (
      normalizeText(imported.cardId) === normalizeText(transaction.cardId)
      && normalizeText(imported.yearMonth) === normalizeText(transaction.yearMonth)
      && normalizeText(imported.category) === normalizeText(transaction.category)
      && haveMatchingCardStatementSources(
        Array.from(ledgerSourceIdentities),
        getCardStatementSourceIdentities(imported),
      )
    ));
    if (overlappingRawImports.length === 0) return;

    const importedTotal = overlappingRawImports.reduce(
      (sum, imported) => sum + (Number(imported.amount) || 0),
      0,
    );
    if (Number(transaction.amount) === importedTotal) {
      suppressedLedgerIds.add(transaction.id);
      return;
    }

    overlappingRawImports.forEach((imported) => {
      getPrimaryCardStatementSourceIdentities(getCardStatementSourceIdentities(imported)).forEach((identity) => suppressedImportSources.add([
        normalizeText(imported.cardId),
        normalizeText(imported.yearMonth),
        normalizeText(imported.category),
        identity,
      ].join('|')));
    });
  });

  return dedupedTransactions.filter((transaction) => {
    if (suppressedLedgerIds.has(transaction.id)) return false;
    if (!isCardStatementImportTransaction(transaction)) return true;

    return !getPrimaryCardStatementSourceIdentities(getCardStatementSourceIdentities(transaction)).some((identity) => suppressedImportSources.has([
      normalizeText(transaction.cardId),
      normalizeText(transaction.yearMonth),
      normalizeText(transaction.category),
      identity,
    ].join('|')));
  });
};
