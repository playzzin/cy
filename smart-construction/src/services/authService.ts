import { GoogleAuthProvider, signInWithPopup, User, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { manpowerService, Worker } from './manpowerService';

export interface AuthResult {
  user: User | null;
  worker: Worker | null;
  isNewUser: boolean;
  needsApproval: boolean;
}

const provider = new GoogleAuthProvider();
provider.addScope('email');
provider.addScope('profile');

export const authService = {
  // Google 로그인 및 Worker 매칭
  signInWithGoogle: async (): Promise<AuthResult> => {
    try {
      // 1. Google 로그인
      const result = await signInWithPopup(auth, provider);
      const { user } = result;

      if (!user.email) {
        throw new Error('이메일 정보를 가져올 수 없습니다.');
      }

      // 2. 이메일로 Worker 조회 시도
      let worker = await manpowerService.getWorkerByEmail(user.email);
      let isNewUser = false;
      let needsApproval = false;

      // 3. Worker가 없는 경우 새로 생성
      if (!worker) {
        // Generate a temporary ID number (you might want to implement a better ID generation logic)
        const tempIdNumber = `TEMP-${Date.now()}`;

        const workerData: Omit<Worker, 'id'> = {
          name: user.displayName || user.email.split('@')[0],
          idNumber: tempIdNumber, // Required field
          email: user.email,
          uid: user.uid,
          status: '대기중',
          teamType: '미배정',
          unitPrice: 0,
        };

        const workerId = await manpowerService.addWorker(workerData);
        worker = { ...workerData, id: workerId };
        isNewUser = true;
        needsApproval = true; // 새로 생성된 사용자는 승인 필요
      } else if (worker.uid && worker.uid !== user.uid) {
        // 4. 다른 UID로 이미 등록된 이메일인 경우
        throw new Error('이미 다른 계정에 등록된 이메일입니다.');
      } else if (!worker.uid) {
        // 5. 기존 Worker에 UID 연결
        await manpowerService.updateWorker(worker.id!, { uid: user.uid });
        worker.uid = user.uid;
      }

      return {
        user,
        worker,
        isNewUser,
        needsApproval: needsApproval || (worker?.needsApproval ?? false)
      };
    } catch (error) {
      console.error('로그인 실패:', error);
      throw error;
    }
  },

  // 로그아웃
  signOut: async (): Promise<void> => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('로그아웃 실패:', error);
      throw error;
    }
  },

  // 현재 사용자 확인
  getCurrentUser: (): User | null => {
    return auth.currentUser;
  },

  // Worker 정보 가져오기
  getCurrentWorker: async (): Promise<Worker | null> => {
    const user = auth.currentUser;
    if (!user) return null;

    try {
      // 1. UID로 조회 시도
      let worker = await manpowerService.getWorkerByUid(user.uid);

      // 2. UID로 찾지 못한 경우 이메일로 재시도 (이전에 등록된 계정 대응)
      if (!worker && user.email) {
        worker = await manpowerService.getWorkerByEmail(user.email);

        // 3. 이메일로 찾은 경우 UID 업데이트
        if (worker) {
          await manpowerService.updateWorker(worker.id!, { uid: user.uid });
        }
      }

      return worker;
    } catch (error) {
      console.error('사용자 정보 조회 실패:', error);
      return null;
    }
  }
};

// 인증 상태 변경 리스너
export const onAuthStateChanged = (callback: (user: User | null) => void) => {
  return auth.onAuthStateChanged(callback);
};
