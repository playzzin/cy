// 급여방식 일괄 업데이트 스크립트
// 이 스크립트를 브라우저 콘솔에서 실행하세요

// 월급제로 변경할 작업자 이름 목록
const toMonthly = [
    '강영호', '강현주', '김명국', '김영금', '문현식', '박상배', '박정현', '신지연',
    '심현태', '이용수', '임채현', '정낙석'
];

// 일급제로 변경할 작업자 이름 목록
const toDaily = [
    // 이미지에서 일급제로 표시된 다른 작업자들
];

// Firebase에서 작업자 데이터 가져오기 및 업데이트
async function updateSalaryModels() {
    const { collection, getDocs, doc, updateDoc } = await import('firebase/firestore');
    const { db } = await import('./config/firebase');

    const workersRef = collection(db, 'workers');
    const snapshot = await getDocs(workersRef);

    let updated = 0;

    for (const workerDoc of snapshot.docs) {
        const worker = workerDoc.data();
        const name = worker.name;

        if (toMonthly.includes(name) && worker.salaryModel !== '월급제') {
            await updateDoc(doc(db, 'workers', workerDoc.id), {
                salaryModel: '월급제'
            });
            console.log(`✅ ${name}: ${worker.salaryModel} → 월급제`);
            updated++;
        } else if (toDaily.includes(name) && worker.salaryModel !== '일급제') {
            await updateDoc(doc(db, 'workers', workerDoc.id), {
                salaryModel: '일급제'
            });
            console.log(`✅ ${name}: ${worker.salaryModel} → 일급제`);
            updated++;
        }
    }

    console.log(`\n총 ${updated}명의 급여방식이 업데이트되었습니다.`);
}

updateSalaryModels();
