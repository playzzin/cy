import { db } from '../config/firebase';
import {
  Timestamp,
  arrayUnion,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Query,
  type QuerySnapshot,
  type Unsubscribe
} from 'firebase/firestore';
import type {
  CreateErpMessageInput,
  ErpMessage,
  ErpMessageSummary
} from '../types/erpMessage';

const COLLECTION_NAME = 'erp_messages';
const DEFAULT_CATEGORY = '업무';

const safeReadAtKey = (uid: string): string =>
  uid.replace(/[^a-zA-Z0-9_-]/g, '_');

const asTimestamp = (value: unknown, fallback = Timestamp.now()): Timestamp => {
  if (value instanceof Timestamp) return value;
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return Timestamp.fromDate((value as { toDate: () => Date }).toDate());
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return Timestamp.fromDate(date);
  }
  return fallback;
};

const timestampMillis = (value?: Timestamp | null): number =>
  value ? value.toMillis() : 0;

const uniqueStrings = (values: unknown[] = []): string[] =>
  Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));

const deriveTitleFromBody = (body: string): string => {
  const firstLine = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return (firstLine || '메시지').slice(0, 80);
};

const normalizeMessage = (id: string, data: DocumentData): ErpMessage => {
  const now = Timestamp.now();

  return {
    id,
    type: data.type || 'direct',
    title: String(data.title || ''),
    body: String(data.body || ''),
    category: String(data.category || DEFAULT_CATEGORY),
    priority: data.priority || 'normal',
    status: data.status || 'active',
    senderId: String(data.senderId || ''),
    senderName: String(data.senderName || '알 수 없음'),
    senderEmail: data.senderEmail ?? null,
    recipientScope: data.recipientScope || 'users',
    recipientIds: uniqueStrings(data.recipientIds || []),
    recipientNames: uniqueStrings(data.recipientNames || []),
    readBy: uniqueStrings(data.readBy || []),
    readAtBy: (data.readAtBy || {}) as ErpMessage['readAtBy'],
    pinned: Boolean(data.pinned),
    actionLabel: data.actionLabel ? String(data.actionLabel) : null,
    actionUrl: data.actionUrl ? String(data.actionUrl) : null,
    createdAt: asTimestamp(data.createdAt, now),
    updatedAt: asTimestamp(data.updatedAt, now),
    expiresAt: data.expiresAt ? asTimestamp(data.expiresAt) : null
  };
};

const sortMessages = (messages: ErpMessage[]): ErpMessage[] =>
  [...messages].sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    return timestampMillis(right.createdAt) - timestampMillis(left.createdAt);
  });

const isActiveMessage = (message: ErpMessage): boolean => {
  if (message.status === 'archived') return false;
  if (message.expiresAt && message.expiresAt.toMillis() < Date.now()) return false;
  return true;
};

const publishMergedSnapshots = (
  snapshots: Array<QuerySnapshot<DocumentData> | null>,
  callback: (messages: ErpMessage[]) => void,
  limitCount?: number
) => {
  const merged = new Map<string, ErpMessage>();

  snapshots.forEach((snapshot) => {
    snapshot?.docs.forEach((docSnap) => {
      const message = normalizeMessage(docSnap.id, docSnap.data());
      if (isActiveMessage(message)) merged.set(message.id, message);
    });
  });

  const messages = sortMessages(Array.from(merged.values()));
  callback(typeof limitCount === 'number' ? messages.slice(0, limitCount) : messages);
};

const subscribeMergedQueries = (
  queries: Query<DocumentData>[],
  callback: (messages: ErpMessage[]) => void,
  onError?: (error: Error) => void,
  limitCount?: number
): Unsubscribe => {
  const snapshots: Array<QuerySnapshot<DocumentData> | null> = queries.map(() => null);

  const unsubscribes = queries.map((messageQuery, index) =>
    onSnapshot(
      messageQuery,
      (snapshot) => {
        snapshots[index] = snapshot;
        publishMergedSnapshots(snapshots, callback, limitCount);
      },
      (error) => {
        console.error('[messageService] subscription failed:', error);
        onError?.(error);
      }
    )
  );

  return () => {
    unsubscribes.forEach((unsubscribe) => unsubscribe());
  };
};

const isReadBy = (message: ErpMessage, uid: string): boolean =>
  message.readBy.includes(uid);

const buildSummary = (uid: string, messages: ErpMessage[]): ErpMessageSummary => {
  const unreadMessages = messages.filter((message) => !isReadBy(message, uid));

  return {
    total: messages.length,
    unread: unreadMessages.length,
    urgentUnread: unreadMessages.filter((message) => message.priority === 'urgent' || message.priority === 'high').length,
    latest: messages[0]
  };
};

