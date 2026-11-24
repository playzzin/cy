const { readPublishedMain } = require('./published-main.cjs');
const { checkHostingApi } = require('./hosting-network.cjs');
const { readRemoteJson } = require('./check-release.cjs');
const sites = { staging: require('../firebase.staging.json').hosting.site, production: require('../firebase.json').hosting.site };

async function main(args = process.argv.slice(2), { readMain = readPublishedMain, checkApi = checkHostingApi, readRecord = readRemoteJson, log = console.log } = {}) {
  if (args.length > 1 || (args.length && !Object.hasOwn(sites, args[0]))) throw new Error('사용법: npm run deploy:check -- [staging|production]');
  const checks = [['GitHub main', async () => (await readMain()).slice(0, 8)]];
  for (const target of args.length ? args : Object.keys(sites)) {
    const site = sites[target];
    const base = `https://${site}.web.app`;
    checks.push([`${target} Hosting API`, async () => { await checkApi(site); return 'HTTPS 응답 확인'; }]);
    checks.push([`${target} ${site}.web.app`, async () => {
      const record = await readRecord(base, 'release.json');
      if (!/^[a-f0-9]{40}$/.test(record?.commit)) throw new Error('유효한 배포 커밋을 찾지 못했습니다.');
      return record.commit.slice(0, 8);
    }]);
  }
  const results = await Promise.allSettled(checks.map(([, check]) => check()));
  for (const [index, result] of results.entries()) log(`${checks[index][0]} · ${result.status === 'fulfilled' ? result.value : result.reason.message}`);
  if (results.some(result => result.status === 'rejected')) throw new Error('배포 연결 점검 실패');
}

module.exports = { main };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
