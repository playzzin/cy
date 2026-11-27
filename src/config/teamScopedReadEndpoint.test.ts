import { hostedReadUrl, type HostedReadFunction } from './teamScopedReadEndpoint';

const production = require('../../firebase.json').hosting;
const functions: HostedReadFunction[] = ['getTeamScopedData', 'getNoticeBoard', 'teamWorkerRequests', 'teamExpenseRequests'];

it.each(functions)('운영 조회 %s를 SPA보다 먼저 서울 리전 함수로 연결한다', name => {
    const url = hostedReadUrl(new URL('https://cyee-9c1e4.web.app/dashboard'), name);
    expect(url).toBe(`https://cyee-9c1e4.web.app/api/${name}`);
    const path = new URL(url!).pathname;
    expect(production.rewrites.find((rule: { source: string }) => rule.source === path || rule.source === '**'))
        .toMatchObject({ source: path, function: { functionId: name, region: 'asia-northeast3' } });
    expect(hostedReadUrl(new URL('https://cy-erp-staging-9c1e4.web.app'), name)).toBeUndefined();
});
