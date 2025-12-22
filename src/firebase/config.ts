// Firebase 앱 초기화
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase 구성
const firebaseConfig = {
  apiKey: "AIzaSyBzzdXym0KRhQzV2VGayUXAzFGMJkr9iAA",
  authDomain: "cyee-9c1e4.firebaseapp.com",
  projectId: "cyee-9c1e4",
  storageBucket: "cyee-9c1e4.firebasestorage.app",
  messagingSenderId: "634044012902",
  appId: "1:634044012902:web:636c6f88381331b7c0d0a7",
  measurementId: "G-0FKCLERYS2"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// 서비스 초기화
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// analytics는 브라우저 환경에서만 초기화
let analytics: any;
if (typeof window !== 'undefined') {
  const { getAnalytics } = require("firebase/analytics");
  analytics = getAnalytics(app);
}

export { app, analytics };