export const messageService = {
  collectionName: COLLECTION_NAME,

  getReadAtKey: safeReadAtKey,

  isReadBy,

  getReadAt: (message: ErpMessage, uid: string): Timestamp | undefined => {
    return message.readAtBy?.[safeReadAtKey(uid)];
  },

  buildSummary,

  createMessage: async (input: CreateErpMessageInput): Promise<string> => {
    const body = input.body.trim();
    const title = input.title?.trim() || deriveTitleFromBody(body);
    const recipientIds = uniqueStrings(input.recipientIds || []);
    const recipientNames = uniqueStrings(input.recipientNames || []);

    if (!input.senderId) throw new Error('sender-required');
    if (!body) throw new Error('body-required');
    if (input.recipientScope === 'users' && recipientIds.length === 0) {
      throw new Error('recipient-required');
    }

    const now = Timestamp.now();
    const messageRef = doc(collection(db, COLLECTION_NAME));
    const initialReadBy = input.senderId ? [input.senderId] : [];
    const readAtBy = input.senderId ? { [safeReadAtKey(input.senderId)]: now } : {};

    await setDoc(messageRef, {
      type: input.type,
      title,
      body,
      category: input.category?.trim() || DEFAULT_CATEGORY,
      priority: input.priority || 'normal',
      status: 'active',
      senderId: input.senderId,
      senderName: input.senderName || '알 수 없음',
      senderEmail: input.senderEmail ?? null,
      recipientScope: input.recipientScope,
      recipientIds,
      recipientNames,
      readBy: initialReadBy,
      readAtBy,
      pinned: Boolean(input.pinned),
      actionLabel: input.actionLabel?.trim() || null,
      actionUrl: input.actionUrl?.trim() || null,
      createdAt: now,
      updatedAt: now,
      expiresAt: input.expiresAt || null
    });

    return messageRef.id;
  },

  subscribeInbox: (
    uid: string,
    callback: (messages: ErpMessage[]) => void,
    onError?: (error: Error) => void,
    limitCount?: number
  ): Unsubscribe => {
    const directQuery = query(
      collection(db, COLLECTION_NAME),
      where('recipientIds', 'array-contains', uid)
    );
    const broadcastQuery = query(
      collection(db, COLLECTION_NAME),
      where('recipientScope', '==', 'all')
    );

    return subscribeMergedQueries([directQuery, broadcastQuery], callback, onError, limitCount);
  },

  subscribeSent: (
    uid: string,
    callback: (messages: ErpMessage[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe => {
    const sentQuery = query(collection(db, COLLECTION_NAME), where('senderId', '==', uid));

    return onSnapshot(
      sentQuery,
      (snapshot) => {
        callback(sortMessages(snapshot.docs.map((docSnap) => normalizeMessage(docSnap.id, docSnap.data()))));
      },
      (error) => {
        console.error('[messageService] sent subscription failed:', error);
        onError?.(error);
      }
    );
  },

  subscribeAllMessages: (
    callback: (messages: ErpMessage[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe => {
    return onSnapshot(
      collection(db, COLLECTION_NAME),
      (snapshot) => {
        callback(sortMessages(snapshot.docs.map((docSnap) => normalizeMessage(docSnap.id, docSnap.data()))));
      },
      (error) => {
        console.error('[messageService] all subscription failed:', error);
        onError?.(error);
      }
    );
  },

  getRecentMessages: async (limitCount = 50): Promise<ErpMessage[]> => {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    return sortMessages(snapshot.docs.map((docSnap) => normalizeMessage(docSnap.id, docSnap.data()))).slice(0, limitCount);
  },

  markAsRead: async (messageId: string, uid: string): Promise<void> => {
    if (!messageId || !uid) return;

    const now = Timestamp.now();
    await updateDoc(doc(db, COLLECTION_NAME, messageId), {
      readBy: arrayUnion(uid),
      [`readAtBy.${safeReadAtKey(uid)}`]: now,
      updatedAt: now
    });
  },

  markAllAsRead: async (messages: ErpMessage[], uid: string): Promise<void> => {
    if (!uid) return;

    const unreadMessages = messages.filter((message) => !message.readBy.includes(uid)).slice(0, 450);
    if (unreadMessages.length === 0) return;

    const batch = writeBatch(db);
    const now = Timestamp.now();

    unreadMessages.forEach((message) => {
      batch.update(doc(db, COLLECTION_NAME, message.id), {
        readBy: arrayUnion(uid),
        [`readAtBy.${safeReadAtKey(uid)}`]: now,
        updatedAt: now
      });
    });

    await batch.commit();
  },

  archiveMessage: async (messageId: string): Promise<void> => {
    await updateDoc(doc(db, COLLECTION_NAME, messageId), {
      status: 'archived',
      updatedAt: Timestamp.now()
    });
  }
};
