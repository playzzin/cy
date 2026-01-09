import { initializeApp, cert } from 'firebase-admin/app';
import * as fs from 'fs';
import * as path from 'path';
import { getDataConnect } from 'firebase-admin/data-connect';

const SERVICE_ACCOUNT_PATH = './service-account.json';
const BACKUPS_DIR = './backups';

const argValue = (name: string): string | null => {
    const idx = process.argv.indexOf(name);
    if (idx === -1) return null;
    const value = process.argv[idx + 1];
    return value ? String(value) : null;
};

const getLatestBackupDir = (): string | null => {
    if (!fs.existsSync(BACKUPS_DIR)) return null;
    const dirs = fs
        .readdirSync(BACKUPS_DIR)
        .filter((f) => fs.statSync(path.join(BACKUPS_DIR, f)).isDirectory())
        .sort()
        .reverse();
    return dirs.length > 0 ? path.join(BACKUPS_DIR, dirs[0]) : null;
};

const loadJson = (dir: string, filename: string): any[] => {
    const filePath = path.join(dir, filename);
    if (!fs.existsSync(filePath)) return [];
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as any[];
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
};

const pct = (num: number, den: number) => {
    if (den <= 0) return '0%';
    return `${((num / den) * 100).toFixed(1)}%`;
};

