const fs = require('node:fs');
const path = require('node:path');
const parser = require('@babel/parser');
const root = path.resolve(__dirname, '..');
const ast = parser.parse(fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8'), { sourceType: 'module', plugins: ['typescript', 'jsx'] });
const routes = [];
function walk(node, base = '') {
    if (!node || typeof node !== 'object') return;
    let next = base;
    if (node.type === 'JSXElement' && node.openingElement.name.name === 'Route') {
        const attrs = node.openingElement.attributes;
        const route = attrs.find(item => item.name?.name === 'path')?.value?.value;
        if (typeof route === 'string') {
            next = route.startsWith('/') ? route : `${base}/${route}`;
            next = next.replace(/\/{2,}/g, '/');
            const element = attrs.find(item => item.name?.name === 'element')?.value?.expression;
            const component = element?.openingElement?.name?.name;
            if (component) routes.push({ path: next, component });
        }
    }
    for (const [key, value] of Object.entries(node)) {
        if (['loc', 'start', 'end', 'extra'].includes(key)) continue;
        if (Array.isArray(value)) value.forEach(child => walk(child, next));
        else if (value && typeof value === 'object') walk(value, next);
    }
}
walk(ast);
const modified = new Set(['TeamWorkerDetailPage', 'WhiteboardStatusBoard', 'TeamSettlementPage', 'WorkerAdvanceRequestPage', 'TeamAccountApprovalPage']);
const publicPages = new Set(['Login', 'HomepageClientProgressPage', 'CompanyLandingPage']);
const category = route => /payroll|taxinvoice|tax-affairs|accounting/.test(route) ? '급여·정산·회계' : /manpower|database|labor|hr/.test(route) ? '인원·기준정보' : /support|materials|vehicle|accommodation/.test(route) ? '지원·자산' : /report|assignment|jeonkuk|dashboard|construction/.test(route) ? '현장·현황·보고' : /office|team|worker/.test(route) ? '신청·사무실' : /admin|settings|system|design|developer/.test(route) ? '관리·설정' : '공통·기타';
const rows = routes.map(route => {
    const changed = modified.has(route.component);
    const redirect = route.component === 'Navigate';
    const publicPage = publicPages.has(route.component);
    const disposition = redirect ? '기존 이동 유지' : publicPage ? '공개 페이지 기존 규격 유지' : changed ? '업무 화면 개선 + 공통 규칙 적용' : '공통 규칙 적용, 기존 업무 레이아웃 유지';
    const reason = redirect ? '대체 경로 호환' : publicPage ? '업무용 DashboardLayout 밖의 공개 경로; 이번 공통 화면 스타일 적용 대상 아님' : changed ? '이번 모바일 요구사항 직접 대상' : /payroll|taxinvoice|database|report|construction/.test(route.path) ? '표·문서의 데이터 밀도와 출력 규격 유지' : '기존 업무 동선을 유지하며 공통 shell 글꼴·포커스 적용';
    return `|${route.path}|${route.component}|${category(route.path)}|${disposition}|${reason}|${changed ? '대표 합성 화면 검수; 상세 범위는 보고서 참조' : redirect ? '소스 대조' : '개별 화면 시각 검수 미실시'}|`;
});
const out = '# 전체 라우트 디자인 적용 목록\n\n`src/App.tsx`의 실제 JSX Route에서 자동 추출. 운영 DB 메뉴 활성 여부는 조회하지 않았으므로 활성 라우트의 상한 목록이다. 공통 shell을 사용하지 않는 공개 페이지와 출력·캡처 문서는 기존 규격을 유지한다. 개별 화면 미검증을 전체 디자인 검수 완료로 계산하지 않는다.\n\n화면 규칙: 흰 배경 카드, 슬레이트 본문·보조색, 파란 선택/포커스, 12px 기본 간격, 모바일 주요 조작 44px, 숫자 동일 폭. 상세 근거: `src/components/common/WorkflowTheme.css`. 화면용 규칙은 `@media screen`으로 출력에 적용하지 않는다.\n\n' + `총 ${routes.length}개 라우트 항목.\n\n` + '|경로|화면|분류|적용 결정|이유|검수|\n|---|---|---|---|---|---|\n' + rows.join('\n') + '\n';
fs.writeFileSync(path.join(root, 'docs/client-mobile-route-design-inventory.md'), out);
console.log(`Recorded ${routes.length} route entries.`);
