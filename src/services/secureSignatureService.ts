import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../config/firebase';

export function signatureStoragePath(source: string): string | null {
  if (source.startsWith('gs://')) {
    const path = source.slice(5).split('/').slice(1).join('/');
    return path.startsWith('signatures/') ? path : null;
  }
  try {
    const url = new URL(source);
    if (url.hostname !== 'firebasestorage.googleapis.com') return null;
    const path = decodeURIComponent(url.pathname.split('/o/')[1] || '');
    return path.startsWith('signatures/') ? path : null;
  } catch { return null; }
}
const pending = new Map<string, Promise<string>>();
let activeReads = 0;
const waiting: Array<() => void> = [];
function readSignature(uid: string, path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const start = () => {
      activeReads++;
      const read = async () => {
        for (let attempt = 0; ; attempt++) {
          if (auth.currentUser?.uid !== uid) throw new Error('로그인 계정이 변경되었습니다.');
          try {
            const result = await httpsCallable<{ action: string; path: string }, { dataUrl: string }>(functions, 'workerSignatures')({ action: 'read', path });
            if (auth.currentUser?.uid !== uid) throw new Error('로그인 계정이 변경되었습니다.');
            return result.data.dataUrl;
          } catch (error) {
            if (attempt >= 2 || !['functions/resource-exhausted', 'functions/unavailable'].includes((error as { code?: string }).code || '')) throw error;
            await new Promise(done => setTimeout(done, 500 * (attempt + 1)));
          }
        }
      };
      void read().then(resolve, reject).finally(() => { activeReads--; waiting.shift()?.(); });
    };
    if (activeReads < 2) start(); else waiting.push(start);
  });
}
export async function resolveSecureSignature(source: string): Promise<string> {
  const path = signatureStoragePath(source);
  if (!path) return source;
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('서명을 보려면 로그인해 주세요.');
  const key = `${uid}:${path}`;
  let request = pending.get(key);
  if (!request) {
    request = readSignature(uid, path);
    pending.set(key, request);
  }
  try { return await request; } finally { if (pending.get(key) === request) pending.delete(key); }
}