const run = async () => {
    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        console.error('❌ Service Account Key file not found!');
        process.exit(1);
    }

    const serviceAccount = JSON.parse(fs.readFileSync(path.resolve(SERVICE_ACCOUNT_PATH), 'utf8'));
    console.log(`ℹ️ Project (from service-account.json): ${serviceAccount?.project_id ?? 'UNKNOWN'}`);
    console.log(`ℹ️ FIREBASE_DATA_CONNECT_EMULATOR_HOST: ${process.env.FIREBASE_DATA_CONNECT_EMULATOR_HOST ?? 'not set'}`);
    initializeApp({ credential: cert(serviceAccount) });

    const requestedBackup = argValue('--backup');
    const backupDir = requestedBackup ? path.resolve(requestedBackup) : getLatestBackupDir();
    if (!backupDir || !fs.existsSync(backupDir)) {
        console.error('❌ Backup directory not found.');
        process.exit(1);
    }

    console.log(`📂 Using backup: ${backupDir}`);

    const backupCompanies = loadJson(backupDir, 'companies.json');
    const backupTeams = loadJson(backupDir, 'teams.json');
    const backupWorkers = loadJson(backupDir, 'workers.json');
    const backupSites = loadJson(backupDir, 'sites.json');
    const backupDailyReports = loadJson(backupDir, 'daily_reports.json');
    const backupPositions = loadJson(backupDir, 'positions.json');
    const backupMenus = loadJson(backupDir, 'menus.json');
    const backupSystemLogs = loadJson(backupDir, 'system_logs.json');
    const backupUsers = loadJson(backupDir, 'users.json');

    const backupAuditLogs = loadJson(backupDir, 'audit_logs.json');
    const backupAgents = loadJson(backupDir, 'agents.json');
    const backupAgentConversations = loadJson(backupDir, 'agent_conversations.json');
    const backupSettings = loadJson(backupDir, 'settings.json');
    const backupSystemConfig = loadJson(backupDir, 'system_config.json');

    const backupDailyReportWorkers = backupDailyReports.flatMap((r: any) => (Array.isArray(r?.workers) ? r.workers : []));

    const generatedModule: any = await import('../src/dataconnect-admin-generated/index.cjs.js');
    const generated: any = generatedModule?.default ?? generatedModule;
    const connectorConfig = generated.connectorConfig;

    console.log(`ℹ️ Data Connect connectorConfig: ${JSON.stringify(connectorConfig)}`);

    const dc = getDataConnect(connectorConfig);

    const safeQuery = async <T>(opName: string, fn: () => Promise<T>): Promise<T | null> => {
        try {
            return await fn();
        } catch (e: any) {
            const code = e?.errorInfo?.code;
            const msg = e?.errorInfo?.message ?? e?.message;
            if (code === 'data-connect/not-found') {
                console.error(`❌ Data Connect operation not found: ${opName}`);
                console.error(`   - message: ${msg}`);
                console.error(`   - Fix: deploy Data Connect operations (queries/mutations) for this connector.`);
                console.error(`     Suggested: firebase deploy --only dataconnect`);
                return null;
            }
            throw e;
        }
    };

    const dcCompaniesRes = await safeQuery('ListCompanies', () => generated.listCompanies(dc));
    const dcTeamsRes = await safeQuery('ListTeams', () => generated.listTeams(dc));
    const dcWorkersRes = await safeQuery('ListWorkers', () => generated.listWorkers(dc));
    const dcSitesRes = await safeQuery('ListSites', () => generated.listSites(dc));
    const dcDailyReportsRes = await safeQuery('ListDailyReports', () => generated.listDailyReports(dc));
    const dcDailyReportWorkersRes = typeof generated?.listDailyReportWorkers === 'function'
        ? await safeQuery('ListDailyReportWorkers', () => generated.listDailyReportWorkers(dc))
        : null;

    const dcPositionsRes = typeof generated?.listPositions === 'function'
        ? await safeQuery('ListPositions', () => generated.listPositions(dc))
        : null;

    const dcAuditLogsRes = typeof generated?.listAuditLogs === 'function'
        ? await safeQuery('ListAuditLogs', () => generated.listAuditLogs(dc))
        : null;
    const dcAgentsRes = typeof generated?.listAgents === 'function'
        ? await safeQuery('ListAgents', () => generated.listAgents(dc))
        : null;
    const dcAgentConversationsRes = typeof generated?.listAgentConversations === 'function'
        ? await safeQuery('ListAgentConversations', () => generated.listAgentConversations(dc))
        : null;
    const dcSettingsRes = typeof generated?.listSettings === 'function'
        ? await safeQuery('ListSettings', () => generated.listSettings(dc))
        : null;
    const dcSystemConfigsRes = typeof generated?.listSystemConfigs === 'function'
        ? await safeQuery('ListSystemConfigs', () => generated.listSystemConfigs(dc))
        : null;

    const dcAppUsersRes = typeof generated?.listAppUsers === 'function'
        ? await safeQuery('ListAppUsers', () => generated.listAppUsers(dc))
        : null;
    const dcMenuConfigsRes = typeof generated?.listMenuConfigs === 'function'
        ? await safeQuery('ListMenuConfigs', () => generated.listMenuConfigs(dc))
        : null;
    const dcSystemLogsRes = typeof generated?.listSystemLogs === 'function'
        ? await safeQuery('ListSystemLogs', () => generated.listSystemLogs(dc))
        : null;

    const dcCompanies = (dcCompaniesRes as any)?.data?.companies ?? null;
    const dcTeams = (dcTeamsRes as any)?.data?.teams ?? null;
    const dcWorkers = (dcWorkersRes as any)?.data?.workers ?? null;
    const dcSites = (dcSitesRes as any)?.data?.sites ?? null;
    const dcDailyReports = (dcDailyReportsRes as any)?.data?.dailyReports ?? null;
    const dcDailyReportWorkers = (dcDailyReportWorkersRes as any)?.data?.dailyReportWorkers ?? null;
    const dcPositions = (dcPositionsRes as any)?.data?.positions ?? null;
    const dcAppUsers = (dcAppUsersRes as any)?.data?.appUsers ?? null;
    const dcMenuConfigs = (dcMenuConfigsRes as any)?.data?.menuConfigs ?? null;
    const dcSystemLogs = (dcSystemLogsRes as any)?.data?.systemLogs ?? null;

    const dcAuditLogs = (dcAuditLogsRes as any)?.data?.auditLogs ?? null;
    const dcAgents = (dcAgentsRes as any)?.data?.agents ?? null;
    const dcAgentConversations = (dcAgentConversationsRes as any)?.data?.agentConversations ?? null;
    const dcSettings = (dcSettingsRes as any)?.data?.settings ?? null;
    const dcSystemConfigs = (dcSystemConfigsRes as any)?.data?.systemConfigs ?? null;

    console.log('\n# Counts (Backup vs Data Connect)');
    const rows: Array<[string, number, number | null]> = [
        ['companies', backupCompanies.length, dcCompanies ? dcCompanies.length : null],
        ['teams', backupTeams.length, dcTeams ? dcTeams.length : null],
        ['workers', backupWorkers.length, dcWorkers ? dcWorkers.length : null],
        ['sites', backupSites.length, dcSites ? dcSites.length : null],
        ['positions', backupPositions.length, dcPositions ? dcPositions.length : null],
        ['daily_reports', backupDailyReports.length, dcDailyReports ? dcDailyReports.length : null],
        ['daily_report_workers', backupDailyReportWorkers.length, dcDailyReportWorkers ? dcDailyReportWorkers.length : null],
        ['users', backupUsers.length, dcAppUsers ? dcAppUsers.length : null],
        ['menus', backupMenus.length, dcMenuConfigs ? dcMenuConfigs.length : null],
        ['system_logs', backupSystemLogs.length, dcSystemLogs ? dcSystemLogs.length : null],
        ['audit_logs', backupAuditLogs.length, dcAuditLogs ? dcAuditLogs.length : null],
        ['agents', backupAgents.length, dcAgents ? dcAgents.length : null],
        ['agent_conversations', backupAgentConversations.length, dcAgentConversations ? dcAgentConversations.length : null],
        ['settings', backupSettings.length, dcSettings ? dcSettings.length : null],
        ['system_config', backupSystemConfig.length, dcSystemConfigs ? dcSystemConfigs.length : null]
    ];

    rows.forEach(([name, b, d]) => {
        if (d == null) {
            console.log(`- ${name}: backup=${b} / dataconnect=UNKNOWN (missing list query operation)`);
            return;
        }
        const diff = d - b;
        const sign = diff > 0 ? '+' : '';
        console.log(`- ${name}: backup=${b} / dataconnect=${d} (diff=${sign}${diff})`);

        if (diff > 0) {
            console.log(`  - ⚠️ dataconnect has more rows than backup (possible duplicates from re-runs)`);
        }
        if (diff < 0) {
            console.log(`  - ⚠️ dataconnect has fewer rows than backup (possible skips due to missing FK/date)`);
        }
    });

    console.log('\n# Relationship completeness (Data Connect)');
    if (!dcTeams || !dcWorkers || !dcDailyReports) {
        console.log('- skipped (missing list query operation output)');
    } else {
        const teamsWithCompany = dcTeams.filter((t: any) => !!t.company?.id).length;
        const teamsWithLeader = dcTeams.filter((t: any) => !!t.leader?.id).length;
        console.log(`- teams.company present: ${teamsWithCompany}/${dcTeams.length} (${pct(teamsWithCompany, dcTeams.length)})`);
        console.log(`- teams.leader present: ${teamsWithLeader}/${dcTeams.length} (${pct(teamsWithLeader, dcTeams.length)})`);

        const workersWithTeam = dcWorkers.filter((w: any) => !!w.team?.id).length;
        console.log(`- workers.team present: ${workersWithTeam}/${dcWorkers.length} (${pct(workersWithTeam, dcWorkers.length)})`);

        const reportsWithSite = dcDailyReports.filter((r: any) => !!r.site?.id).length;
        console.log(`- dailyReports.site present: ${reportsWithSite}/${dcDailyReports.length} (${pct(reportsWithSite, dcDailyReports.length)})`);
    }

    if (!dcDailyReportWorkers) {
        console.log('- dailyReportWorkers: skipped (missing list query operation output)');
    } else {
        const rowsWithWorker = dcDailyReportWorkers.filter((r: any) => !!r.worker?.id).length;
        const rowsWithReport = dcDailyReportWorkers.filter((r: any) => !!r.dailyReport?.id).length;
        console.log(`- dailyReportWorkers.worker present: ${rowsWithWorker}/${dcDailyReportWorkers.length} (${pct(rowsWithWorker, dcDailyReportWorkers.length)})`);
        console.log(`- dailyReportWorkers.dailyReport present: ${rowsWithReport}/${dcDailyReportWorkers.length} (${pct(rowsWithReport, dcDailyReportWorkers.length)})`);
    }

    console.log('\n# Sanity checks');
    if (!dcCompanies || !dcDailyReports) {
        console.log('- skipped (missing list query operation output)');
    } else {
        const companiesMissingCode = dcCompanies.filter((c: any) => !c.code || String(c.code).trim().length === 0).length;
        const companiesMissingName = dcCompanies.filter((c: any) => !c.name || String(c.name).trim().length === 0).length;
        console.log(`- companies missing code: ${companiesMissingCode}`);
        console.log(`- companies missing name: ${companiesMissingName}`);

        const reportsMissingStatus = dcDailyReports.filter((r: any) => r.status == null || String(r.status).trim().length === 0).length;
        console.log(`- dailyReports missing status: ${reportsMissingStatus}`);
    }

    console.log('\n✅ Verification finished.');
};

run().catch((e) => {
    console.error('❌ Verification failed:', e);
    process.exit(1);
});
