import assert from 'node:assert/strict';
import { initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, terminate } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, ref, getBytes, uploadBytes, deleteObject } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
const projectId = process.env.GCLOUD_PROJECT;
assert.ok(projectId?.startsWith('demo-'));
for (const key of ['FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST']) assert.ok(process.env[key], key);
const storageBucket = `${projectId}.appspot.com`;
const adminApp = initializeAdminApp({ projectId, storageBucket });
const adminAuth = getAdminAuth(adminApp), db = getAdminFirestore(adminApp), bucket = getAdminStorage(adminApp).bucket();
const clients = [];
async function client(uid, claims = {}) {
    const app = initializeApp({ projectId, storageBucket, apiKey: 'demo-key' }, `preview-test-${clients.length}`);
    const auth = getAuth(app); connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
    await signInWithCustomToken(auth, await adminAuth.createCustomToken(uid, claims));
    const firestore = getFirestore(app); const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':'); connectFirestoreEmulator(firestore, host, Number(port));
    const storage = getStorage(app); const [sh, sp] = process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(':'); connectStorageEmulator(storage, sh, Number(sp));
    const functions = getFunctions(app, 'asia-northeast3'); connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    const result = { app, auth, db: firestore, storage, functions }; clients.push(result); return result;
}
const previewClaims = (target, changes = {}) => ({ devPreview:true, previewActorUid:'dev-fixture', previewTargetUid:target, previewDevRole:'DEV', previewExpiresAt:Math.floor(Date.now()/1000)+600, ...changes });
let checks = 0;
async function denied(work, code = 'permission-denied') { await assert.rejects(work, error => String(error.code).endsWith(code)); checks++; }
try {
    await Promise.all(['dev-fixture','leader-a','leader-b','worker-a'].map(async uid => {
        try { await adminAuth.createUser({ uid, email:`${uid}@example.test`, password:'Preview-demo-2026!' }); } catch(error) { if(error.code!=='auth/uid-already-exists') throw error; }
    }));
    const positionConfig = [{id:'dev',name:'DEV',icon:'fa-code',color:'blue'},{id:'lead',name:'팀장',icon:'fa-users',color:'teal'},{id:'worker',name:'작업자',icon:'fa-user',color:'gray'},{id:'empty',name:'미연결 직책',icon:'fa-user',color:'gray'}];
    const menu = [{id:'dashboard',text:'홈',path:'/dashboard'},{id:'work',text:'근무내역',path:'/manpower/team-worker-detail?section=work'}];
    const fixtures = {
        'users/dev-fixture':{status:'active',role:'admin',position:'DEV',displayName:'검증 DEV',accountType:'office'},
        'users/leader-a':{status:'active',role:'user',position:'팀장',displayName:'검증 팀장 A',linkedWorkerIds:['wa'],accountType:'worker'},
        'users/leader-b':{status:'active',role:'user',position:'팀장',displayName:'검증 팀장 B',linkedWorkerIds:['wb'],accountType:'worker'},
        'users/worker-a':{status:'active',role:'user',position:'작업자',displayName:'검증 작업자 A',linkedWorkerIds:['wc'],accountType:'worker'},
        'workers/wa':{uid:'leader-a',name:'검증 팀장 A',role:'팀장',teamId:'ta',teamName:'검증 A팀',status:'재직',isActive:true},
        'workers/wb':{uid:'leader-b',name:'검증 팀장 B',role:'팀장',teamId:'tb',teamName:'검증 B팀',status:'재직',isActive:true},
        'workers/wc':{uid:'worker-a',name:'검증 작업자 A',role:'작업자',teamId:'ta',teamName:'검증 A팀',status:'재직',isActive:true},
        'teams/ta':{name:'검증 A팀',isActive:true},'teams/tb':{name:'검증 B팀',isActive:true},
        'sites/sa':{name:'검증 A현장',code:'SA',responsibleTeamId:'ta',companyId:'ca',privateMemo:'not-for-worker'},
        'sites/sb':{name:'검증 B현장',code:'SB',responsibleTeamId:'tb'},
        'companies/ca':{name:'검증 회사',type:'시공사',accountNumber:'not-for-worker'},
        'daily_reports/mixed':{date:'2026-10-17',teamId:'ta',siteId:'sa',memo:'not-for-worker',workers:[{workerId:'wa',manDay:1,unitPrice:500},{workerId:'wc',manDay:1,unitPrice:100}]},
        'advance_requests/own':{workerId:'wc',yearMonth:'2026-10',requestedAmount:10},
        'advance_requests/other':{workerId:'wa',yearMonth:'2026-10',requestedAmount:20},
        'settings/menus_v12':{admin:{name:'관리',icon:'',menu,positionConfig},pos_dev:{name:'DEV',icon:'',menu:[{id:'settings',text:'메뉴 관리',path:'/admin/menu-manager'}]},pos_lead:{name:'팀장',icon:'',menu},pos_worker:{name:'작업자',icon:'',menu:[{id:'worker_home',text:'작업자 홈',path:'/worker/home'}]},pos_empty:{name:'미연결 직책',icon:'',menu:[]}},
        'settings/system_config':{},
    };
    for (const [path,data] of Object.entries(fixtures)) await db.doc(path).set(data);
    await bucket.file('profiles/leader-a/avatar.png').save(Buffer.from('fixture'),{metadata:{contentType:'image/png'}});
    const a = await client('cy-preview-rules-a',previewClaims('leader-a'));
    assert.equal((await getDoc(doc(a.db,'users','leader-a'))).data().displayName,'검증 팀장 A'); checks++;
    assert.equal((await getDoc(doc(a.db,'workers','wa'))).data().teamId,'ta'); checks++;
    await denied(getDoc(doc(a.db,'users','dev-fixture')));
    await denied(getDoc(doc(a.db,'workers','wb')));
    await denied(setDoc(doc(a.db,'users','leader-a'),{displayName:'changed'},{merge:true}));
    await denied(setDoc(doc(a.db,'login_logs','preview-test'),{uid:'leader-a'}));
    await denied(deleteDoc(doc(a.db,'workers','wa')));
    assert.ok((await getBytes(ref(a.storage,'profiles/leader-a/avatar.png'))).byteLength); checks++;
    await denied(uploadBytes(ref(a.storage,'profiles/leader-a/new.png'),new Uint8Array([1]),{contentType:'image/png'}),'storage/unauthorized');
    await denied(deleteObject(ref(a.storage,'profiles/leader-a/avatar.png')),'storage/unauthorized');
    const adminPreview = await client('cy-preview-admin',previewClaims('dev-fixture'));
    assert.equal((await getDoc(doc(adminPreview.db,'workers','wb'))).data().teamId,'tb'); checks++;
    await denied(updateDoc(doc(adminPreview.db,'workers','wb'),{name:'changed'}));
    await denied(setDoc(doc(adminPreview.db,'settings','menus_v12'),{}));
    const reserved = await client('cy-preview-no-claims'); await denied(getDoc(doc(reserved.db,'settings','menus_v12'))); await denied(setDoc(doc(reserved.db,'users','cy-preview-no-claims'),{role:'user'}));
    const expired = await client('cy-preview-expired',previewClaims('leader-a',{previewExpiresAt:1})); await denied(getDoc(doc(expired.db,'workers','wa')));
    await db.doc('users/dev-fixture').update({position:'일반'}); await denied(getDoc(doc(a.db,'workers','wa')));
    await db.doc('users/dev-fixture').update({position:'DEV'});
    const normal = await client('dev-fixture'); await updateDoc(doc(normal.db,'workers','wb'),{name:'검증 팀장 B'}); checks++;
    const list = (await httpsCallable(normal.functions,'getDevPreviewAccounts')({})).data.accounts;
    assert.equal(list.find(row=>row.uid==='leader-a').positionIds[0],'lead'); checks++;
    const issue = (await httpsCallable(normal.functions,'createDevPreviewSession')({targetUid:'leader-a'})).data;
    const issued = await client('cy-preview-issued-temp');
    await signInWithCustomToken(issued.auth,issue.token);
    assert.ok(issued.auth.currentUser.uid.startsWith('cy-preview-')); assert.notEqual(issued.auth.currentUser.uid,'leader-a'); checks++;
    const scoped = (await httpsCallable(issued.functions,'getTeamScopedData')({collection:'workers',filters:{}})).data.rows;
    assert.deepEqual(scoped.map(row=>row.id).sort(),['wa','wc']); checks++;
    await denied(httpsCallable(issued.functions,'teamWorkerRequests')({action:'review',id:'arbitrary'}));
    await denied(httpsCallable(issued.functions,'createDevPreviewSession')({targetUid:'leader-b'}));
    for (const name of ['geminiGateway','getKakaoManagementUrl','parseManpowerDbQuestionWithGemini','sendFriendTalk','sendKakaoAlimtalk']) {
        await denied(httpsCallable(issued.functions,name)({}));
    }
    const bearer = await issued.auth.currentUser.getIdToken();
    for (const name of ['issueTaxInvoiceApi','getTaxInvoiceListApi','getTaxInvoiceStatusApi']) {
        const response = await fetch('http://127.0.0.1:5001/'+projectId+'/asia-northeast3/'+name, {
            method:name==='issueTaxInvoiceApi'?'POST':'GET', headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json'},
            ...(name==='issueTaxInvoiceApi'?{body:'{}'}:{}) });
        assert.equal(response.status,403); checks++;
    }
    const notDev = await client('leader-a'); await denied(httpsCallable(notDev.functions,'createDevPreviewSession')({targetUid:'leader-b'}));
    const worker = await client('worker-a');
    const readOwn = async collection => (await httpsCallable(worker.functions,'getTeamScopedData')({collection,filters:{}})).data.rows;
    assert.deepEqual((await readOwn('workers')).map(row=>row.id),['wc']); checks++;
    assert.deepEqual((await readOwn('teams')).map(row=>row.id),['ta']); checks++;
    const ownSites=await readOwn('sites'); assert.deepEqual(ownSites.map(row=>row.id),['sa']); assert.equal(ownSites[0].privateMemo,undefined); checks++;
    const ownCompanies=await readOwn('companies'); assert.equal(ownCompanies[0].accountNumber,undefined); checks++;
    const ownReports=await readOwn('daily_reports'); assert.deepEqual(ownReports[0].workers.map(row=>row.workerId),['wc']); assert.equal(ownReports[0].totalAmount,100); assert.equal(ownReports[0].memo,undefined); checks++;
    assert.deepEqual((await readOwn('advance_requests')).map(row=>row.id),['own']); checks++;
    await denied(httpsCallable(worker.functions,'getTeamScopedData')({collection:'cardTransactions'}));
    const workerIssue=(await httpsCallable(normal.functions,'createDevPreviewSession')({targetUid:'worker-a'})).data;
    const workerPreview=await client('cy-preview-worker-temp'); await signInWithCustomToken(workerPreview.auth,workerIssue.token);
    const previewWorkers=(await httpsCallable(workerPreview.functions,'getTeamScopedData')({collection:'workers'})).data.rows;
    assert.deepEqual(previewWorkers.map(row=>row.id),['wc']); checks++;
    assert.equal((await db.doc('workers/wb').get()).data().name,'검증 팀장 B'); checks++;
    console.log(JSON.stringify({checks,status:'passed',coverage:['target identity','own/foreign reads','all writes denied','storage read/write','reserved identity','expiry','DEV revocation','normal admin unaffected','directory','session issuance','scoped callable','callable mutations denied']}));
} finally {
    await Promise.all(clients.map(async item=>{await terminate(item.db);await deleteApp(item.app);}));
}
