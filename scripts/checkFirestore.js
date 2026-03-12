// scripts/checkFirestore.js
// 실행: node scripts/checkFirestore.js
const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'cyee-9c1e4'
});

const db = admin.firestore();

async function check() {
    // 1. sites 컬렉션
    console.log('\n=== sites 컬렉션 ===');
    const sites = await db.collection('sites').limit(10).get();
    if (sites.empty) {
        console.log('❌ sites 컬렉션이 비어있습니다 (데이터 없음)');
    } else {
        console.log(`✅ sites 컬렉션: ${sites.size}개 이상 문서 존재`);
        sites.docs.forEach(d => console.log(`  - ${d.id}: ${d.data().name}`));
    }

    // 2. settings 컬렉션 (메뉴 데이터)
    console.log('\n=== settings 컬렉션 ===');
    const settings = await db.collection('settings').limit(10).get();
    if (settings.empty) {
        console.log('❌ settings 컬렉션이 비어있습니다 (메뉴 설정 없음)');
    } else {
        console.log(`✅ settings 컬렉션: ${settings.size}개 문서`);
        settings.docs.forEach(d => console.log(`  - ${d.id}`));
    }

    // 3. teams 컬렉션
    console.log('\n=== teams 컬렉션 ===');
    const teams = await db.collection('teams').limit(5).get();
    if (teams.empty) {
        console.log('❌ teams 컬렉션 비어있음');
    } else {
        console.log(`✅ teams: ${teams.size}개 이상`);
        teams.docs.forEach(d => console.log(`  - ${d.id}: ${d.data().name}`));
    }

    // 4. companies 컬렉션
    console.log('\n=== companies 컬렉션 ===');
    const companies = await db.collection('companies').limit(5).get();
    if (companies.empty) {
        console.log('❌ companies 컬렉션 비어있음');
    } else {
        console.log(`✅ companies: ${companies.size}개 이상`);
        companies.docs.forEach(d => console.log(`  - ${d.id}: ${d.data().name}`));
    }

    console.log('\n=== 완료 ===');
    process.exit(0);
}

check().catch(err => {
    console.error('오류 발생:', err.message);
    process.exit(1);
});
