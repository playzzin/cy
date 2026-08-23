import type {
  IdentityDocumentAnalysis,
  IdentityPersonGroup,
} from '../types/identityBundle';

const normalizeName = (value: string): string =>
  String(value || '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^0-9A-Z\uAC00-\uD7A3]/g, '');

const normalizeBirthDate = (value: string): string =>
  String(value || '').replace(/[^0-9]/g, '').slice(0, 8);

const unique = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

export const buildIdentityPersonGroups = (
  documents: IdentityDocumentAnalysis[],
): IdentityPersonGroup[] => {
  const birthDatesByName = new Map<string, Set<string>>();
  documents.forEach((document) => {
    const name = normalizeName(document.personName);
    const birthDate = normalizeBirthDate(document.birthDate);
    if (!name || !birthDate) return;
    const dates = birthDatesByName.get(name) || new Set<string>();
    dates.add(birthDate);
    birthDatesByName.set(name, dates);
  });
  const parent = documents.map((_, index) => index);
  const find = (index: number): number => {
    if (parent[index] !== index) parent[index] = find(parent[index]);
    return parent[index];
  };
  const union = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
  };

  documents.forEach((left, leftIndex) => {
    documents.slice(leftIndex + 1).forEach((right, offset) => {
      const rightIndex = leftIndex + offset + 1;
      const sameProtectedIdentifier = Boolean(
        left.identityHash && right.identityHash && left.identityHash === right.identityHash,
      );
      const leftName = normalizeName(left.personName);
      const rightName = normalizeName(right.personName);
      const leftBirth = normalizeBirthDate(left.birthDate);
      const rightBirth = normalizeBirthDate(right.birthDate);
      const sameName = Boolean(leftName && rightName && leftName === rightName);
      const birthDatesCompatible = !leftBirth || !rightBirth || leftBirth === rightBirth;
      const hasNameCollision = (birthDatesByName.get(leftName)?.size || 0) > 1;
      const safeNameMatch = sameName && (
        (!hasNameCollision && birthDatesCompatible)
        || Boolean(leftBirth && rightBirth && leftBirth === rightBirth)
        || Boolean(!leftBirth && !rightBirth)
      );

      if (sameProtectedIdentifier || safeNameMatch) {
        union(leftIndex, rightIndex);
      }
    });
  });

  const clustered = new Map<number, IdentityDocumentAnalysis[]>();
  documents.forEach((document, index) => {
    const root = find(index);
    clustered.set(root, [...(clustered.get(root) || []), document]);
  });

  return Array.from(clustered.values())
    .map((groupDocuments) => {
      const sorted = [...groupDocuments].sort((a, b) => a.fileIndex - b.fileIndex);
      const bestNamed = [...sorted]
        .filter((document) => document.personName)
        .sort((a, b) => b.matchingConfidence - a.matchingConfidence)[0];
      const personName = bestNamed?.personName || `이름 미확인 ${sorted[0].fileIndex + 1}`;
      const birthDate = sorted.find((document) => document.birthDate)?.birthDate || '';
      const identityHash = sorted.find((document) => document.identityHash)?.identityHash || '';
      const normalizedPersonName = normalizeName(personName);
      const ambiguousNameOnlyDocument = (birthDatesByName.get(normalizedPersonName)?.size || 0) > 1
        && sorted.some((document) => !normalizeBirthDate(document.birthDate));
      const reviewReasons = unique([
        ...sorted.flatMap((document) => document.warnings || []),
        ...sorted
          .filter((document) => !document.personName)
          .map(() => '이름을 읽지 못한 문서가 있습니다.'),
        ...sorted
          .filter((document) => document.matchingConfidence < 0.72)
          .map(() => '동일인 판별 신뢰도가 낮은 문서가 있습니다.'),
        ...(ambiguousNameOnlyDocument ? ['같은 이름의 서로 다른 생년월일이 있어 생년월일 없는 문서를 별도 확인해야 합니다.'] : []),
      ]);

      return {
        id: `person-${sorted[0].fileIndex}`,
        personName,
        birthDate,
        identityHash,
        documents: sorted,
        requiresReview: reviewReasons.length > 0,
        reviewReasons,
      };
    })
    .sort((left, right) => left.documents[0].fileIndex - right.documents[0].fileIndex);
};

export const formatIdentityBirthDate = (value: string): string => {
  const digits = normalizeBirthDate(value);
  if (digits.length !== 8) return value;
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
};

export const sanitizeIdentityBundleFileName = (value: string): string => {
  const safe = String(value || '')
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 50);
  return safe || '이름미확인';
};

export const createUniqueIdentityBundleFileName = (
  personName: string,
  usedNames: Map<string, number>,
  prefix = '',
): string => {
  const baseName = `${prefix}${sanitizeIdentityBundleFileName(personName)}_신분증묶음`;
  const nextCount = (usedNames.get(baseName) || 0) + 1;
  usedNames.set(baseName, nextCount);
  return `${baseName}${nextCount > 1 ? `_${nextCount}` : ''}.jpg`;
};

const escapeCsvCell = (value: unknown): string => {
  let text = String(value ?? '').replace(/\r?\n/g, ' ');
  if (/^[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

export const buildIdentityBundleManifestCsv = (
  rows: Array<{
    personName: string;
    documentCount: number;
    confirmed: boolean;
    outputFileName: string;
    originalFileNames: string[];
  }>,
): string => {
  const header = ['이름', '문서 수', '동일인 확인', '결과 파일', '원본 파일'];
  const body = rows.map((row) => [
    row.personName,
    row.documentCount,
    row.confirmed ? '확인 완료' : '미확인',
    row.outputFileName,
    row.originalFileNames.join(' | '),
  ]);
  return `\uFEFF${[header, ...body].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')}`;
};
