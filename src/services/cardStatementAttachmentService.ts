import { getBlob, getDownloadURL, ref } from 'firebase/storage';
import { storage } from '../config/firebase';

export interface CardStatementAttachmentLink {
  url: string;
  release: () => void;
}

export const getCardStatementFileName = (path: string): string => {
  let value = path.trim();
  try {
    if (/^https?:\/\//i.test(value)) {
      const url = new URL(value);
      value = url.pathname.includes('/o/') ? url.pathname.split('/o/').slice(1).join('/o/') : url.pathname;
    }
    value = decodeURIComponent(value);
  } catch { /* A malformed filename must not prevent selecting another file. */ }
  return value.split('/').filter(Boolean).pop() || '청구서 파일';
};

export const getCardStatementAttachmentError = (error: unknown): string => {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'storage/object-not-found': return '원본 파일을 찾을 수 없습니다. 업로드 내역의 원본이나 다시 등록한 파일을 확인해 주세요.';
    case 'storage/unauthenticated': return '로그인 인증을 확인할 수 없습니다. 다시 로그인한 뒤 원본 파일을 열어 주세요.';
    case 'storage/unauthorized': return '현재 로그인 상태로 원본 파일을 열 수 없습니다. 실제 계정으로 다시 로그인한 뒤 시도해 주세요.';
    case 'storage/retry-limit-exceeded': return '파일 서버 연결이 지연되고 있습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.';
    case 'attachment/invalid-path':
    case 'storage/invalid-url':
    case 'storage/invalid-argument': return '파일 연결 주소가 올바르지 않습니다. 업로드 내역에서 원본 파일을 확인해 주세요.';
    default: return '원본 파일을 불러오지 못했습니다. 연결 상태와 로그인 상태를 확인한 뒤 다시 시도해 주세요.';
  }
};

export const cardStatementAttachmentService = {
  async resolve(path: string): Promise<CardStatementAttachmentLink> {
    const value = path.trim();
    const invalid = () => Object.assign(new Error('Invalid statement attachment path'), { code: 'attachment/invalid-path' });
    if (!value || Array.from(value).some(character => character.charCodeAt(0) < 32)) throw invalid();
    if (/^https?:\/\//i.test(value)) {
      let url: URL;
      try { url = new URL(value); } catch { throw invalid(); }
      if (url.username || url.password || (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw invalid();
      // An unsigned Firebase media URL still needs the current user's auth.
      // Opening it directly in a tab omits that auth and can show access denied.
      const isUnsignedFirebaseObject = url.hostname === 'firebasestorage.googleapis.com'
        && /^\/v\d+\/b\/[^/]+\/o\/.+/.test(url.pathname)
        && !url.searchParams.get('token')
        && !url.searchParams.get('X-Goog-Signature')
        && !url.searchParams.get('Signature');
      // Preserve existing token/signed links and external evidence URLs.
      if (!isUnsignedFirebaseObject) return { url: url.href, release: () => undefined };
    } else if ((/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.startsWith('gs://')) || value.startsWith('//')) throw invalid();
    const objectRef = ref(storage, value);
    try {
      return { url: await getDownloadURL(objectRef), release: () => undefined };
    } catch (error) {
      if ((error as { code?: string })?.code !== 'storage/no-download-url') throw error;
      // Private imports can lack a download token. Read them with the current
      // user's existing Storage permissions; never change metadata or rules.
      const blob = await getBlob(objectRef);
      const url = URL.createObjectURL(blob);
      return { url, release: () => URL.revokeObjectURL(url) };
    }
  },
};
