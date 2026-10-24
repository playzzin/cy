import { collection, getDocs, limit, orderBy, query, startAfter, Timestamp, where,
  type QueryConstraint, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { activityRange, normalizeActivity, type ActivityRecord } from './activityModel';
import type { ActivitySource } from './activitySources';

export const ACTIVITY_PAGE_SIZE = 50;
export interface ActivityFilter { from: string; to: string; actorId: string }
export type ActivityCursor = QueryDocumentSnapshot<DocumentData>;
export interface ActivityPage { records: ActivityRecord[]; cursor: ActivityCursor | null; hasMore: boolean }

export async function fetchActivityPage(source: ActivitySource, filter: ActivityFilter, cursor?: ActivityCursor | null): Promise<ActivityPage> {
  if (source.id === 'ai') throw new Error('AI 사용량 전용 조회를 이용해 주세요.');
  const { start, end } = activityRange(filter.from, filter.to);
  const date = (millis: number) => source.timeField === 'timestamp' ? new Date(millis).toISOString() : Timestamp.fromMillis(millis);
  const constraints: QueryConstraint[] = [
    where(source.timeField, '>=', date(start)), where(source.timeField, '<', date(end)),
    orderBy(source.timeField, 'desc'), limit(ACTIVITY_PAGE_SIZE),
  ];
  if (source.category) constraints.push(where('category', '==', source.category));
  if (filter.actorId) constraints.push(where(source.actorField, '==', filter.actorId));
  if (cursor) constraints.push(startAfter(cursor));
  // Never fall back to a collection scan on missing indexes or permission errors.
  // Snapshot cursors preserve sub-millisecond precision and the document-id tie break.
  const snapshot = await getDocs(query(collection(db, source.collection), ...constraints));
  return {
    records: snapshot.docs.map(doc => normalizeActivity(doc.id, doc.data(), source)),
    cursor: snapshot.docs[snapshot.docs.length - 1] || null,
    hasMore: snapshot.docs.length === ACTIVITY_PAGE_SIZE,
  };
}

export function activityErrorMessage(error: unknown): string {
  const code = String((error as { code?: unknown })?.code || '');
  if (code.includes('permission-denied')) return '이 기록을 조회할 권한이 없습니다.';
  if (code.includes('failed-precondition')) return '조회 인덱스 준비가 필요합니다. 관리자에게 문의해 주세요.';
  return '내역을 불러오지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.';
}
