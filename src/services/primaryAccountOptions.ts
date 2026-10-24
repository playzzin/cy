import { PrimaryAccountSetting, PrimaryAccountSourceType } from './primaryAccountService';

// Read the existing directories only when the user opens the account picker.
export async function loadPrimaryAccountOptions(): Promise<{ accounts: PrimaryAccountSetting[]; partialFailure: boolean }> {
    const results = await Promise.allSettled([
        import('./companyService').then(({ companyService }) => companyService.getCompanies()),
        import('./teamService').then(({ teamService }) => teamService.getTeams()),
        import('./manpowerService').then(({ manpowerService }) => manpowerService.getWorkers(true)),
        import('./accountDirectoryService').then(({ accountDirectoryService }) => accountDirectoryService.getEntries()),
    ]);
    const types: PrimaryAccountSourceType[] = ['company', 'team', 'worker', 'custom'];
    const accounts: PrimaryAccountSetting[] = [];
    results.forEach((result, index) => {
        if (result.status !== 'fulfilled') return;
        result.value.forEach(row => {
            const accountNumber = String(row.accountNumber ?? '').trim();
            if (!accountNumber) return;
            accounts.push({ sourceType: types[index], sourceId: String(row.id ?? ''), sourceName: String(row.name ?? ''),
                bankName: String(row.bankName ?? ''), accountHolder: String(row.accountHolder ?? ''), accountNumber });
        });
    });
    return { accounts, partialFailure: results.some(result => result.status === 'rejected') };
}
