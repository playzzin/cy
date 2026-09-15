const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const indexes = JSON.parse(fs.readFileSync(path.join(root, 'firestore.indexes.json'), 'utf8'));
// Spark staging: keep query indexes; paid automatic deletion is not enabled.
indexes.fieldOverrides = [];
fs.mkdirSync(path.join(root, '.firebase'), { recursive: true });
fs.writeFileSync(path.join(root, '.firebase/staging.indexes.json'), JSON.stringify(indexes, null, 2));
console.log('검증용 검색 색인 준비 완료 (유료 자동 삭제 정책 제외)');
