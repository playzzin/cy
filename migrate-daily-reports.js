// 데이터 마이그레이션 스크립트: dailyReports -> daily_reports
// Firebase Console에서 실행하거나 Cloud Function으로 실행

import { db } from '../config/firebase';
import { collection, getDocs, addDoc, doc, setDoc, query, orderBy } from 'firebase/firestore';

async function migrateDailyReports() {
    try {
        console.log('데이터 마이그레이션 시작: dailyReports -> daily_reports');
        
        // 1. 기존 dailyReports 컬렉션에서 모든 데이터 가져오기
        const oldCollectionRef = collection(db, 'dailyReports');
        const q = query(oldCollectionRef, orderBy('date', 'desc'));
        const snapshot = await getDocs(q);
        
        console.log(`총 ${snapshot.size}개 문서 발견`);
        
        let migratedCount = 0;
        let errorCount = 0;
        
        // 2. 각 문서를 새 컬렉션으로 복사
        for (const docSnap of snapshot.docs) {
            try {
                const data = docSnap.data();
                const newDocRef = doc(collection(db, 'daily_reports'), docSnap.id);
                
                // 새 컬렉션에 동일한 ID로 문서 생성
                await setDoc(newDocRef, {
                    ...data,
                    migratedAt: new Date(),
                    migrationNote: 'Migrated from dailyReports collection'
                });
                
                migratedCount++;
                console.log(`마이그레이션 완료: ${docSnap.id}`);
                
            } catch (error) {
                errorCount++;
                console.error(`문서 마이그레이션 실패 (${docSnap.id}):`, error);
            }
        }
        
        console.log(`마이그레이션 완료:`);
        console.log(`- 성공: ${migratedCount}개`);
        console.log(`- 실패: ${errorCount}개`);
        
        // 3. 검증: 새 컬렉션 데이터 확인
        const newCollectionRef = collection(db, 'daily_reports');
        const newSnapshot = await getDocs(newCollectionRef);
        console.log(`새 컬렉션 총 문서 수: ${newSnapshot.size}`);
        
        return { migratedCount, errorCount, total: snapshot.size };
        
    } catch (error) {
        console.error('마이그레이션 중 오류 발생:', error);
        throw error;
    }
}

// 마이그레이션 실행
migrateDailyReports()
    .then(result => {
        console.log('마이그레이션 결과:', result);
        alert(`마이그레이션 완료!\n성공: ${result.migratedCount}개\n실패: ${result.errorCount}개`);
    })
    .catch(error => {
        console.error('마이그레이션 실패:', error);
        alert('마이그레이션 실패. 콘솔을 확인하세요.');
    });

// 사용 방법:
// 1. Firebase Console > Functions에서 새 Cloud Function 생성
// 2. 위 코드를 복사하여 붙여넣기
// 3. Function 배포 및 실행
// 4. 또는 로컬에서 Firebase CLI로 실행: firebase functions:shell

// 마이그레이션 후 확인사항:
// 1. daily_reports 컬렉션에 데이터가 모두 이전되었는지 확인
// 2. 데이터 형식이 올바른지 확인
// 3. 앱이 정상적으로 동작하는지 테스트
// 4. 문제가 없으면 dailyReports 컬렉션 삭제 (Firebase Console에서 수동)
