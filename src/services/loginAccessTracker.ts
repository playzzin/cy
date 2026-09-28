import type { User } from 'firebase/auth';
import type { CreateLoginLogInput } from '../types/loginLog';

type AccessUser = Pick<User, 'uid' | 'email' | 'displayName' | 'photoURL' | 'providerData'>;
type WriteAccessLog = (input: CreateLoginLogInput) => Promise<boolean>;

// One access per authenticated account in this page lifetime. A new tab or
// reload creates a new tracker; auth callbacks and React remounts do not.
export const createLoginAccessTracker = (write: WriteAccessLog) => {
  let recordedUid: string | null = null;
  let observedUser: AccessUser | null = null;
  let interactiveAttempts = 0;
  let version = 0;

  const observe = (user: AccessUser | null): void => {
    observedUser = user;
    if (!user) {
      version++;
      recordedUid = null;
      return;
    }
    if (interactiveAttempts > 0 || recordedUid === user.uid) return;
    recordedUid = user.uid;
    const writeVersion = ++version;
    void write({
      action: 'session_access',
      provider: user.providerData[0]?.providerId || (user.uid === 'dev-admin' ? 'dev-admin' : 'firebase'),
      method: 'session_restore',
      user: { uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL },
    }).catch(() => false).then((saved) => {
      if (!saved && version === writeVersion && recordedUid === user.uid) recordedUid = null;
    });
  };

  return {
    observe,
    beginInteractiveLogin: () => {
      interactiveAttempts++;
      let finished = false;
      return (user?: AccessUser) => {
        if (finished) return;
        finished = true;
        if (user) {
          version++;
          recordedUid = user.uid;
          observedUser = user;
        }
        interactiveAttempts--;
        if (observedUser && interactiveAttempts === 0) observe(observedUser);
      };
    },
  };
};

export const writeAuthLog = async (input: CreateLoginLogInput): Promise<boolean> => {
  try {
    const { loginLogService } = await import('./loginLogService');
    return await loginLogService.safeCreateLog(input);
  } catch {
    console.warn('[LoginAccess] 접속 기록을 저장하지 못했습니다.');
    return false;
  }
};

// Logout must not hang indefinitely when Firestore is offline.
export const writeLogoutLog = async (input: CreateLoginLogInput): Promise<void> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      writeAuthLog(input),
      new Promise<void>((resolve) => { timer = setTimeout(resolve, 2000); }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

export const loginAccessTracker = createLoginAccessTracker(writeAuthLog);
